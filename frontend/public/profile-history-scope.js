export const PROFILE_DEFAULT_LOOKBACK_DAYS = 90;

export function normalizeProfileHistoryScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "older" || normalized === "all" ? "older" : "recent";
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getProfileHistoryDateRange(scope, now = new Date(), days = PROFILE_DEFAULT_LOOKBACK_DAYS) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Math.max(1, Number(days) || PROFILE_DEFAULT_LOOKBACK_DAYS));
  if (normalizeProfileHistoryScope(scope) !== "older") {
    return { from: formatLocalDate(date), to: "" };
  }

  const end = new Date(date);
  end.setDate(end.getDate() - 1);
  date.setDate(date.getDate() - Math.max(1, Number(days) || PROFILE_DEFAULT_LOOKBACK_DAYS));
  return { from: formatLocalDate(date), to: formatLocalDate(end) };
}
