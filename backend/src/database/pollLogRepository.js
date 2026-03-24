import { getDatabase } from "../config/db.js";
import { mapPollLogRecord, toIsoString } from "./helpers.js";

export async function createPollLog(log) {
  const prisma = getDatabase();
  const created = await prisma.pollLog.create({
    data: {
      feedId: log.feedId,
      startedAt: new Date(toIsoString(log.startedAt, new Date().toISOString())),
      finishedAt: new Date(toIsoString(log.finishedAt, new Date().toISOString())),
      status: log.status,
      newArticles: Number(log.newArticles || 0),
      errorMessage: log.errorMessage || null,
    },
  });

  return mapPollLogRecord(created);
}

export async function findPollLogById(id) {
  const prisma = getDatabase();
  const log = await prisma.pollLog.findUnique({ where: { id: Number(id) } });
  return mapPollLogRecord(log);
}

export async function getLatestPollLog() {
  const prisma = getDatabase();
  const log = await prisma.pollLog.findFirst({
    orderBy: {
      startedAt: "desc",
    },
  });
  return mapPollLogRecord(log);
}

export async function deletePollLogsByFeedId(feedId) {
  const prisma = getDatabase();
  const result = await prisma.pollLog.deleteMany({
    where: { feedId },
  });
  return Number(result.count || 0);
}
