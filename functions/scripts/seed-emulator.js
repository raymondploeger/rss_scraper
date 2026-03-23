const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

const defaultSeedPath = path.join(__dirname, "seed-data.json");
const fallbackSeedPath = path.join(__dirname, "seed-data.example.json");

function ensureEmulator() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }
}

function loadSeedData() {
  const customPath = process.argv[2];
  const candidatePaths = [
    customPath ? path.resolve(process.cwd(), customPath) : null,
    defaultSeedPath,
    fallbackSeedPath,
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return {
        path: candidate,
        data: JSON.parse(fs.readFileSync(candidate, "utf8")),
      };
    }
  }

  throw new Error(
    `No seed data found. Create ${defaultSeedPath} or pass a custom JSON file path.`
  );
}

function createArticleId(link) {
  return crypto.createHash("sha256").update(String(link).trim().toLowerCase()).digest("hex");
}

function normalizeDate(value) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function seedFeeds(db, feeds) {
  let count = 0;

  for (const feed of feeds) {
    const id = feed.id || db.collection("feeds").doc().id;
    const name = String(feed.name || "Untitled Feed").trim();
    const doc = {
      name,
      rssUrl: String(feed.rssUrl || "").trim(),
      topic: String(feed.topic || name).trim() || name,
      sourceType: String(feed.sourceType || "rss").trim(),
      isActive: feed.isActive !== false,
      createdAt: normalizeDate(feed.createdAt),
      updatedAt: normalizeDate(feed.updatedAt || feed.createdAt),
      lastStatus: feed.lastStatus || "idle",
      lastFetchedAt: feed.lastFetchedAt ? normalizeDate(feed.lastFetchedAt) : null,
      lastInsertedCount: Number(feed.lastInsertedCount || 0),
      lastError: feed.lastError || null,
    };

    await db.collection("feeds").doc(id).set(doc, { merge: true });
    count += 1;
  }

  return count;
}

async function seedArticles(db, articles) {
  let count = 0;

  for (const article of articles) {
    if (!article.link) {
      continue;
    }

    const id = article.id || createArticleId(article.link);
    const createdAt = normalizeDate(article.createdAt || article.pubDate);
    const pubDate = normalizeDate(article.pubDate || article.createdAt);

    const doc = {
      id,
      title: String(article.title || "Untitled Article").trim(),
      normalizedTitle: String(article.normalizedTitle || article.title || "untitled article").trim().toLowerCase(),
      link: String(article.link).trim(),
      canonicalLink: String(article.canonicalLink || article.link).trim(),
      pubDate,
      source: String(article.source || "Unknown").trim(),
      topic: String(article.topic || "General").trim(),
      thumbnail: String(article.thumbnail || "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image").trim(),
      summary: String(article.summary || "").trim(),
      summaryShort: String(article.summaryShort || "").trim(),
      keywords: Array.isArray(article.keywords) ? article.keywords : [],
      updatedAt: normalizeDate(article.updatedAt || article.createdAt || article.pubDate),
      contentSnippet: String(article.contentSnippet || "").trim(),
      author: String(article.author || "").trim(),
      clusterId: article.clusterId || null,
      duplicateGroupId: article.duplicateGroupId || null,
      isDuplicate: article.isDuplicate === true,
      duplicateOf: article.duplicateOf || null,
      hash: String(article.hash || createArticleId(article.link)).trim(),
      language: String(article.language || "unknown").trim(),
      sentimentOptional: article.sentimentOptional || null,
      fetchStatus: String(article.fetchStatus || "pending").trim(),
      feedId: String(article.feedId || "").trim(),
      createdAt,
    };

    await db.collection("articles").doc(id).set(doc, { merge: true });
    count += 1;
  }

  return count;
}

async function seedClusters(db, clusters) {
  let count = 0;

  for (const cluster of clusters) {
    const id = cluster.id || db.collection("clusters").doc().id;
    const createdAt = normalizeDate(cluster.createdAt || cluster.updatedAt || new Date().toISOString());
    const updatedAt = normalizeDate(cluster.updatedAt || cluster.createdAt || new Date().toISOString());
    const latestPubDate = normalizeDate(cluster.latestPubDate || updatedAt);

    await db.collection("clusters").doc(id).set(
      {
        clusterTitle: String(cluster.clusterTitle || "Untitled Cluster").trim(),
        representativeArticleId: String(cluster.representativeArticleId || "").trim(),
        articleIds: Array.isArray(cluster.articleIds) ? cluster.articleIds : [],
        topic: String(cluster.topic || "General").trim(),
        sourceCount: Number(cluster.sourceCount || 0),
        articleCount: Number(cluster.articleCount || (Array.isArray(cluster.articleIds) ? cluster.articleIds.length : 0)),
        latestPubDate,
        createdAt,
        updatedAt,
        summaryShort: String(cluster.summaryShort || "").trim(),
        keywords: Array.isArray(cluster.keywords) ? cluster.keywords : [],
      },
      { merge: true }
    );

    count += 1;
  }

  return count;
}

async function seedTrends(db, trends) {
  let count = 0;

  for (const trend of trends) {
    const id = trend.id || db.collection("trends").doc().id;
    const updatedAt = normalizeDate(trend.updatedAt || new Date().toISOString());

    await db.collection("trends").doc(id).set(
      {
        label: String(trend.label || "trend").trim(),
        score: Number(trend.score || 0),
        articleCount: Number(trend.articleCount || 0),
        articleIds: Array.isArray(trend.articleIds) ? trend.articleIds : [],
        sourceCount: Number(trend.sourceCount || 0),
        timeframe: String(trend.timeframe || "24h").trim(),
        updatedAt,
      },
      { merge: true }
    );

    count += 1;
  }

  return count;
}

async function main() {
  ensureEmulator();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: "demo-rss-monitor" });
  }

  const db = admin.firestore();
  const { path: seedPath, data } = loadSeedData();
  const feeds = Array.isArray(data.feeds) ? data.feeds : [];
  const articles = Array.isArray(data.articles) ? data.articles : [];
  const clusters = Array.isArray(data.clusters) ? data.clusters : [];
  const trends = Array.isArray(data.trends) ? data.trends : [];

  const feedCount = await seedFeeds(db, feeds);
  const articleCount = await seedArticles(db, articles);
  const clusterCount = await seedClusters(db, clusters);
  const trendCount = await seedTrends(db, trends);

  console.log(
    `Seeded ${feedCount} feeds, ${articleCount} articles, ${clusterCount} clusters, and ${trendCount} trends from ${seedPath}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
