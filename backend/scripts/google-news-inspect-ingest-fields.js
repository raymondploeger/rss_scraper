import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";
import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../src/config/env.js";
import {
  canonicalizeUrl,
  inferKeywords,
  normalizeText,
  normalizeTitle,
  resolveArticleLink,
  sanitizeFeedText,
} from "../src/utils/text.js";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../.env");
const prismaSchemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
  process.exit(1);
}

const parser = new Parser({
  timeout: env.requestTimeoutMs,
  headers: {
    "User-Agent": "RSS Monitor Dashboard/2.0"
  },
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: true }],
      ["media:thumbnail", "media:thumbnail", { keepArray: true }],
      ["content:encoded", "content:encoded"],
      ["dc:subject", "dc:subject", { keepArray: true }],
      ["wp:term", "wp:term", { keepArray: true }],
      ["itunes:image", "itunes:image"],
      ["image", "image"],
      ["image:url", "image:url"],
      ["thumbnail", "thumbnail"],
      ["source", "source", { keepArray: true }],
    ]
  }
});

const client = new Client({
  connectionString: databaseUrl,
  application_name: "google-news-inspect-ingest-fields",
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

function extractFeedImageCandidate(link, candidate) {
  const normalized = String(candidate || "").trim();
  if (!normalized || normalized.startsWith("data:")) {
    return "";
  }

  try {
    return new URL(normalized, link).toString();
  } catch {
    return normalized;
  }
}

function collectImageCandidates(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectImageCandidates(entry));
  }

  if (typeof value !== "object") {
    return [];
  }

  return [
    value.url,
    value.href,
    value.src,
    value.$?.url,
    value.$?.href,
    value.$?.src,
    value["@_url"],
    value["@_href"],
    value["@_src"],
    value._,
  ]
    .filter(Boolean)
    .flatMap((entry) => collectImageCandidates(entry));
}

function findFirstImageCandidate(link, values) {
  const candidate = values
    .flatMap((value) => collectImageCandidates(value))
    .find((entry) => String(entry || "").trim());

  return candidate ? extractFeedImageCandidate(link, candidate) : "";
}

function extractImageFromHtml(html) {
  const markup = String(html || "");
  const match = markup.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || "";
}

function extractFeedThumbnail(link, item) {
  const mediaContentCandidate = findFirstImageCandidate(link, [item["media:content"], item.mediaContent]);
  if (mediaContentCandidate) return { url: mediaContentCandidate, source: "rss-media-content" };

  const mediaThumbnailCandidate = findFirstImageCandidate(link, [item["media:thumbnail"], item.mediaThumbnail]);
  if (mediaThumbnailCandidate) return { url: mediaThumbnailCandidate, source: "rss-media-thumbnail" };

  const directImageCandidate = findFirstImageCandidate(link, [
    item.image,
    item.imageUrl,
    item["image:url"],
    item.thumbnail,
    item["itunes:image"],
  ]);
  if (directImageCandidate) return { url: directImageCandidate, source: "rss-image-field" };

  const contentEncodedImage = extractFeedImageCandidate(link, extractImageFromHtml(item["content:encoded"] || item.content));
  if (contentEncodedImage) return { url: contentEncodedImage, source: "rss-content-encoded" };

  const descriptionImage = extractFeedImageCandidate(link, extractImageFromHtml(item.description || item.summary));
  if (descriptionImage) return { url: descriptionImage, source: "rss-description-image" };

  return { url: "", source: "placeholder" };
}

function collectTagCandidates(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(collectTagCandidates);
  if (typeof value === "string") return [value];
  if (typeof value === "object") {
    return [
      value._,
      value.name,
      value.term,
      value.label,
      value.$?.term,
      value.$?.label,
      value["@_term"],
      value["@_label"],
    ].flatMap(collectTagCandidates);
  }
  return [];
}

function normalizeArticleTags(item) {
  const candidates = [
    item.category,
    item.categories,
    item["dc:subject"],
    item.dcSubject,
    item.subject,
    item["wp:term"],
    item.wpTerm
  ].flatMap(collectTagCandidates);

  return Array.from(
    new Set(
      candidates
        .map((tag) => sanitizeFeedText(tag, ""))
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter((tag) => tag.length >= 2 && tag.length <= 80)
    )
  );
}

function extractAtomLinkHref(linkValue) {
  if (!linkValue) return "";
  if (typeof linkValue === "string") return linkValue;
  if (Array.isArray(linkValue)) {
    for (const entry of linkValue) {
      const href = extractAtomLinkHref(entry);
      if (href) return href;
    }
    return "";
  }
  if (typeof linkValue === "object") {
    if (typeof linkValue.href === "string" && linkValue.href.trim()) return linkValue.href;
    if (typeof linkValue.url === "string" && linkValue.url.trim()) return linkValue.url;
    if (linkValue.$ && typeof linkValue.$.href === "string" && linkValue.$.href.trim()) return linkValue.$.href;
  }
  return "";
}

function resolveItemLink(item) {
  const candidates = [
    item?.link,
    item?.guid,
    item?.id,
    item?.url,
    extractAtomLinkHref(item?.link),
    extractAtomLinkHref(item?.links),
    extractAtomLinkHref(item?.atomLink),
  ];

  for (const candidate of candidates) {
    const resolved = resolveArticleLink(normalizeText(candidate));
    if (resolved) {
      return resolved;
    }
  }

  return "";
}

function getSourceName(link) {
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function extractRawSourceFields(itemNode, $) {
  const sourceNode = $(itemNode).children("source").first();
  const sourceName = String(sourceNode.text() || "").trim();
  const sourceUrl = String(sourceNode.attr("url") || sourceNode.attr("href") || "").trim();
  return {
    sourceName,
    sourceUrl,
  };
}

function inspectParserSource(item) {
  const sourceValue = item?.source;
  if (!sourceValue) {
    return {
      parserSourceShape: "",
      parserSourceName: "",
      parserSourceUrl: "",
    };
  }

  const entries = Array.isArray(sourceValue) ? sourceValue : [sourceValue];
  const first = entries[0] || {};
  return {
    parserSourceShape: Array.isArray(sourceValue) ? "array" : typeof sourceValue,
    parserSourceName: sanitizeFeedText(
      typeof first === "string" ? first : first?._ || first?.text || first?.name || "",
      ""
    ),
    parserSourceUrl:
      (typeof first === "object" && (first?.url || first?.href || first?.$?.url || first?.$?.href || first?.["@_url"])) || "",
  };
}

function normalizeDiagnosticItem(feed, item) {
  const link = resolveItemLink(item);
  const contentSnippet = sanitizeFeedText(item.contentSnippet || item.content || item.summary || item.description, "");
  const title = sanitizeFeedText(item.title, "Untitled Article");
  const extractedThumbnail = extractFeedThumbnail(link, item);
  const thumbnail = normalizeText(extractedThumbnail.url || feed.sourceFallbackImage || "", env.placeholderImage);
  const canonicalLink = canonicalizeUrl(link);
  const source = sanitizeFeedText(item.creator || item.author || getSourceName(link), "Unknown");
  const tags = normalizeArticleTags(item);
  const keywords = Array.from(new Set([...tags, ...inferKeywords([title, contentSnippet, feed.topic], 6)]));

  return {
    title,
    link,
    canonicalLink,
    source,
    thumbnail,
    thumbnailSource: extractedThumbnail.source,
    contentSnippet,
    keywordCount: keywords.length,
  };
}

function readArticleModelFields() {
  const schema = fs.readFileSync(prismaSchemaPath, "utf8");
  const modelMatch = schema.match(/model\s+Article\s+\{([\s\S]*?)\n\}/);
  if (!modelMatch) {
    return [];
  }

  return modelMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
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
        "sourceFallbackImage",
        "isActive"
      FROM feeds
      WHERE "isActive" = true
      ORDER BY "createdAt" DESC
    `
  );

  return result.rows.filter(isGoogleNewsFeed).slice(0, 3);
}

async function main() {
  try {
    await client.connect();
    const feeds = await loadGoogleNewsFeeds();
    const articleModelFields = readArticleModelFields();
    const relevantArticleFields = articleModelFields.filter((field) =>
      ["link", "canonicalLink", "source", "thumbnail", "feedName", "topic", "contentSnippet", "author"].includes(field)
    );

    console.log("\n=== Google News Ingest Field Inspection ===");
    console.table(
      formatRows([
        {
          feeds_selected: feeds.length,
          article_model_fields_relevant: relevantArticleFields.join(", "),
          schema_change_appears_necessary: !articleModelFields.includes("sourceUrl") && !articleModelFields.includes("publisherUrl"),
        },
      ])
    );

    const rows = [];
    let itemsInspected = 0;
    let sourceUrlAvailableAfterParsing = 0;
    let sourceUrlIgnoredByNormalization = 0;

    for (const feed of feeds) {
      try {
        const rawXml = await fetchRawXml(feed.rssUrl);
        const $xml = cheerio.load(rawXml, { xmlMode: true });
        const rawItems = $xml("item").slice(0, 10).toArray();
        const parsedFeed = await parser.parseString(rawXml);
        const parsedItems = Array.isArray(parsedFeed.items) ? parsedFeed.items.slice(0, 10) : [];
        const maxCount = Math.min(rawItems.length, parsedItems.length, 10);

        for (let index = 0; index < maxCount; index += 1) {
          const rawItem = rawItems[index];
          const parsedItem = parsedItems[index];
          const rawTitle = $xml(rawItem).children("title").first().text().trim();
          const rawLink = $xml(rawItem).children("link").first().text().trim();
          const rawGuid = $xml(rawItem).children("guid").first().text().trim();
          const rawSource = extractRawSourceFields(rawItem, $xml);
          const parserSource = inspectParserSource(parsedItem);
          const normalized = normalizeDiagnosticItem(feed, parsedItem);

          itemsInspected += 1;
          if (rawSource.sourceUrl || parserSource.parserSourceUrl) {
            sourceUrlAvailableAfterParsing += 1;
          }
          if ((rawSource.sourceUrl || parserSource.parserSourceUrl) && !normalized.canonicalLink.includes(rawSource.sourceUrl || parserSource.parserSourceUrl)) {
            sourceUrlIgnoredByNormalization += 1;
          }

          rows.push({
            feedName: feed.name || "",
            rawTitle,
            rawLink,
            rawGuid,
            rawSourceName: rawSource.sourceName,
            rawSourceUrl: rawSource.sourceUrl,
            parserSourceShape: parserSource.parserSourceShape,
            parserSourceName: parserSource.parserSourceName,
            parserSourceUrl: parserSource.parserSourceUrl,
            storedTitle: normalized.title,
            storedLink: normalized.link,
            storedCanonicalLink: normalized.canonicalLink,
            storedSource: normalized.source,
            publisherOrSourceUrlFieldPresentInArticleModel: articleModelFields.find((field) =>
              ["sourceUrl", "publisherUrl", "originalUrl"].includes(field)
            ) || "",
            thumbnailCandidatePassedIntoThumbnailEnrichment: normalized.thumbnail,
            thumbnailCandidateSource: normalized.thumbnailSource,
            urlPassedIntoThumbnailEnrichment: normalized.link,
          });
        }
      } catch (error) {
        rows.push({
          feedName: feed.name || "",
          rawTitle: "[feed inspection failed]",
          rawLink: feed.rssUrl || "",
          rawGuid: "",
          rawSourceName: "",
          rawSourceUrl: "",
          parserSourceShape: "",
          parserSourceName: "",
          parserSourceUrl: "",
          storedTitle: "",
          storedLink: "",
          storedCanonicalLink: "",
          storedSource: "",
          publisherOrSourceUrlFieldPresentInArticleModel: "",
          thumbnailCandidatePassedIntoThumbnailEnrichment: "",
          thumbnailCandidateSource: "",
          urlPassedIntoThumbnailEnrichment: "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("\n=== Ingest Summary ===");
    console.table(
      formatRows([
        {
          items_inspected: itemsInspected,
          source_url_available_after_rss_parser: sourceUrlAvailableAfterParsing,
          source_url_ignored_by_normalization: sourceUrlIgnoredByNormalization,
          can_thumbnail_extraction_receive_source_url_without_schema_change: true,
          can_store_source_url_without_schema_change: false,
          smallest_safe_schema_change_if_needed: "add nullable Article.sourceUrl or Article.publisherUrl field",
        },
      ])
    );

    console.log("\n=== Sample Rows ===");
    console.table(formatRows(rows.slice(0, 10)));
  } catch (error) {
    console.error("Failed to inspect Google News ingest fields.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
