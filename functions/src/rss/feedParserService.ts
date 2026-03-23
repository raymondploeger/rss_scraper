import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { FEED_TIMEOUT_MS, USER_AGENT } from "../config/constants";
import { ParsedFeedItem } from "../types";
import { normalizeText, resolveArticleLink, sanitizeFeedText } from "../utils/text";

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
  },
});

function resolveSource(parsedFeedTitle: string | undefined, item: Record<string, unknown>, link: string): string {
  if (typeof item.source === "string" && item.source.trim()) {
    return item.source.trim();
  }

  if (item.source && typeof item.source === "object") {
    const sourceObject = item.source as { title?: string };
    if (typeof sourceObject.title === "string" && sourceObject.title.trim()) {
      return sourceObject.title.trim();
    }
  }

  if (typeof item.creator === "string" && item.creator.trim()) {
    return item.creator.trim();
  }

  if (typeof item.author === "string" && item.author.trim()) {
    return item.author.trim();
  }

  if (parsedFeedTitle && parsedFeedTitle.trim()) {
    return parsedFeedTitle.trim();
  }

  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function extractFeedThumbnail(link: string, item: Record<string, unknown>): string {
  const mediaThumbnail =
    item["media:thumbnail"] && typeof item["media:thumbnail"] === "object"
      ? (item["media:thumbnail"] as { $?: { url?: string }; url?: string })
      : null;

  const candidates = [
    item.enclosure && typeof item.enclosure === "object" ? (item.enclosure as { url?: string }).url : "",
    item.thumbnail && typeof item.thumbnail === "object" ? (item.thumbnail as { url?: string }).url : "",
    mediaThumbnail?.$?.url || mediaThumbnail?.url || "",
  ];

  const htmlContent = normalizeText(item["content:encoded"] || item.content || item.summary || item.description, "");
  if (htmlContent) {
    const $ = cheerio.load(htmlContent);
    const imageFromHtml = $("img").first().attr("src") || $("img").first().attr("data-src") || "";
    candidates.push(imageFromHtml);
  }

  const firstCandidate = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (!firstCandidate) {
    return "";
  }

  try {
    return new URL(firstCandidate, link).toString();
  } catch {
    return firstCandidate;
  }
}

export async function parseFeed(rssUrl: string): Promise<{ title: string; items: ParsedFeedItem[] }> {
  const parsed = await parser.parseURL(rssUrl);
  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const link = resolveArticleLink(normalizeText(item.link));
      if (!link) {
        return null;
      }

      return {
        title: sanitizeFeedText(item.title, "Untitled Article"),
        link,
        pubDate: new Date(String(item.isoDate || item.pubDate || new Date().toISOString())).toISOString(),
        source: resolveSource(parsed.title, item, link),
        contentSnippet: sanitizeFeedText(item.contentSnippet || item.content || item.summary, ""),
        author: sanitizeFeedText(item.creator || item.author, ""),
        thumbnail: normalizeText(extractFeedThumbnail(link, item), ""),
      };
    })
    .filter((item): item is ParsedFeedItem => Boolean(item));

  return {
    title: normalizeText(parsed.title, "Untitled Feed"),
    items,
  };
}
