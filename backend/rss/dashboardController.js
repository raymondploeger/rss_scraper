import { getDashboardMetrics } from "../database/feedRepository.js";

export async function getDashboardSummary(request, response) {
  const summary = await getDashboardMetrics();
  response.json(summary);
}
