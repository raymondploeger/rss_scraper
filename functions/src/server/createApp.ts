import cors from "cors";
import express from "express";
import helmet from "helmet";
import axios from "axios";
import { db } from "../database/firestoreService";
import { processArticleBacklog, refreshFeeds } from "../services/ingestionService";
import { createFeed, deleteFeed, feedExistsByRssUrl, listFeeds, restoreFeedsFromBackup, updateFeed } from "../services/feedService";
import { listArticles } from "../services/articleService";
import { toDate } from "../utils/date";
import { canonicalizeUrl, normalizeText } from "../utils/text";
import { MAX_ARTICLES_PER_QUERY, PLACEHOLDER_THUMBNAIL, USER_AGENT } from "../config/constants";

function filterArticles(
  items: Array<Record<string, unknown>>,
  filters: {
    search: string;
    topic: string;
    feedId: string;
    from: string;
    to: string;
    showDuplicates: boolean;
  },
) {
  return items
    .filter((article) => {
      if (!filters.showDuplicates && article.isDuplicate === true) {
        return false;
      }

      if (filters.topic && String(article.topic || "").toLowerCase() !== filters.topic.toLowerCase()) {
        return false;
      }

      if (filters.feedId && String(article.feedId || "") !== filters.feedId) {
        return false;
      }

      if (filters.from && toDate(article.pubDate) < new Date(filters.from)) {
        return false;
      }

      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        if (toDate(article.pubDate) > end) {
          return false;
        }
      }

      if (filters.search) {
        const query = filters.search.toLowerCase();
        const values = [article.title, article.source, article.topic, ...(Array.isArray(article.keywords) ? article.keywords : [])];
        if (!values.some((value) => String(value || "").toLowerCase().includes(query))) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime())
    .slice(0, MAX_ARTICLES_PER_QUERY);
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get("/api/feeds", async (_request, response) => {
    response.json(await listFeeds());
  });

  app.get("/api/articles", async (request, response) => {
    const items = await listArticles();
    response.json(
      filterArticles(items, {
        search: normalizeText(request.query.search, ""),
        topic: normalizeText(request.query.topic, ""),
        feedId: normalizeText(request.query.feedId, ""),
        from: normalizeText(request.query.from, ""),
        to: normalizeText(request.query.to, ""),
        showDuplicates: String(request.query.showDuplicates || "") === "true",
      }),
    );
  });

  app.get("/api/clusters", async (_request, response) => {
    const snapshot = await db.collection("clusters").orderBy("latestPubDate", "desc").limit(100).get();
    response.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });

  app.get("/api/trends", async (request, response) => {
    const timeframe = normalizeText(request.query.timeframe, "24h");
    const snapshot = await db
      .collection("trends")
      .where("timeframe", "==", timeframe)
      .orderBy("score", "desc")
      .limit(20)
      .get();
    response.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });

  app.get("/api/dashboard/summary", async (_request, response) => {
    const [feedsSnapshot, articlesSnapshot, clustersSnapshot] = await Promise.all([
      db.collection("feeds").limit(50).get(),
      db.collection("articles").orderBy("pubDate", "desc").limit(MAX_ARTICLES_PER_QUERY).get(),
      db.collection("clusters").orderBy("latestPubDate", "desc").limit(100).get(),
    ]);

    const feeds = feedsSnapshot.docs.map((doc) => doc.data());
    const articles = articlesSnapshot.docs.map((doc) => doc.data());
    const clusters = clustersSnapshot.docs.map((doc) => doc.data());
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    response.json({
      totalFeeds: feeds.length,
      activeFeeds: feeds.filter((feed) => feed.isActive !== false).length,
      articlesToday: articles.filter((article) => toDate(article.pubDate) >= startOfToday).length,
      failedFeeds: feeds.filter((feed) => feed.lastStatus === "error").length,
      topics: new Set(feeds.map((feed) => feed.topic).filter(Boolean)).size,
      activeClusters: clusters.length,
      duplicatesHidden: articles.filter((article) => article.isDuplicate).length,
    });
  });

  app.get("/api/image", async (request, response) => {
    const targetUrl = normalizeText(request.query.url, "");
    if (!targetUrl) {
      response.status(400).json({ error: "Image URL is required." });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(canonicalizeUrl(targetUrl));
    } catch {
      response.status(400).json({ error: "Invalid image URL." });
      return;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      response.status(400).json({ error: "Unsupported image protocol." });
      return;
    }

    try {
      const upstream = await axios.get(parsedUrl.toString(), {
        responseType: "stream",
        timeout: 12000,
        maxRedirects: 5,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType = String(upstream.headers["content-type"] || "");
      if (!contentType.startsWith("image/")) {
        response.redirect(302, PLACEHOLDER_THUMBNAIL);
        return;
      }

      response.setHeader("Content-Type", contentType);
      response.setHeader("Cache-Control", "public, max-age=86400");
      const contentLength = upstream.headers["content-length"];
      if (contentLength) {
        response.setHeader("Content-Length", String(contentLength));
      }

      upstream.data.pipe(response);
    } catch {
      response.redirect(302, PLACEHOLDER_THUMBNAIL);
    }
  });

  app.post("/api/admin/feeds", async (request, response) => {
    try {
      const name = normalizeText(request.body?.name, "");
      const rssUrl = normalizeText(request.body?.rssUrl, "");
      const topic = normalizeText(request.body?.topic, normalizeText(request.body?.name, ""));

      if (!rssUrl) {
        response.status(400).json({ error: "RSS URL is required." });
        return;
      }

      if (await feedExistsByRssUrl(rssUrl)) {
        response.status(409).json({ error: "This RSS feed is already in the dashboard." });
        return;
      }

      const feed = await createFeed({
        name,
        rssUrl,
        topic,
        sourceType: normalizeText(request.body?.sourceType, "rss"),
        isActive: request.body?.isActive !== false,
      });
      response.status(201).json(feed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create feed";
      const statusCode = message.includes("already exists") ? 409 : 400;
      response.status(statusCode).json({ error: message });
    }
  });

  app.put("/api/admin/feeds/:feedId", async (request, response) => {
    try {
      const feed = await updateFeed(request.params.feedId, {
        name: normalizeText(request.body?.name, ""),
        rssUrl: normalizeText(request.body?.rssUrl, ""),
        topic: normalizeText(request.body?.topic, normalizeText(request.body?.name, "")),
        sourceType: normalizeText(request.body?.sourceType, "rss"),
        isActive: request.body?.isActive !== false,
      });
      response.json(feed);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "Failed to update feed" });
    }
  });

  app.delete("/api/admin/feeds/:feedId", async (request, response) => {
    try {
      response.json(await deleteFeed(request.params.feedId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete feed" });
    }
  });

  app.post("/api/admin/refresh", async (_request, response) => {
    void refreshFeeds();
    response.status(202).json({ started: true, message: "Feed refresh started in the background" });
  });

  app.post("/api/admin/process", async (_request, response) => {
    void processArticleBacklog();
    response.status(202).json({ started: true, message: "Article processing started in the background" });
  });

  app.post("/api/admin/feeds/restore", async (_request, response) => {
    try {
      await restoreFeedsFromBackup(true);
      response.json({ restored: true });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : "Failed to restore feeds" });
    }
  });

  return app;
}
