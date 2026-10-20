export const SOURCE_HEALTH_STATUS = Object.freeze({
  HEALTHY: "healthy",
  INACTIVE: "inactive",
  ERROR: "error",
  AWAITING_SYNC: "awaiting-sync",
});

const SOURCE_HEALTH_PRESENTATION = Object.freeze({
  [SOURCE_HEALTH_STATUS.ERROR]: { label: "Error", priority: 0, isActive: false, needsAttention: true },
  [SOURCE_HEALTH_STATUS.INACTIVE]: { label: "Inactive", priority: 1, isActive: false, needsAttention: true },
  [SOURCE_HEALTH_STATUS.HEALTHY]: { label: "Healthy", priority: 2, isActive: true, needsAttention: false },
  [SOURCE_HEALTH_STATUS.AWAITING_SYNC]: { label: "Awaiting sync", priority: 3, isActive: true, needsAttention: false },
});

export function getSourceHealth(feed, { isLinkOnlySource = false } = {}) {
  const inactive = feed?.isActive === false;
  const hasError = !isLinkOnlySource && (feed?.lastStatus === "error" || Boolean(feed?.lastError));
  const status = inactive
    ? SOURCE_HEALTH_STATUS.INACTIVE
    : hasError
      ? SOURCE_HEALTH_STATUS.ERROR
      : feed?.lastStatus === "success"
        ? SOURCE_HEALTH_STATUS.HEALTHY
        : SOURCE_HEALTH_STATUS.AWAITING_SYNC;

  return { status, ...SOURCE_HEALTH_PRESENTATION[status] };
}

export function sourceMatchesHealthFilter(feed, filter, options = {}) {
  const health = getSourceHealth(feed, options);
  if (filter === "active") return health.isActive;
  if (filter === "inactive") return health.needsAttention;
  return true;
}
