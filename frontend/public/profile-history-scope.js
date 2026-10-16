export const PROFILE_DEFAULT_LOOKBACK_DAYS = 90;

export function normalizeProfileHistoryScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["7", "30", "recent", "90"].includes(normalized)) return normalized === "90" ? "recent" : normalized;
  return normalized === "extended" || normalized === "older" || normalized === "all" || normalized === "180"
    ? "extended"
    : "recent";
}

export function getProfileHistoryLookbackDays(scope) {
  const normalized = normalizeProfileHistoryScope(scope);
  return normalized === "7" ? 7 : normalized === "30" ? 30 : normalized === "extended" ? PROFILE_DEFAULT_LOOKBACK_DAYS * 2 : PROFILE_DEFAULT_LOOKBACK_DAYS;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getProfileHistoryDateRanges(scope, now = new Date(), days = getProfileHistoryLookbackDays(scope)) {
  const normalizedDays = Math.max(1, Number(days) || PROFILE_DEFAULT_LOOKBACK_DAYS);
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - normalizedDays);
  // The selector promises an exact lookback window. Returning a second, older
  // range here made "Last 180 days" silently include up to 360 days of data.
  return [{ from: formatLocalDate(date), to: "" }];
}
