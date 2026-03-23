import { createHash } from "./hash";

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "from",
  "this",
  "have",
  "your",
  "into",
  "about",
  "after",
  "their",
  "they",
  "will",
  "would",
  "said",
  "over",
  "more",
  "than",
  "been",
  "also",
  "into",
  "amid",
  "under",
  "news",
  "alert",
]);

export function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

export function sanitizeFeedText(value: unknown, fallback = ""): string {
  const normalized = normalizeText(value, fallback);
  if (!normalized) {
    return fallback;
  }

  const withoutTags = stripHtml(normalized);
  const decoded = decodeHtmlEntities(withoutTags);
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed || fallback;
}

export function normalizeTitle(value: string): string {
  return sanitizeFeedText(value)
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/^(breaking|watch|analysis|live|update):\s+/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveArticleLink(link: string): string {
  try {
    const parsed = new URL(link);
    const isGoogleRedirect =
      parsed.hostname.includes("google.") && parsed.pathname === "/url" && parsed.searchParams.has("url");

    if (isGoogleRedirect) {
      return parsed.searchParams.get("url") || link;
    }

    return parsed.toString();
  } catch {
    return link;
  }
}

export function canonicalizeUrl(link: string): string {
  try {
    const parsed = new URL(resolveArticleLink(link));
    parsed.hash = "";
    const removalKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ved"];
    removalKeys.forEach((key) => parsed.searchParams.delete(key));
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    return parsed.toString();
  } catch {
    return link.trim();
  }
}

export function resolveUrl(baseUrl: string, candidate: string): string {
  const normalizedCandidate = normalizeText(candidate, "");
  if (!normalizedCandidate) {
    return "";
  }

  if (normalizedCandidate.startsWith("//")) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}${normalizedCandidate}`;
    } catch {
      return normalizedCandidate;
    }
  }

  try {
    return new URL(normalizedCandidate, baseUrl).toString();
  } catch {
    return normalizedCandidate;
  }
}

export function tokenize(value: string): string[] {
  return normalizeTitle(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function similarityScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function createArticleHash(
  normalizedTitle: string,
  source: string,
  pubDate: string,
): string {
  const bucket = new Date(pubDate);
  bucket.setMinutes(0, 0, 0);
  return createHash(`${normalizedTitle}::${source.toLowerCase()}::${bucket.toISOString()}`);
}

export function inferKeywords(values: string[], maxCount = 8): string[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    tokenize(value).forEach((token) => {
      counts.set(token, (counts.get(token) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxCount)
    .map(([token]) => token);
}

export function makeSlug(value: string): string {
  return normalizeTitle(value).replace(/\s+/g, "-") || "item";
}
