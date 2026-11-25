export const PROFILE_DEFAULT_LOOKBACK_DAYS = 90;
const GENERIC_ARTICLE_HISTORY_SCOPES = Object.freeze(["7", "30"]);
const PROFILE_ARTICLE_HISTORY_SCOPES = Object.freeze(["7", "30", "recent", "extended"]);

export function normalizeProfileHistoryScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["7", "30", "recent", "90"].includes(normalized)) return normalized === "90" ? "recent" : normalized;
  return normalized === "extended" || normalized === "older" || normalized === "all" || normalized === "180"
    ? "extended"
    : "recent";
}

export function getAvailableArticleHistoryScopes({ hasActiveProfile = false } = {}) {
  return hasActiveProfile ? PROFILE_ARTICLE_HISTORY_SCOPES : GENERIC_ARTICLE_HISTORY_SCOPES;
}

export function normalizeArticleHistoryScopeForUi(value, { hasActiveProfile = false } = {}) {
  const normalized = normalizeProfileHistoryScope(value);
  return hasActiveProfile || GENERIC_ARTICLE_HISTORY_SCOPES.includes(normalized) ? normalized : "30";
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

function parseLocalDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function splitProfileHistoryDateRange(range = {}, now = new Date(), minimumWindowDays = 7) {
  const fromDate = parseLocalDate(range.from);
  const latestDate = range.to ? parseLocalDate(range.to) : new Date(now);
  if (!fromDate || !latestDate) return [];
  latestDate.setHours(0, 0, 0, 0);
  const spanDays = Math.round((latestDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  if (spanDays <= Math.max(1, Number(minimumWindowDays) || 1)) return [];

  const firstSpanDays = Math.floor(spanDays / 2);
  const firstToDate = new Date(fromDate);
  firstToDate.setDate(firstToDate.getDate() + firstSpanDays);
  const secondFromDate = new Date(firstToDate);
  secondFromDate.setDate(secondFromDate.getDate() + 1);
  return [
    { from: formatLocalDate(fromDate), to: formatLocalDate(firstToDate) },
    { from: formatLocalDate(secondFromDate), to: range.to ? formatLocalDate(latestDate) : "" },
  ];
}

export function getProfileHistoryDateRanges(scope, now = new Date(), days = getProfileHistoryLookbackDays(scope)) {
  const normalizedDays = Math.max(1, Number(days) || PROFILE_DEFAULT_LOOKBACK_DAYS);
  const latestDate = new Date(now);
  latestDate.setHours(0, 0, 0, 0);
  const rangesNewestFirst = [];
  let newestOffsetDays = 0;

  // A complete snapshot has a hard source bound. Partition longer profile
  // windows into exact, non-overlapping 90-day spans before retrieval, then
  // let the caller merge canonical candidates across those spans.
  while (newestOffsetDays <= normalizedDays) {
    const oldestOffsetDays = Math.min(
      normalizedDays,
      newestOffsetDays + PROFILE_DEFAULT_LOOKBACK_DAYS
    );
    const fromDate = new Date(latestDate);
    fromDate.setDate(fromDate.getDate() - oldestOffsetDays);
    const toDate = newestOffsetDays
      ? new Date(latestDate)
      : null;
    if (toDate) {
      toDate.setDate(toDate.getDate() - newestOffsetDays);
    }
    rangesNewestFirst.push({
      from: formatLocalDate(fromDate),
      to: toDate ? formatLocalDate(toDate) : "",
    });
    newestOffsetDays = oldestOffsetDays + 1;
  }

  return rangesNewestFirst.reverse();
}
