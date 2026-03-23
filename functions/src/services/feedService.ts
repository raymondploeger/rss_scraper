import Parser from "rss-parser";
import { promises as fs } from "node:fs";
import path from "node:path";
import axios from "axios";
import * as cheerio from "cheerio";
import { batch, db, serverTimestamp } from "../database/firestoreService";
import { MAX_FEEDS, USER_AGENT } from "../config/constants";
import { FeedRecord } from "../types";
import { normalizeText } from "../utils/text";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": USER_AGENT,
  },
});

const feedBackupPath = path.resolve(__dirname, "../../local-data/feeds-backup.json");
let restoreAttempt: Promise<void> | null = null;

function looksLikeFeedContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("application/rss+xml") ||
    normalized.includes("application/atom+xml") ||
    normalized.includes("application/xml") ||
    normalized.includes("text/xml")
  );
}

async function fetchPage(url: string) {
  return axios.get(url, {
    timeout: 10000,
    responseType: "text",
    maxRedirects: 5,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml,text/xml",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
}

async function parseFeedUrl(rssUrl: string) {
  const parsed = await parser.parseURL(rssUrl);
  return {
    rssUrl,
    parsed,
  };
}

async function discoverFeedUrl(inputUrl: string): Promise<string | null> {
  const response = await fetchPage(inputUrl);
  const contentType = String(response.headers["content-type"] || "");

  if (looksLikeFeedContentType(contentType)) {
    return inputUrl;
  }

  const html = String(response.data || "");
  const $ = cheerio.load(html);
  const alternateUrl =
    $('link[rel="alternate"][type="application/rss+xml"]').first().attr("href") ||
    $('link[rel="alternate"][type="application/atom+xml"]').first().attr("href") ||
    "";

  const candidates = [
    alternateUrl,
    "/feed/",
    "/rss/",
    "/feed.xml",
    "/rss.xml",
    "/atom.xml",
    "/index.xml",
  ]
    .map((candidate) => {
      if (!candidate) {
        return "";
      }

      try {
        return new URL(candidate, inputUrl).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      await parser.parseURL(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveFeedInput(inputUrl: string) {
  try {
    return await parseFeedUrl(inputUrl);
  } catch {
    const discoveredUrl = await discoverFeedUrl(inputUrl);
    if (!discoveredUrl) {
      throw new Error("Could not find an RSS or Atom feed at that URL");
    }

    return parseFeedUrl(discoveredUrl);
  }
}

function toSerializableDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function toBackupRecord(feed: FeedRecord) {
  return {
    id: feed.id,
    name: feed.name,
    rssUrl: feed.rssUrl,
    topic: feed.topic,
    sourceType: feed.sourceType,
    isActive: feed.isActive,
    createdAt: toSerializableDate(feed.createdAt),
    updatedAt: toSerializableDate(feed.updatedAt),
    lastStatus: feed.lastStatus || "idle",
    lastError: feed.lastError || null,
    lastFetchedAt: toSerializableDate(feed.lastFetchedAt),
    lastInsertedCount: typeof feed.lastInsertedCount === "number" ? feed.lastInsertedCount : 0,
  };
}

async function writeFeedBackup(feeds: FeedRecord[]) {
  await fs.mkdir(path.dirname(feedBackupPath), { recursive: true });
  await fs.writeFile(feedBackupPath, JSON.stringify(feeds.map(toBackupRecord), null, 2));
}

async function backupCurrentFeeds() {
  const snapshot = await db.collection("feeds").orderBy("createdAt", "desc").limit(MAX_FEEDS).get();
  const feeds = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FeedRecord, "id">) }));
  await writeFeedBackup(feeds);
}

async function restoreFeedsFromBackupIfNeeded() {
  try {
    const raw = await fs.readFile(feedBackupPath, "utf8");
    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(records) || records.length === 0) {
      return;
    }

    const countSnapshot = await db.collection("feeds").count().get();
    if ((countSnapshot.data().count || 0) > 0) {
      return;
    }

    const writeBatch = batch();
    records.slice(0, MAX_FEEDS).forEach((record) => {
      const id = normalizeText(record.id, "");
      const rssUrl = normalizeText(record.rssUrl, "");
      if (!id || !rssUrl) {
        return;
      }

      writeBatch.set(db.collection("feeds").doc(id), {
        name: normalizeText(record.name, "Untitled Feed"),
        rssUrl,
        topic: normalizeText(record.topic, normalizeText(record.name, "Untitled Feed")),
        sourceType: normalizeText(record.sourceType, "rss"),
        isActive: record.isActive !== false,
        createdAt: record.createdAt ? new Date(String(record.createdAt)) : new Date(),
        updatedAt: record.updatedAt ? new Date(String(record.updatedAt)) : new Date(),
        lastStatus: normalizeText(record.lastStatus, "idle"),
        lastError: normalizeText(record.lastError, "") || null,
        lastFetchedAt: record.lastFetchedAt ? new Date(String(record.lastFetchedAt)) : null,
        lastInsertedCount: typeof record.lastInsertedCount === "number" ? record.lastInsertedCount : 0,
      });
    });
    await writeBatch.commit();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

export async function restoreFeedsFromBackup(force = false) {
  if (force) {
    const existingSnapshot = await db.collection("feeds").limit(MAX_FEEDS).get();
    if (!existingSnapshot.empty) {
      const clearBatch = batch();
      existingSnapshot.docs.forEach((doc) => clearBatch.delete(doc.ref));
      await clearBatch.commit();
    }
    const raw = await fs.readFile(feedBackupPath, "utf8");
    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(records) || records.length === 0) {
      return;
    }

    const writeBatch = batch();
    records.slice(0, MAX_FEEDS).forEach((record) => {
      const id = normalizeText(record.id, "");
      const rssUrl = normalizeText(record.rssUrl, "");
      if (!id || !rssUrl) {
        return;
      }

      writeBatch.set(db.collection("feeds").doc(id), {
        name: normalizeText(record.name, "Untitled Feed"),
        rssUrl,
        topic: normalizeText(record.topic, normalizeText(record.name, "Untitled Feed")),
        sourceType: normalizeText(record.sourceType, "rss"),
        isActive: record.isActive !== false,
        createdAt: record.createdAt ? new Date(String(record.createdAt)) : new Date(),
        updatedAt: record.updatedAt ? new Date(String(record.updatedAt)) : new Date(),
        lastStatus: normalizeText(record.lastStatus, "idle"),
        lastError: normalizeText(record.lastError, "") || null,
        lastFetchedAt: record.lastFetchedAt ? new Date(String(record.lastFetchedAt)) : null,
        lastInsertedCount: typeof record.lastInsertedCount === "number" ? record.lastInsertedCount : 0,
      });
    });
    await writeBatch.commit();
    restoreAttempt = Promise.resolve();
    return;
  }

  await restoreFeedsFromBackupIfNeeded();
}

async function ensureFeedsRestored() {
  if (!restoreAttempt) {
    restoreAttempt = restoreFeedsFromBackupIfNeeded().catch((error) => {
      restoreAttempt = null;
      throw error;
    });
  }

  await restoreAttempt;
}

export async function listFeeds(): Promise<FeedRecord[]> {
  await ensureFeedsRestored();
  const snapshot = await db.collection("feeds").orderBy("createdAt", "desc").limit(MAX_FEEDS).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FeedRecord, "id">) }));
}

export async function listActiveFeeds(): Promise<FeedRecord[]> {
  await ensureFeedsRestored();
  const snapshot = await db
    .collection("feeds")
    .where("isActive", "==", true)
    .orderBy("createdAt", "desc")
    .limit(MAX_FEEDS)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FeedRecord, "id">) }));
}

async function findFeedByRssUrl(rssUrl: string): Promise<FeedRecord | null> {
  await ensureFeedsRestored();
  const snapshot = await db.collection("feeds").where("rssUrl", "==", rssUrl).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<FeedRecord, "id">) };
}

export async function feedExistsByRssUrl(rssUrl: string): Promise<boolean> {
  return Boolean(await findFeedByRssUrl(rssUrl));
}

export async function getFeedById(feedId: string): Promise<FeedRecord | null> {
  await ensureFeedsRestored();
  const snapshot = await db.collection("feeds").doc(feedId).get();
  if (!snapshot.exists) {
    return null;
  }

  return { id: snapshot.id, ...(snapshot.data() as Omit<FeedRecord, "id">) };
}

export async function createFeed(input: {
  name: string;
  rssUrl: string;
  topic: string;
  sourceType: string;
  isActive: boolean;
}) {
  await ensureFeedsRestored();
  const countSnapshot = await db.collection("feeds").count().get();
  if ((countSnapshot.data().count || 0) >= MAX_FEEDS) {
    throw new Error(`Maximum of ${MAX_FEEDS} feeds reached`);
  }

  const resolvedFeed = await resolveFeedInput(input.rssUrl);

  const existing = await findFeedByRssUrl(resolvedFeed.rssUrl);
  if (existing) {
    throw new Error("A feed with that RSS URL already exists");
  }

  const resolvedName = normalizeText(input.name, normalizeText(resolvedFeed.parsed.title, "Untitled Feed"));
  const topic = normalizeText(input.topic, resolvedName);
  const payload = {
    name: resolvedName,
    rssUrl: resolvedFeed.rssUrl,
    topic,
    sourceType: normalizeText(input.sourceType, "rss"),
    isActive: input.isActive,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastStatus: "idle",
    lastFetchedAt: null,
    lastInsertedCount: 0,
    lastError: null,
  };

  const ref = await db.collection("feeds").add(payload);
  await backupCurrentFeeds();
  return { id: ref.id, ...payload };
}

export async function updateFeed(
  feedId: string,
  input: { name: string; rssUrl: string; topic: string; sourceType: string; isActive: boolean },
) {
  await ensureFeedsRestored();
  const existing = await getFeedById(feedId);
  if (!existing) {
    throw new Error("Feed not found");
  }

  if (input.rssUrl && input.rssUrl !== existing.rssUrl) {
    const resolvedFeed = await resolveFeedInput(input.rssUrl);
    const duplicate = await findFeedByRssUrl(resolvedFeed.rssUrl);
    if (duplicate && duplicate.id !== feedId) {
      throw new Error("A feed with that RSS URL already exists");
    }

    input = {
      ...input,
      rssUrl: resolvedFeed.rssUrl,
    };
  }

  const payload = {
    name: normalizeText(input.name, existing.name),
    rssUrl: normalizeText(input.rssUrl, existing.rssUrl),
    topic: normalizeText(input.topic, existing.topic || existing.name),
    sourceType: normalizeText(input.sourceType, existing.sourceType || "rss"),
    isActive: input.isActive,
    updatedAt: serverTimestamp(),
  };

  await db.collection("feeds").doc(feedId).set(payload, { merge: true });
  await backupCurrentFeeds();
  return { ...existing, ...payload, id: feedId };
}

export async function deleteFeed(feedId: string) {
  await ensureFeedsRestored();
  const feed = await getFeedById(feedId);
  if (!feed) {
    throw new Error("Feed not found");
  }

  const articleSnapshot = await db.collection("articles").where("feedId", "==", feedId).limit(500).get();
  const writeBatch = batch();
  writeBatch.delete(db.collection("feeds").doc(feedId));
  articleSnapshot.docs.forEach((doc) => writeBatch.delete(doc.ref));
  await writeBatch.commit();
  await backupCurrentFeeds();

  return { id: feedId, deletedArticles: articleSnapshot.size };
}

export async function updateFeedStatus(
  feedId: string,
  payload: { lastFetchedAt: string; lastStatus: string; lastInsertedCount?: number; lastError?: string | null },
) {
  await db.collection("feeds").doc(feedId).set(
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
