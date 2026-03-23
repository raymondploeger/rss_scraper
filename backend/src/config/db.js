import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { env } from "./env.js";

let database;

function ensureDatabaseDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      rssUrl TEXT NOT NULL UNIQUE,
      sourceType TEXT NOT NULL DEFAULT 'rss',
      isActive INTEGER NOT NULL DEFAULT 1,
      lastFetchedAt TEXT,
      lastStatus TEXT NOT NULL DEFAULT 'idle',
      lastError TEXT,
      lastInsertedCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      canonicalLink TEXT,
      feedId TEXT NOT NULL,
      feedName TEXT NOT NULL,
      topic TEXT NOT NULL,
      title TEXT NOT NULL,
      normalizedTitle TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL,
      source TEXT NOT NULL,
      pubDate TEXT NOT NULL,
      thumbnail TEXT,
      summary TEXT NOT NULL DEFAULT '',
      summaryShort TEXT NOT NULL DEFAULT '',
      keywords TEXT NOT NULL DEFAULT '[]',
      contentSnippet TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      clusterId TEXT,
      duplicateGroupId TEXT,
      isDuplicate INTEGER NOT NULL DEFAULT 0,
      duplicateOf TEXT,
      language TEXT NOT NULL DEFAULT 'unknown',
      fetchStatus TEXT NOT NULL DEFAULT 'pending',
      articleHash TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS poll_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedId TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT NOT NULL,
      status TEXT NOT NULL,
      newArticles INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT,
      FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_feeds_created_at ON feeds(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_feeds_active_created ON feeds(isActive, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_feeds_topic_active ON feeds(topic, isActive);
    CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_feed_pub_date ON articles(feedId, pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_topic_pub_date ON articles(topic, pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_duplicate_status ON articles(isDuplicate, pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_fetch_status ON articles(fetchStatus, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_poll_logs_feed_started ON poll_logs(feedId, startedAt DESC);
  `);
}

export async function connectDatabase() {
  if (database) {
    return database;
  }

  ensureDatabaseDirectory(env.sqlitePath);
  database = new DatabaseSync(env.sqlitePath);
  createSchema(database);
  console.log(`SQLite connected at ${env.sqlitePath}`);
  return database;
}

export function getDatabase() {
  if (!database) {
    throw new Error("Database is not initialized. Call connectDatabase() before using repositories.");
  }

  return database;
}
