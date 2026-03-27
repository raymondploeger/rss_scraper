import {
  countArticles,
  listArticles as listArticleRecords,
  listDistinctArticleTopics
} from "../database/articleRepository.js";
import { env } from "../config/env.js";
import { listFeeds } from "../database/feedRepository.js";
import { endOfDay, startOfDay } from "../utils/date.js";
import { toArticleDto, toFeedDto } from "../services/presenterService.js";
import { isRuntimeReady } from "../services/runtimeState.js";

export async function listArticles(request, response) {
  try {
    if (!isRuntimeReady()) {
      response.json([]);
      return;
    }

    const { topic, feedId, from, to, page = 1, limit = env.maxArticlePageSize, search, showDuplicates } = request.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(env.maxArticlePageSize, Math.max(1, Number(limit) || env.maxArticlePageSize));

    const filters = {
      topic,
      feedId,
      from: from ? startOfDay(from) : null,
      to: to ? endOfDay(to) : null,
      search,
      excludeDuplicates: false
    };

    const [items, total] = await Promise.all([
      listArticleRecords(filters, {
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize
      }),
      countArticles(filters)
    ]);

    if (request.query.includePagination === "true") {
      response.json({
        items: items.map(toArticleDto),
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
      });
      return;
    }

    response.json(items.map(toArticleDto));
  } catch (error) {
    console.error("Articles error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to load articles" });
  }
}

export async function getArticleFilters(request, response) {
  try {
    if (!isRuntimeReady()) {
      response.json({ topics: [], feeds: [] });
      return;
    }

    const [topics, feeds] = await Promise.all([
      listDistinctArticleTopics(),
      listFeeds()
    ]);

    response.json({ topics: topics.sort(), feeds: feeds.map(toFeedDto) });
  } catch (error) {
    console.error("Article filters error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to load article filters" });
  }
}
