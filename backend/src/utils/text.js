import crypto from "crypto";

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
  "amid",
  "under",
  "news",
  "alert"
]);

export function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

export function decodeHtmlEntities(value) {
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

export function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

export function sanitizeFeedText(value, fallback = "") {
  const normalized = normalizeText(value, fallback);
  if (!normalized) {
    return fallback;
  }

  const withoutTags = stripHtml(normalized);
  const decoded = decodeHtmlEntities(withoutTags);
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed || fallback;
}

export function normalizeTitle(value) {
  return sanitizeFeedText(value)
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/^(breaking|watch|analysis|live|update):\s+/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveArticleLink(link) {
  try {
    const parsed = new URL(link);
    const isGoogleRedirect =
      parsed.hostname.includes("google.") && parsed.pathname === "/url" && parsed.searchParams.has("url");
    const isBingNewsRedirect =
      parsed.hostname.replace(/^www\./, "").toLowerCase() === "bing.com" &&
      parsed.pathname.toLowerCase() === "/news/apiclick.aspx" &&
      parsed.searchParams.has("url");

    if (isGoogleRedirect) {
      return parsed.searchParams.get("url") || link;
    }
    if (isBingNewsRedirect) {
      return parsed.searchParams.get("url") || link;
    }

    return parsed.toString();
  } catch {
    return link;
  }
}

export function canonicalizeUrl(link) {
  try {
    const parsed = new URL(resolveArticleLink(link));
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ved"].forEach((key) =>
      parsed.searchParams.delete(key)
    );
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    return parsed.toString();
  } catch {
    return String(link || "").trim();
  }
}

export function resolveUrl(baseUrl, candidate) {
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

export function tokenize(value) {
  return normalizeTitle(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function inferKeywords(values, maxCount = 8) {
  const counts = new Map();
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

export function createDeterministicId(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}
