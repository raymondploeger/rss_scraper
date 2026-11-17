export const NOISE_FEEDBACK_REGRESSION_REVIEW_EXPORT_SCHEMA = "rss-monitoring-dashboard.noise-feedback-regression-review";
export const NOISE_FEEDBACK_REGRESSION_REVIEW_EXPORT_VERSION = 1;

function toReviewCandidate(record) {
  return {
    articleId: String(record?.articleId || ""),
    title: String(record?.articleTitle || ""),
    source: String(record?.articleSource || ""),
    feedName: String(record?.articleFeedName || ""),
    url: String(record?.articleUrl || ""),
    reason: String(record?.reason || ""),
    profileContext: String(record?.profileContext || ""),
    interestIds: Array.isArray(record?.interestIds) ? record.interestIds.map(String) : [],
    createdAt: String(record?.createdAt || ""),
    expectedAction: "exclude",
  };
}

export function buildNoiseFeedbackRegressionReviewExport(records) {
  const candidates = (Array.isArray(records) ? records : [])
    .map(toReviewCandidate)
    .sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
      || left.articleId.localeCompare(right.articleId)
    );

  return {
    schema: NOISE_FEEDBACK_REGRESSION_REVIEW_EXPORT_SCHEMA,
    version: NOISE_FEEDBACK_REGRESSION_REVIEW_EXPORT_VERSION,
    candidates,
  };
}
