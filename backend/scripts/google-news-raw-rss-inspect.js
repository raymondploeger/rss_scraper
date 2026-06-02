import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../src/config/env.js";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../.env");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
  process.exit(1);
}

const args = process.argv.slice(2);
const feedLimitArg = args.find((arg) => arg.startsWith("--feeds="));
const itemLimitArg = args.find((arg) => arg.startsWith("--items="));
const feedLimit = Math.max(1, Math.min(3, Number(feedLimitArg ? feedLimitArg.split("=")[1] : 3) || 3));
const itemLimit = Math.max(1, Math.min(5, Number(itemLimitArg ? itemLimitArg.split("=")[1] : 5) || 5));

const client = new Client({
  connectionString: databaseUrl,
  application_name: "google-news-raw-rss-inspect",
});

function formatRows(rows = []) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value == null ? "" : value,
      ])
    )
  );
}

function getHostname(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isGoogleNewsFeed(feed) {
  const rssUrl = String(feed.rssUrl || "").toLowerCase();
  const name = String(feed.name || "").toLowerCase();
  return (
    rssUrl.includes("news.google.com") ||
    name.includes("google alert") ||
    name.includes("google news")
  );
}

function extractUrls(value) {
  return Array.from(new Set(String(value || "").match(/https?:\/\/[^\s"'<>\\]+/gi) || []));
}

function extractDomainCandidates(value) {
  return Array.from(
    new Set(
      (String(value || "").match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || [])
        .map((candidate) => candidate.toLowerCase())
        .filter((candidate) => !candidate.includes("news.google.com"))
    )
  );
}

function extractItemFields($item) {
  const fieldMap = new Map();
  const fieldNames = [];

  $item.children().each((_, element) => {
    const tagName = element.tagName || element.name || "";
    if (!tagName) {
      return;
    }
    fieldNames.push(tagName);

    const node = cheerio.load(cheerio.html(element), { xmlMode: true }).root().children().first();
    const textValue = node.text();
    const htmlValue = cheerio.html(element, { xmlMode: true }) || "";
    const attrMap = element.attribs || {};

    if (!fieldMap.has(tagName)) {
      fieldMap.set(tagName, []);
    }

    fieldMap.get(tagName).push({
      text: String(textValue || "").trim(),
      html: htmlValue,
      attrs: attrMap,
    });
  });

  return {
    fieldMap,
    fieldNames: Array.from(new Set(fieldNames)),
  };
}

function inspectPublisherInfo(fieldMap) {
  const sourceEntries = fieldMap.get("source") || [];
  const descriptionEntries = fieldMap.get("description") || [];
  const contentEntries = [
    ...(fieldMap.get("content:encoded") || []),
    ...(fieldMap.get("content") || []),
  ];
  const titleEntries = fieldMap.get("title") || [];
  const linkEntries = fieldMap.get("link") || [];
  const guidEntries = fieldMap.get("guid") || [];

  const publisherName = sourceEntries.find((entry) => entry.text)?.text || "";
  const sourceUrlAttr =
    sourceEntries.find((entry) => entry.attrs?.url)?.attrs?.url ||
    sourceEntries.find((entry) => entry.attrs?.href)?.attrs?.href ||
    "";

  const embeddedUrlSources = [
    ...descriptionEntries.map((entry) => ({ field: "description", urls: extractUrls(entry.html || entry.text) })),
    ...contentEntries.map((entry) => ({ field: "content", urls: extractUrls(entry.html || entry.text) })),
    ...sourceEntries.map((entry) => ({ field: "source", urls: extractUrls(entry.html || entry.text) })),
    ...linkEntries.map((entry) => ({ field: "link", urls: extractUrls(entry.text) })),
    ...guidEntries.map((entry) => ({ field: "guid", urls: extractUrls(entry.text) })),
  ];

  const publisherUrlCandidateFromField = embeddedUrlSources.find((entry) =>
    entry.urls.some((url) => !getHostname(url).includes("news.google.com"))
  );

  const publisherUrlCandidate =
    (sourceUrlAttr && !getHostname(sourceUrlAttr).includes("news.google.com") ? sourceUrlAttr : "") ||
    publisherUrlCandidateFromField?.urls.find((url) => !getHostname(url).includes("news.google.com")) ||
    "";

  const publisherDomain =
    getHostname(publisherUrlCandidate) ||
    extractDomainCandidates(
      [
        publisherName,
        ...sourceEntries.map((entry) => entry.text),
        ...descriptionEntries.map((entry) => `${entry.text} ${entry.html}`),
        ...contentEntries.map((entry) => `${entry.text} ${entry.html}`),
      ].join(" ")
    )[0] ||
    "";

  const publisherInfoSourceField =
    sourceUrlAttr && !getHostname(sourceUrlAttr).includes("news.google.com")
      ? "source@url"
      : publisherUrlCandidateFromField?.field || (publisherDomain && publisherName ? "source-text" : "");

  return {
    publisherName,
    publisherDomain,
    publisherUrlCandidate,
    publisherInfoSourceField,
  };
}

function extractThumbnailCandidate(fieldMap) {
  const mediaContent = fieldMap.get("media:content") || [];
  const mediaThumbnail = fieldMap.get("media:thumbnail") || [];
  const enclosure = fieldMap.get("enclosure") || [];
  const image = fieldMap.get("image") || [];

  return (
    mediaContent.find((entry) => entry.attrs?.url)?.attrs?.url ||
    enclosure.find((entry) => entry.attrs?.url)?.attrs?.url ||
    mediaThumbnail.find((entry) => entry.attrs?.url)?.attrs?.url ||
    image.find((entry) => entry.text)?.text ||
    ""
  );
}

async function fetchRawXml(url) {
  const response = await axios.get(url, {
    timeout: env.requestTimeoutMs,
    responseType: "text",
    headers: {
      "User-Agent": "RSS Monitor Dashboard/2.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  return String(response.data || "");
}

async function loadGoogleNewsFeeds() {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        topic,
        "rssUrl",
        "sourceType",
        "isActive"
      FROM feeds
      WHERE "isActive" = true
      ORDER BY "createdAt" DESC
    `
  );

  return result.rows.filter(isGoogleNewsFeed).slice(0, feedLimit);
}

async function main() {
  try {
    await client.connect();
    const feeds = await loadGoogleNewsFeeds();

    console.log("\n=== Google News Raw RSS Inspection ===");
    console.table(
      formatRows([
        {
          feeds_selected: feeds.length,
          item_limit_per_feed: itemLimit,
        },
      ])
    );

    const sampleRows = [];
    const fieldsFound = new Map();
    let itemsInspected = 0;
    let itemsWithPublisherUrlFound = 0;
    let itemsWithPublisherDomainOnly = 0;
    let itemsWithNoPublisherInfo = 0;

    for (const feed of feeds) {
      let rawXml = "";
      try {
        rawXml = await fetchRawXml(feed.rssUrl);
      } catch (error) {
        sampleRows.push({
          feedName: feed.name || "",
          itemTitle: "[feed fetch failed]",
          googleNewsUrl: feed.rssUrl,
          publisherName: "",
          publisherDomain: "",
          publisherUrlCandidate: "",
          publisherInfoSourceField: "",
          thumbnailCandidate: "",
          rawFieldNamesAvailable: "",
          fetchError: error instanceof Error ? error.message : String(error),
        });
        itemsInspected += 1;
        continue;
      }

      const $ = cheerio.load(rawXml, { xmlMode: true });
      const items = $("item").slice(0, itemLimit).toArray();

      for (const item of items) {
        const $item = $(item);
        const { fieldMap, fieldNames } = extractItemFields($item);
        const title = (fieldMap.get("title")?.[0]?.text || "").trim();
        const googleNewsUrl =
          (fieldMap.get("link")?.[0]?.text || "").trim() ||
          (fieldMap.get("guid")?.[0]?.text || "").trim();
        const {
          publisherName,
          publisherDomain,
          publisherUrlCandidate,
          publisherInfoSourceField,
        } = inspectPublisherInfo(fieldMap);
        const thumbnailCandidate = extractThumbnailCandidate(fieldMap);

        itemsInspected += 1;
        if (publisherUrlCandidate) {
          itemsWithPublisherUrlFound += 1;
        } else if (publisherDomain || publisherName) {
          itemsWithPublisherDomainOnly += 1;
        } else {
          itemsWithNoPublisherInfo += 1;
        }

        if (publisherInfoSourceField) {
          fieldsFound.set(
            publisherInfoSourceField,
            (fieldsFound.get(publisherInfoSourceField) || 0) + 1
          );
        }

        sampleRows.push({
          feedName: feed.name || "",
          itemTitle: title,
          googleNewsUrl,
          publisherName,
          publisherDomain,
          publisherUrlCandidate,
          publisherInfoSourceField,
          thumbnailCandidate,
          rawFieldNamesAvailable: fieldNames.join(", "),
        });
      }
    }

    console.log("\n=== Summary ===");
    console.table(
      formatRows([
        {
          feeds_inspected: feeds.length,
          items_inspected: itemsInspected,
          items_with_publisher_url_found: itemsWithPublisherUrlFound,
          items_with_publisher_domain_only: itemsWithPublisherDomainOnly,
          items_with_no_publisher_info: itemsWithNoPublisherInfo,
          fields_where_publisher_info_was_found: Array.from(fieldsFound.keys()).join(", "),
        },
      ])
    );

    console.log("\n=== Sample Rows ===");
    if (!sampleRows.length) {
      console.log("(no sample rows found)");
    } else {
      console.table(formatRows(sampleRows));
    }
  } catch (error) {
    console.error("Failed to inspect raw Google News RSS feeds.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
