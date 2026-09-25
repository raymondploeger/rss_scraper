export const PROFILE_DEFAULT_LOOKBACK_DAYS = 90;

export function normalizeProfileHistoryScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "extended" || normalized === "older" || normalized === "all" ? "extended" : "recent";
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getProfileHistoryDateRanges(scope, now = new Date(), days = PROFILE_DEFAULT_LOOKBACK_DAYS) {
  const normalizedDays = Math.max(1, Number(days) || PROFILE_DEFAULT_LOOKBACK_DAYS);
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - normalizedDays);
  const recentRange = { from: formatLocalDate(date), to: "" };
  if (normalizeProfileHistoryScope(scope) !== "extended") {
    return [recentRange];
  }

  const olderEnd = new Date(date);
  olderEnd.setDate(olderEnd.getDate() - 1);
  date.setDate(date.getDate() - normalizedDays);
  return [
    recentRange,
    { from: formatLocalDate(date), to: formatLocalDate(olderEnd) },
  ];
}
