import { getArticleRetentionCounts, deleteExpiredArticlesByRetention } from "../database/articleRepository.js";
import { listFeeds } from "../database/feedRepository.js";
import { resolveFeedProfileAffinities } from "./feedProfileAffinityService.js";

export const STANDARD_ARTICLE_RETENTION_DAYS = 365;
export const EXTENDED_ARTICLE_RETENTION_DAYS = 365 * 3;
export const EXTENDED_RETENTION_PROFILE_IDS = Object.freeze(["vendors", "researcher", "security_printer"]);

function subtractDays(now, days) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export function getArticleRetentionPolicy(now = new Date()) {
  return {
    defaultBefore: subtractDays(now, STANDARD_ARTICLE_RETENTION_DAYS),
    extendedBefore: subtractDays(now, EXTENDED_ARTICLE_RETENTION_DAYS),
    extendedProfileIds: [...EXTENDED_RETENTION_PROFILE_IDS],
  };
}

export async function getArticleRetentionScope({ listFeedsFn = listFeeds } = {}) {
  const feeds = await listFeedsFn();
  return {
    eligibleFeedCount: feeds.length,
    extendedFeedIds: feeds
      .filter((feed) => resolveFeedProfileAffinities(feed).some((profileId) => EXTENDED_RETENTION_PROFILE_IDS.includes(profileId)))
      .map((feed) => String(feed.id)),
  };
}

export async function inspectArticleRetention({ now = new Date(), listFeedsFn = listFeeds, getCountsFn = getArticleRetentionCounts } = {}) {
  const policy = getArticleRetentionPolicy(now);
  const scope = await getArticleRetentionScope({ listFeedsFn });
  const counts = await getCountsFn({ ...policy, ...scope });
  return { ...policy, ...scope, counts };
}

export async function enforceArticleRetention({ now = new Date(), listFeedsFn = listFeeds, deleteExpiredFn = deleteExpiredArticlesByRetention } = {}) {
  const policy = getArticleRetentionPolicy(now);
  const scope = await getArticleRetentionScope({ listFeedsFn });
  const deleted = await deleteExpiredFn({ ...policy, ...scope });
  return { ...policy, ...scope, deleted };
}
