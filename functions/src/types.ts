export type FeedRecord = {
  id: string;
  name: string;
  rssUrl: string;
  topic: string;
  sourceType: string;
  isActive: boolean;
  createdAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
  updatedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
  lastStatus?: string;
  lastError?: string | null;
  lastFetchedAt?: FirebaseFirestore.Timestamp | Date | string | null;
  lastInsertedCount?: number;
};

export type ArticleRecord = {
  id: string;
  title: string;
  normalizedTitle: string;
  link: string;
  canonicalLink: string;
  pubDate: FirebaseFirestore.Timestamp | Date | string;
  source: string;
  topic: string;
  feedId: string;
  thumbnail: string;
  summary: string;
  summaryShort: string;
  keywords: string[];
  createdAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
  updatedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
  contentSnippet: string;
  author: string;
  clusterId: string | null;
  duplicateGroupId: string | null;
  isDuplicate: boolean;
  duplicateOf: string | null;
  hash: string;
  language: string;
  sentimentOptional?: string | null;
  fetchStatus: "pending" | "enriched" | "failed" | "partial";
};

export type ClusterRecord = {
  id: string;
  clusterTitle: string;
  representativeArticleId: string;
  articleIds: string[];
  topic: string;
  sourceCount: number;
  articleCount: number;
  latestPubDate: FirebaseFirestore.Timestamp | Date | string;
  createdAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
  updatedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
  summaryShort?: string;
  keywords?: string[];
};

export type TrendRecord = {
  id: string;
  label: string;
  score: number;
  articleCount: number;
  articleIds: string[];
  sourceCount: number;
  timeframe: "24h" | "7d" | "30d";
  updatedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | Date | null;
};

export type ParsedFeedItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  contentSnippet: string;
  author: string;
  thumbnail: string;
};

export type EnrichmentResult = {
  thumbnail: string;
  canonicalLink: string;
  metaTitle: string;
  metaDescription: string;
  contentSnippet: string;
  language: string;
  fetchStatus: "enriched" | "failed" | "partial";
};

export type DedupeMatch = {
  isDuplicate: boolean;
  representativeId: string | null;
  duplicateGroupId: string | null;
};

export type DuplicateMatcher = {
  detect: (article: ArticleRecord) => DedupeMatch;
  remember: (article: ArticleRecord) => void;
};

export type ClusterAssigner = {
  assign: (article: ArticleRecord) => Promise<string>;
};
