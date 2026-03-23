import { batch, db, serverTimestamp } from "../database/firestoreService";
import { TREND_LIMIT_PER_RANGE } from "../config/constants";
import { ArticleRecord } from "../types";
import { subtractDays, toDate } from "../utils/date";
import { makeSlug } from "../utils/text";

const genericTrendLabels = new Set([
  "news",
  "alert",
  "alerts",
  "world",
  "tech",
  "report",
  "update",
  "company",
  "industry",
  "article",
  "monitoring",
  "you",
  "was",
  "get",
  "can",
  "not",
  "decided",
  "england",
  "bank",
  "currency",
  "dollar",
]);

function normalizeTrendLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function isUsefulTrendLabel(label: string): boolean {
  const normalized = normalizeTrendLabel(label).toLowerCase();
  if (!normalized || normalized.length < 4) {
    return false;
  }

  if (genericTrendLabels.has(normalized)) {
    return false;
  }

  if (!normalized.includes(" ") && normalized !== "banknotes") {
    return false;
  }

  return true;
}

function scoreArticles(articles: ArticleRecord[], timeframeDays: number): Array<{
  label: string;
  score: number;
  articleCount: number;
  articleIds: string[];
  sourceCount: number;
}> {
  const bucket = new Map<string, { label: string; articleIds: Set<string>; sources: Set<string>; recency: number; topicBoost: number }>();
  const windowStart = subtractDays(timeframeDays).getTime();

  articles.forEach((article) => {
    if (toDate(article.pubDate).getTime() < windowStart) {
      return;
    }

    const labels = Array.from(new Set([article.topic, ...(article.keywords || [])].filter(Boolean)))
      .map((label) => normalizeTrendLabel(String(label)))
      .filter(isUsefulTrendLabel)
      .slice(0, 3);

    labels.forEach((label, index) => {
      const key = label.toLowerCase();
      const current =
        bucket.get(key) || { label, articleIds: new Set<string>(), sources: new Set<string>(), recency: 0, topicBoost: 0 };
      current.articleIds.add(article.id);
      current.sources.add(article.source);
      current.recency += 1 / Math.max(1, (Date.now() - toDate(article.pubDate).getTime()) / (1000 * 60 * 60));
      if (index === 0 && label.toLowerCase() === String(article.topic || "").toLowerCase()) {
        current.topicBoost += 2;
      }
      bucket.set(key, current);
    });
  });

  return Array.from(bucket.entries())
    .map(([, entry]) => ({
      label: entry.label,
      score: entry.articleIds.size * 3 + entry.sources.size * 2 + entry.recency + entry.topicBoost,
      articleCount: entry.articleIds.size,
      articleIds: Array.from(entry.articleIds).slice(0, 25),
      sourceCount: entry.sources.size,
    }))
    .filter((entry) => entry.articleCount >= 2 || entry.sourceCount >= 2)
    .sort((left, right) => right.score - left.score)
    .slice(0, TREND_LIMIT_PER_RANGE);
}

export async function rebuildTrends(articles: ArticleRecord[]) {
  const timeframes: Array<{ key: "24h" | "7d" | "30d"; days: number }> = [
    { key: "24h", days: 1 },
    { key: "7d", days: 7 },
    { key: "30d", days: 30 },
  ];

  for (const { key, days } of timeframes) {
    const existingSnapshot = await db.collection("trends").where("timeframe", "==", key).get();
    const writeBatch = batch();

    existingSnapshot.docs.forEach((doc) => writeBatch.delete(doc.ref));

    scoreArticles(articles, days).forEach((trend) => {
      writeBatch.set(db.collection("trends").doc(`${key}-${makeSlug(trend.label)}`), {
        label: trend.label,
        score: Number(trend.score.toFixed(2)),
        articleCount: trend.articleCount,
        articleIds: trend.articleIds,
        sourceCount: trend.sourceCount,
        timeframe: key,
        updatedAt: serverTimestamp(),
      });
    });

    await writeBatch.commit();
  }
}
