export const PROFILE_DEFAULT_LOOKBACK_DAYS = 90;

export function normalizeProfileHistoryScope(value) {
  return String(value || "").trim().toLowerCase() === "all" ? "all" : "recent";
}

export function getProfileHistorySinceDate(scope, now = new Date(), days = PROFILE_DEFAULT_LOOKBACK_DAYS) {
  if (normalizeProfileHistoryScope(scope) === "all") {
    return "";
  }

  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Math.max(1, Number(days) || PROFILE_DEFAULT_LOOKBACK_DAYS));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
