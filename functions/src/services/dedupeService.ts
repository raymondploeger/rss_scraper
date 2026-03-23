import { DedupeMatch, ArticleRecord, DuplicateMatcher } from "../types";
import { hoursBetween } from "../utils/date";
import { similarityScore } from "../utils/text";
import { findByCanonicalLink, findByHash, listRecentArticles } from "./articleService";

function buildMatch(existing: ArticleRecord): DedupeMatch {
  return {
    isDuplicate: true,
    representativeId: existing.id,
    duplicateGroupId: existing.duplicateGroupId || existing.id,
  };
}

export async function createDuplicateMatcher(): Promise<DuplicateMatcher> {
  const recentArticles = await listRecentArticles();
  const canonicalMap = new Map<string, ArticleRecord>();
  const hashMap = new Map<string, ArticleRecord>();

  recentArticles.forEach((article) => {
    if (article.canonicalLink) {
      canonicalMap.set(article.canonicalLink, article);
    }
    if (article.hash) {
      hashMap.set(article.hash, article);
    }
  });

  return {
    detect(article: ArticleRecord): DedupeMatch {
      const byCanonical = canonicalMap.get(article.canonicalLink);
      if (byCanonical) {
        return buildMatch(byCanonical);
      }

      const byHash = hashMap.get(article.hash);
      if (byHash) {
        return buildMatch(byHash);
      }

      const fuzzyMatch = recentArticles.find((candidate) => {
        const score = similarityScore(article.normalizedTitle, candidate.normalizedTitle || "");
        const closeInTime = hoursBetween(article.pubDate, candidate.pubDate) <= 18;
        const sameSource = candidate.source.toLowerCase() === article.source.toLowerCase();
        return score >= 0.8 && (closeInTime || sameSource);
      });

      return fuzzyMatch ? buildMatch(fuzzyMatch) : { isDuplicate: false, representativeId: null, duplicateGroupId: null };
    },
    remember(article: ArticleRecord) {
      recentArticles.unshift(article);
      if (article.canonicalLink) {
        canonicalMap.set(article.canonicalLink, article);
      }
      if (article.hash) {
        hashMap.set(article.hash, article);
      }
    },
  };
}

export async function detectDuplicate(article: ArticleRecord): Promise<DedupeMatch> {
  const byCanonical = await findByCanonicalLink(article.canonicalLink);
  if (byCanonical) {
    return buildMatch(byCanonical);
  }

  const byHash = await findByHash(article.hash);
  if (byHash) {
    return buildMatch(byHash);
  }

  const candidates = await listRecentArticles();
  const fuzzyMatch = candidates.find((candidate) => {
    const score = similarityScore(article.normalizedTitle, candidate.normalizedTitle || "");
    const closeInTime = hoursBetween(article.pubDate, candidate.pubDate) <= 18;
    const sameSource = candidate.source.toLowerCase() === article.source.toLowerCase();
    return score >= 0.8 && (closeInTime || sameSource);
  });

  if (fuzzyMatch) {
    return buildMatch(fuzzyMatch);
  }

  return {
    isDuplicate: false,
    representativeId: null,
    duplicateGroupId: null,
  };
}
