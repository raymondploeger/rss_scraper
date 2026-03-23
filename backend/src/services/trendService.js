import { listArticlesForTrends } from "../database/articleRepository.js";
import { inferKeywords, normalizeText } from "../utils/text.js";

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
  "monitoring"
]);

function subtractDays(days) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value;
}

function isUsefulTrendLabel(label) {
  const normalized = normalizeText(label, "").toLowerCase();
  if (!normalized || normalized.length < 4) {
    return false;
  }

  return !genericTrendLabels.has(normalized);
}

export async function listTrends(timeframe = "24h") {
  const days = timeframe === "30d" ? 30 : timeframe === "7d" ? 7 : 1;
  const articles = await listArticlesForTrends({ since: subtractDays(days), limit: 400 });

  const buckets = new Map();
  articles.forEach((article) => {
    const labels = new Set([article.topic, ...inferKeywords([article.title, article.contentSnippet, article.topic], 5)]);
    labels.forEach((label) => {
      const normalized = normalizeText(label, "");
      if (!isUsefulTrendLabel(normalized)) {
        return;
      }

      const key = normalized.toLowerCase();
      const current = buckets.get(key) || {
        id: `${timeframe}-${key.replace(/\s+/g, "-")}`,
        label: normalized,
        score: 0,
        articleCount: 0,
        articleIds: [],
        sourceSet: new Set(),
        timeframe
      };
      current.articleCount += 1;
      current.articleIds.push(String(article._id));
      current.sourceSet.add(article.source);
      current.score += 1 + Math.max(0, 7 - days);
      buckets.set(key, current);
    });
  });

  return Array.from(buckets.values())
    .map((item) => ({
      id: item.id,
      label: item.label,
      score: item.score + item.sourceSet.size * 0.5,
      articleCount: item.articleCount,
      articleIds: item.articleIds,
      sourceCount: item.sourceSet.size,
      timeframe
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}
