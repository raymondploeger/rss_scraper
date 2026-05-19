import Parser from "rss-parser";
import { env } from "../config/env.js";
import {
  createFeed as createFeedRecord,
  deleteFeed as deleteFeedRecord,
  findFeedById,
  findFeedByRssUrl,
  listFeeds as listFeedRecords,
  updateFeed as updateFeedRecord,
  countFeeds
} from "../database/feedRepository.js";
import { deleteArticlesByFeedId } from "../database/articleRepository.js";
import { deletePollLogsByFeedId } from "../database/pollLogRepository.js";
import { syncAllFeeds, syncFeed, processArticleBacklog } from "../services/rssService.js";
import { toFeedDto } from "../services/presenterService.js";
import { broadcast } from "../services/realtimeService.js";
import { isRuntimeReady } from "../services/runtimeState.js";
import axios from "axios";
import * as cheerio from "cheerio";

const parser = new Parser({ timeout: env.requestTimeoutMs });

function normalizeSourceType(value) {
  const normalizedValue = String(value || "rss").trim().toLowerCase();
  if (normalizedValue === "rss feed") {
    return "rss";
  }
  if (normalizedValue === "site") {
    return "website";
  }
  if (normalizedValue === "link only") {
    return "link-only";
  }
  return normalizedValue || "rss";
}

async function parseFeedFromUrl(url) {
  try {
    return await parser.parseURL(url);
  } catch (initialError) {
    const response = await axios.get(url, {
      timeout: env.requestTimeoutMs,
      responseType: "text",
      maxRedirects: 5,
      headers: {
        "User-Agent": "RSS Monitor Dashboard/2.0",
        Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,text/html"
      },
      validateStatus: (status) => status >= 200 && status < 400
    });

    const body = String(response.data || "").trim();
    if (!body) {
      throw initialError;
    }

    try {
      return await parser.parseString(body);
    } catch {
      throw initialError;
    }
  }
}

async function discoverFeedUrl(inputUrl) {
  try {
    await parseFeedFromUrl(inputUrl);
    return inputUrl;
  } catch {
    const response = await axios.get(inputUrl, {
      timeout: env.requestTimeoutMs,
      responseType: "text",
      maxRedirects: 5,
      headers: {
        "User-Agent": "RSS Monitor Dashboard/2.0",
        Accept: "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml,text/xml"
      },
      validateStatus: (status) => status >= 200 && status < 400
    });

    const html = String(response.data || "");
    const $ = cheerio.load(html);
    const alternateUrl =
      $('link[rel="alternate"][type="application/rss+xml"]').first().attr("href") ||
      $('link[rel="alternate"][type="application/atom+xml"]').first().attr("href") ||
      "";
    const candidates = [alternateUrl, "/feed/", "/rss.xml", "/feed.xml", "/atom.xml"]
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
        await parseFeedFromUrl(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error("Invalid or unreachable RSS feed URL");
  }
}

async function validateWebsiteUrl(inputUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    throw new Error("Invalid website URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Website URL must use http or https");
  }

  try {
    await axios.get(parsedUrl.toString(), {
      timeout: env.requestTimeoutMs,
      responseType: "text",
      maxRedirects: 5,
      headers: {
        "User-Agent": "RSS Monitor Dashboard/2.0",
        Accept: "text/html,application/xhtml+xml"
      },
      validateStatus: (status) => status >= 200 && status < 400
    });
  } catch (error) {
    throw new Error(error?.message || "Website URL is unreachable");
  }

  return parsedUrl.toString();
}

async function resolveSourceUrl(inputUrl, sourceType) {
  if (sourceType === "website") {
    return validateWebsiteUrl(inputUrl);
  }

  return discoverFeedUrl(inputUrl);
}

export async function listFeeds(request, response) {
  try {
    if (!isRuntimeReady()) {
      response.json([]);
      return;
    }

    const feeds = await listFeedRecords();
    response.json(feeds.map(toFeedDto));
  } catch (error) {
    console.error("Feeds error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to load feeds" });
  }
}

export async function createFeed(request, response) {
  try {
    const { name, topic, rssUrl, sourceType = "rss", isActive = true } = request.body;
    const normalizedSourceType = normalizeSourceType(sourceType);

    if (!rssUrl) {
      return response.status(400).json({ error: "Source URL is required." });
    }

    if (normalizedSourceType === "rss") {
      const rssFeedCount = await countFeeds({ sourceType: "rss" });
      if (rssFeedCount >= env.maxFeeds) {
        return response.status(400).json({ error: `Maximum of ${env.maxFeeds} RSS feeds reached` });
      }
    }

    const resolvedFeedUrl = await resolveSourceUrl(rssUrl, normalizedSourceType);
    const duplicate = await findFeedByRssUrl(resolvedFeedUrl);
    if (duplicate) {
      return response.status(409).json({ error: "This source is already in the dashboard." });
    }

    const parsed = normalizedSourceType === "rss" ? await parseFeedFromUrl(resolvedFeedUrl) : null;
    const feed = await createFeedRecord({
      name: name || parsed?.title || "Untitled Source",
      topic: topic || name || parsed?.title || "General",
      rssUrl: resolvedFeedUrl,
      sourceType: normalizedSourceType,
      isActive
    });
    broadcast("feed:update", { type: "feed:update", action: "created", feed: toFeedDto(feed) });
    response.status(201).json(toFeedDto(feed));
  } catch (error) {
    console.error("Create feed error:", error?.stack || error);
    response.status(400).json({ error: error?.message || "Failed to create feed" });
  }
}

export async function updateFeed(request, response) {
  try {
    const { feedId } = request.params;
    const { name, topic, rssUrl, isActive, sourceType } = request.body;

    const feed = await findFeedById(feedId);
    if (!feed) {
      return response.status(404).json({ error: "Feed not found" });
    }

    const nextValues = {};
    if (typeof name === "string") nextValues.name = name;
    if (typeof topic === "string") nextValues.topic = topic;
    if (typeof rssUrl === "string") {
      const resolvedFeedUrl = await resolveSourceUrl(
        rssUrl,
        normalizeSourceType(typeof sourceType === "string" ? sourceType : feed.sourceType || "rss")
      );
      const duplicate = await findFeedByRssUrl(resolvedFeedUrl);
      if (duplicate && duplicate.id !== feedId) {
        return response.status(409).json({ error: "This source is already in the dashboard." });
      }
      nextValues.rssUrl = resolvedFeedUrl;
    }
    if (typeof isActive === "boolean") nextValues.isActive = isActive;
    if (typeof sourceType === "string") nextValues.sourceType = normalizeSourceType(sourceType);

    const updatedFeed = await updateFeedRecord(feedId, nextValues);
    broadcast("feed:update", { type: "feed:update", action: "updated", feed: toFeedDto(updatedFeed) });
    response.json(toFeedDto(updatedFeed));
  } catch (error) {
    console.error("Update feed error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to update feed" });
  }
}

export async function deleteFeed(request, response) {
  try {
    const { feedId } = request.params;
    const existingFeed = await findFeedById(feedId);
    if (!existingFeed) {
      response.status(404).json({ error: "Feed not found" });
      return;
    }

    const deletedArticles = await deleteArticlesByFeedId(feedId);
    const deletedPollLogs = await deletePollLogsByFeedId(feedId);
    await deleteFeedRecord(feedId);

    broadcast("feed:update", {
      type: "feed:update",
      action: "deleted",
      feed: { id: feedId }
    });
    response.json({
      deleted: true,
      feedId,
      deletedArticles,
      deletedPollLogs
    });
  } catch (error) {
    console.error("Delete feed error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to delete feed" });
  }
}

export async function refreshFeed(request, response) {
  try {
    const { feedId } = request.params;
    console.log(`Manual refresh requested for feed ${feedId}`);
    const feed = await findFeedById(feedId);

    if (!feed) {
      return response.status(404).json({ error: "Feed not found" });
    }

    const result = await syncFeed(feed);
    response.json(result);
  } catch (error) {
    console.error("Refresh feed error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to refresh feed" });
  }
}

export async function refreshAll(request, response) {
  try {
    console.log("Manual refresh requested for all feeds");
    void syncAllFeeds();
    response.status(202).json({ started: true, message: "Feed refresh started in the background" });
  } catch (error) {
    console.error("Refresh all error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to start refresh" });
  }
}

export async function processBacklog(request, response) {
  try {
    void processArticleBacklog();
    response.status(202).json({ started: true, message: "Article processing started in the background" });
  } catch (error) {
    console.error("Process backlog error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to start backlog processing" });
  }
}
