import { batch, db, serverTimestamp } from "../database/firestoreService";
import { ArticleRecord } from "../types";
import { DEDUPE_LOOKBACK_DAYS, DEDUPE_MAX_CANDIDATES, MAX_ARTICLES_PER_QUERY } from "../config/constants";
import { subtractDays } from "../utils/date";
import { canonicalizeUrl } from "../utils/text";

export async function getArticleById(articleId: string) {
  const snapshot = await db.collection("articles").doc(articleId).get();
  if (!snapshot.exists) {
    return null;
  }

  return { id: snapshot.id, ...(snapshot.data() as Omit<ArticleRecord, "id">) };
}

export async function listArticles() {
  const snapshot = await db.collection("articles").orderBy("pubDate", "desc").limit(MAX_ARTICLES_PER_QUERY).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ArticleRecord, "id">) }));
}

export async function listRecentArticles(days = DEDUPE_LOOKBACK_DAYS) {
  const snapshot = await db
    .collection("articles")
    .where("pubDate", ">=", subtractDays(days).toISOString())
    .orderBy("pubDate", "desc")
    .limit(DEDUPE_MAX_CANDIDATES)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ArticleRecord, "id">) }));
}

export async function findByCanonicalLink(canonicalLink: string) {
  const normalized = canonicalizeUrl(canonicalLink);
  const snapshot = await db.collection("articles").where("canonicalLink", "==", normalized).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<ArticleRecord, "id">) };
}

export async function findByHash(hash: string) {
  const snapshot = await db.collection("articles").where("hash", "==", hash).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<ArticleRecord, "id">) };
}

export async function saveArticle(article: ArticleRecord) {
  const ref = db.collection("articles").doc(article.id);
  const existing = await ref.get();

  if (existing.exists) {
    return false;
  }

  await ref.set({
    ...article,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function saveArticles(articles: ArticleRecord[]) {
  if (!articles.length) {
    return;
  }

  const writeBatch = batch();
  articles.forEach((article) => {
    writeBatch.set(db.collection("articles").doc(article.id), {
      ...article,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await writeBatch.commit();
}

export async function updateArticle(articleId: string, payload: Partial<ArticleRecord>) {
  await db.collection("articles").doc(articleId).set(
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
