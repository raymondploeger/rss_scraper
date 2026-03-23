import { getDb } from "./firestore.js";
import admin from "firebase-admin";
import crypto from "crypto";

const articlesCollection = "articles";

function createArticleId(link) {
  return crypto.createHash("sha256").update(link).digest("hex");
}

export async function saveArticleIfNew(article) {
  const id = createArticleId(article.link);
  const documentRef = getDb().collection(articlesCollection).doc(id);
  const existing = await documentRef.get();

  if (existing.exists) {
    return {
      created: false,
      article: { id: existing.id, ...existing.data() }
    };
  }

  const payload = {
    id,
    title: article.title,
    link: article.link,
    pubDate: article.pubDate,
    source: article.source,
    topic: article.topic,
    thumbnail: article.thumbnail || null,
    feedId: article.feedId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await documentRef.set(payload);

  return {
    created: true,
    article: {
      ...payload,
      createdAt: new Date().toISOString()
    }
  };
}

export async function queryArticles(filters) {
  const snapshot = await getDb().collection(articlesCollection).get();
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return items
    .filter((article) => {
      if (filters.topic && article.topic !== filters.topic) {
        return false;
      }

      if (filters.feedId && article.feedId !== filters.feedId) {
        return false;
      }

      if (filters.startDate && new Date(article.pubDate) < new Date(`${filters.startDate}T00:00:00`)) {
        return false;
      }

      if (filters.endDate && new Date(article.pubDate) > new Date(`${filters.endDate}T23:59:59`)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => new Date(right.pubDate) - new Date(left.pubDate));
}
