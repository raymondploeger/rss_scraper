import { queryArticles } from "../database/articleRepository.js";

export async function getArticles(request, response) {
  const filters = {
    topic: request.query.topic || "",
    feedId: request.query.feedId || "",
    startDate: request.query.startDate || "",
    endDate: request.query.endDate || ""
  };

  const articles = await queryArticles(filters);
  response.json(articles);
}
