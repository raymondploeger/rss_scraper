import { batch, db, serverTimestamp } from "../database/firestoreService";
import { CLUSTER_LOOKBACK_DAYS } from "../config/constants";
import { ArticleRecord, ClusterAssigner, ClusterRecord } from "../types";
import { subtractDays, toDate } from "../utils/date";
import { createHash } from "../utils/hash";
import { inferKeywords, similarityScore } from "../utils/text";

async function listRecentClusters(): Promise<ClusterRecord[]> {
  const snapshot = await db
    .collection("clusters")
    .where("latestPubDate", ">=", subtractDays(CLUSTER_LOOKBACK_DAYS).toISOString())
    .orderBy("latestPubDate", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ClusterRecord, "id">) }));
}

async function getArticlesByIds(articleIds: string[]): Promise<ArticleRecord[]> {
  const uniqueIds = Array.from(new Set(articleIds)).slice(0, 20);
  const docs = await Promise.all(uniqueIds.map((id) => db.collection("articles").doc(id).get()));
  return docs
    .filter((doc) => doc.exists)
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ArticleRecord, "id">) }));
}

async function chooseCluster(article: ArticleRecord): Promise<ClusterRecord | null> {
  const clusters = await listRecentClusters();
  const matched = clusters.find((cluster) => {
    const topicMatch = cluster.topic.toLowerCase() === article.topic.toLowerCase();
    const titleMatch = similarityScore(cluster.clusterTitle, article.title) >= 0.45;
    const keywordMatch = (cluster.keywords || []).some((keyword) => article.keywords.includes(keyword));
    return topicMatch && (titleMatch || keywordMatch);
  });

  return matched || null;
}

export async function createClusterAssigner(): Promise<ClusterAssigner> {
  const clusters = await listRecentClusters();

  return {
    async assign(article: ArticleRecord) {
      const existingCluster =
        clusters.find((cluster) => {
          const topicMatch = cluster.topic.toLowerCase() === article.topic.toLowerCase();
          const titleMatch = similarityScore(cluster.clusterTitle, article.title) >= 0.45;
          const keywordMatch = (cluster.keywords || []).some((keyword) => article.keywords.includes(keyword));
          return topicMatch && (titleMatch || keywordMatch);
        }) || null;

      if (!existingCluster) {
        const clusterId = createHash(`${article.topic}::${article.id}`);
        const createdCluster: ClusterRecord = {
          id: clusterId,
          clusterTitle: article.title,
          representativeArticleId: article.id,
          articleIds: [article.id],
          topic: article.topic,
          sourceCount: 1,
          articleCount: 1,
          latestPubDate: article.pubDate,
          summaryShort: article.summaryShort,
          keywords: article.keywords,
        };
        clusters.unshift(createdCluster);
        await db.collection("clusters").doc(clusterId).set({
          ...createdCluster,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return clusterId;
      }

      const articleIds = Array.from(new Set([...(existingCluster.articleIds || []), article.id]));
      const clusterArticles = await getArticlesByIds(articleIds);
      const representative = clusterArticles
        .slice()
        .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime())[0] || article;
      const sourceCount = new Set(clusterArticles.map((item) => item.source)).size || 1;
      const latestPubDate = clusterArticles
        .map((item) => toDate(item.pubDate).getTime())
        .sort((left, right) => right - left)[0];
      const keywords = inferKeywords(
        clusterArticles.flatMap((item) => [item.title, item.summaryShort, item.contentSnippet, item.topic]),
        8,
      );

      Object.assign(existingCluster, {
        clusterTitle: representative.title,
        representativeArticleId: representative.id,
        articleIds,
        topic: article.topic,
        sourceCount,
        articleCount: articleIds.length,
        latestPubDate: new Date(latestPubDate).toISOString(),
        summaryShort: representative.summaryShort || article.summaryShort,
        keywords,
      });

      await db.collection("clusters").doc(existingCluster.id).set(
        {
          clusterTitle: existingCluster.clusterTitle,
          representativeArticleId: existingCluster.representativeArticleId,
          articleIds: existingCluster.articleIds,
          topic: existingCluster.topic,
          sourceCount: existingCluster.sourceCount,
          articleCount: existingCluster.articleCount,
          latestPubDate: existingCluster.latestPubDate,
          summaryShort: existingCluster.summaryShort,
          keywords: existingCluster.keywords,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return existingCluster.id;
    },
  };
}

export async function assignCluster(article: ArticleRecord): Promise<string> {
  const existingCluster = await chooseCluster(article);
  if (!existingCluster) {
    const clusterId = createHash(`${article.topic}::${article.id}`);
    await db.collection("clusters").doc(clusterId).set({
      clusterTitle: article.title,
      representativeArticleId: article.id,
      articleIds: [article.id],
      topic: article.topic,
      sourceCount: 1,
      articleCount: 1,
      latestPubDate: article.pubDate,
      summaryShort: article.summaryShort,
      keywords: article.keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return clusterId;
  }

  const articleIds = Array.from(new Set([...(existingCluster.articleIds || []), article.id]));
  const clusterArticles = await getArticlesByIds(articleIds);
  const representative = clusterArticles
    .slice()
    .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime())[0] || article;
  const sourceCount = new Set(clusterArticles.map((item) => item.source)).size || 1;
  const latestPubDate = clusterArticles
    .map((item) => toDate(item.pubDate).getTime())
    .sort((left, right) => right - left)[0];
  const keywords = inferKeywords(
    clusterArticles.flatMap((item) => [item.title, item.summaryShort, item.contentSnippet, item.topic]),
    8,
  );

  await db.collection("clusters").doc(existingCluster.id).set(
    {
      clusterTitle: representative.title,
      representativeArticleId: representative.id,
      articleIds,
      topic: article.topic,
      sourceCount,
      articleCount: articleIds.length,
      latestPubDate: new Date(latestPubDate).toISOString(),
      summaryShort: representative.summaryShort || article.summaryShort,
      keywords,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return existingCluster.id;
}

export async function rebuildClustersForArticles(articles: ArticleRecord[]) {
  const clusterMap = new Map<string, ArticleRecord[]>();
  articles
    .filter((article) => !article.isDuplicate)
    .forEach((article) => {
      const key = `${article.topic}::${article.clusterId || article.id}`;
      const items = clusterMap.get(key) || [];
      items.push(article);
      clusterMap.set(key, items);
    });

  const writeBatch = batch();
  clusterMap.forEach((items, key) => {
    const representative = items
      .slice()
      .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime())[0];
    const articleIds = items.map((item) => item.id);
    const sourceCount = new Set(items.map((item) => item.source)).size;
    writeBatch.set(db.collection("clusters").doc(key), {
      clusterTitle: representative.title,
      representativeArticleId: representative.id,
      articleIds,
      topic: representative.topic,
      sourceCount,
      articleCount: items.length,
      latestPubDate: representative.pubDate,
      summaryShort: representative.summaryShort,
      keywords: inferKeywords(items.flatMap((item) => [item.title, item.summaryShort, item.topic]), 8),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  });

  if (clusterMap.size) {
    await writeBatch.commit();
  }
}
