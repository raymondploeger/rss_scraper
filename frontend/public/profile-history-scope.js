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
