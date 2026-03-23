import { getDatabase } from "../config/db.js";
import { mapPollLogRow, toIsoString } from "./helpers.js";

export async function createPollLog(log) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO poll_logs (feedId, startedAt, finishedAt, status, newArticles, errorMessage)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    log.feedId,
    toIsoString(log.startedAt, new Date().toISOString()),
    toIsoString(log.finishedAt, new Date().toISOString()),
    log.status,
    Number(log.newArticles || 0),
    log.errorMessage || null
  );

  return findPollLogById(result.lastInsertRowid);
}

export async function findPollLogById(id) {
  const db = getDatabase();
  return mapPollLogRow(db.prepare(`SELECT * FROM poll_logs WHERE id = ? LIMIT 1`).get(id));
}

export async function getLatestPollLog() {
  const db = getDatabase();
  return mapPollLogRow(db.prepare(`SELECT * FROM poll_logs ORDER BY startedAt DESC LIMIT 1`).get());
}

export async function deletePollLogsByFeedId(feedId) {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM poll_logs WHERE feedId = ?`).run(feedId);
  return Number(result.changes || 0);
}
