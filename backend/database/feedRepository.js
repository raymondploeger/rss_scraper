import admin from "firebase-admin";
import { getDb } from "./firestore.js";
import { env } from "../server/config.js";

const feedsCollection = "feeds";

export async function getAllFeeds() {
  const snapshot = await getDb().collection(feedsCollection).orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getActiveFeeds() {
  const snapshot = await getDb()
    .collection(feedsCollection)
    .where("isActive", "==", true)
    .limit(env.maxFeeds)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getFeedById(feedId) {
  const document = await getDb().collection(feedsCollection).doc(feedId).get();
  return document.exists ? { id: document.id, ...document.data() } : null;
}

export async function addFeed(feed) {
  const createdAt = admin.firestore.FieldValue.serverTimestamp();
  const payload = {
    ...feed,
    lastStatus: "idle",
    lastFetchedAt: null,
    lastError: null,
    createdAt,
    updatedAt: createdAt
  };

  const reference = await getDb().collection(feedsCollection).add(payload);
  return { id: reference.id, ...feed, lastStatus: "idle", lastFetchedAt: null, lastError: null };
}

export async function updateFeedStatus(feedId, updates) {
  await getDb()
    .collection(feedsCollection)
    .doc(feedId)
    .set(
      {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}

export async function getDashboardMetrics() {
  const [feeds, articles] = await Promise.all([
    getDb().collection(feedsCollection).get(),
    getDb().collection("articles").get()
  ]);

  const feedDocs = feeds.docs.map((doc) => doc.data());
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const articleCountToday = articles.docs.filter((doc) => {
    const value = doc.data().pubDate;
    return value && new Date(value) >= todayStart;
  }).length;

  return {
    totalFeeds: feedDocs.length,
    activeFeeds: feedDocs.filter((feed) => feed.isActive).length,
    failedFeeds: feedDocs.filter((feed) => feed.lastStatus === "error").length,
    topics: new Set(feedDocs.map((feed) => feed.topic)).size,
    articleCountToday
  };
}
