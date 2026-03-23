import crypto from "crypto";
import admin from "firebase-admin";

const feedsCollection = "feeds";
const articlesCollection = "articles";
const placeholderThumbnail =
  "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";

let db;

function getCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    });
  }

  return admin.credential.applicationDefault();
}

function createArticleId(link) {
  return crypto.createHash("sha256").update(link.trim().toLowerCase()).digest("hex");
}

export async function initializeFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: getCredentials()
    });
  }

  db = admin.firestore();
  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Firestore has not been initialized");
  }

  return db;
}

export async function listFeeds() {
  const snapshot = await getDb().collection(feedsCollection).orderBy("createdAt", "desc").limit(50).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function listActiveFeeds(maxFeeds = 50) {
  const snapshot = await getDb()
    .collection(feedsCollection)
    .where("isActive", "==", true)
    .orderBy("createdAt", "desc")
    .limit(maxFeeds)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function listRecentArticles(filters = {}) {
  const snapshot = await getDb().collection(articlesCollection).orderBy("pubDate", "desc").limit(250).get();
  let articles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (filters.topic) {
    articles = articles.filter((article) => article.topic === filters.topic);
  }

  if (filters.feedId) {
    articles = articles.filter((article) => article.feedId === filters.feedId);
  }

  if (filters.date) {
    const targetDate = new Date(filters.date);
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    articles = articles.filter((article) => {
      const pubDate = toDate(article.pubDate);
      return pubDate >= targetDate && pubDate <= endDate;
    });
  }

  if (filters.search) {
    const query = filters.search.trim().toLowerCase();
    articles = articles.filter((article) => {
      return [article.title, article.source, article.topic]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }

  return articles.sort((left, right) => toDate(right.pubDate) - toDate(left.pubDate));
}

function toDate(value) {
  if (!value) {
    return new Date(0);
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  return new Date(value);
}

export async function saveArticleIfNew(article) {
  const articleId = createArticleId(article.link);
  const articleRef = getDb().collection(articlesCollection).doc(articleId);
  const snapshot = await articleRef.get();

  if (snapshot.exists) {
    return {
      isNew: false,
      article: { id: snapshot.id, ...snapshot.data() }
    };
  }

  const payload = {
    id: articleId,
    title: article.title,
    link: article.link,
    pubDate: article.pubDate,
    source: article.source,
    topic: article.topic,
    thumbnail: article.thumbnail || placeholderThumbnail,
    thumbnailCached: Boolean(article.thumbnail),
    feedId: article.feedId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await articleRef.set(payload);

  return {
    isNew: true,
    article: {
      ...payload,
      createdAt: new Date().toISOString()
    }
  };
}

export async function updateArticleThumbnail(articleId, thumbnail) {
  await getDb()
    .collection(articlesCollection)
    .doc(articleId)
    .set(
      {
        thumbnail: thumbnail || placeholderThumbnail,
        thumbnailCached: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}

export async function updateFeedSyncState(feedId, updates) {
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

export async function getDashboardSummary() {
  const [feedSnapshot, articleSnapshot] = await Promise.all([
    getDb().collection(feedsCollection).limit(50).get(),
    getDb().collection(articlesCollection).orderBy("pubDate", "desc").limit(250).get()
  ]);

  const feeds = feedSnapshot.docs.map((doc) => doc.data());
  const articles = articleSnapshot.docs.map((doc) => doc.data());
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    totalFeeds: feeds.length,
    activeFeeds: feeds.filter((feed) => feed.isActive !== false).length,
    articlesToday: articles.filter((article) => toDate(article.pubDate) >= startOfToday).length,
    failedFeeds: feeds.filter((feed) => feed.lastStatus === "error").length,
    topics: new Set(feeds.map((feed) => feed.topic).filter(Boolean)).size
  };
}

export { placeholderThumbnail };
