const PLACEHOLDER_IMAGE = "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";
const THEME_STORAGE_KEY = "rss-monitor-theme";
const FEED_PANEL_COLLAPSED_STORAGE_KEY = "feedPanelCollapsed";
const ALERT_SNAPSHOT_STORAGE_KEY = "prevSnapshot";
const ALERT_DEDUPE_STORAGE_KEY = "recentAlertKeys";
const ALERT_ARTICLE_FILTER_STORAGE_KEY = "activeAlertArticleFilter";
const ALERT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const POLLING_INTERVAL_MS = 30000;
const ARTICLE_PAGE_SIZE = 400;
const NOTIFICATION_TIMEOUT_MS = 7000;
const DASHBOARD_ALERT_LIMIT = 8;
const LOW_VALUE_ARTICLE_THRESHOLD = 5;
const SUMMARY_METRICS = [
  { label: "Active feeds", key: "activeFeeds" },
  { label: "Tracked topics", key: "topics" },
  { label: "Articles today", key: "articlesToday" },
  { label: "Latest articles", key: "totalArticles" },
];
const DEFAULT_SOURCE_GROUPS = ["USA", "Canada", "Google Alerts", "Other"];

const state = {
  feeds: [],
  dmvCatalog: [],
  articles: [],
  dashboardMode: "normal",
  editingFeedId: "",
  feedPanelCollapsed: false,
  addSourceExpanded: false,
  filters: {
    search: "",
    topic: "",
    feedId: "",
    dmvFeedId: "",
    canadaDmvFeedPath: "",
    canadaDmvAll: false,
    sourceGroup: "all",
    date: "",
    articleIds: [],
    alertLabel: "",
  },
};

const runtime = {
  pollTimer: null,
  eventSource: null,
  realtimeEnabled: false,
  notificationId: 0,
  notificationTimers: new Map(),
  knownErrorFeedIds: new Set(),
  knownArticleIds: new Set(),
  dashboardAlerts: [],
  dashboardAlertId: 0,
  previousSnapshotStats: null,
  snapshotLoaded: false,
};

const elements = {
  notificationRegion: document.getElementById("notification-region"),
  summaryGrid: document.getElementById("summary-grid"),
  articlesGrid: document.getElementById("articles-grid"),
  topicFilter: document.getElementById("topic-filter"),
  feedFilter: document.getElementById("feed-filter"),
  dmvFeedFilter: document.getElementById("dmv-feed-filter"),
  canadaDmvFilter: document.getElementById("canada-dmv-filter"),
  dmvOfficialLinkWrap: document.getElementById("dmv-official-link-wrap"),
  dmvOfficialLink: document.getElementById("dmv-official-link"),
  dmvModeIndicator: document.getElementById("dmv-mode-indicator"),
  dateFilter: document.getElementById("date-filter"),
  searchFilter: document.getElementById("search-filter"),
  clearFilters: document.getElementById("clear-filters"),
  activeFilterList: document.getElementById("active-filter-list"),
  refreshButton: document.getElementById("refresh-button"),
  connectionStatus: document.getElementById("connection-status"),
  resultsCount: document.getElementById("results-count"),
  themeToggle: document.getElementById("theme-toggle"),
  feedForm: document.getElementById("feed-form"),
  feedSubmit: document.getElementById("feed-submit"),
  feedCancel: document.getElementById("feed-cancel"),
  feedName: document.getElementById("feed-name"),
  feedTopic: document.getElementById("feed-topic"),
  feedUrl: document.getElementById("feed-url"),
  feedSourceType: document.getElementById("feed-source-type"),
  feedFormStatus: document.getElementById("feed-form-status"),
  feedCount: document.getElementById("feed-count"),
  feedList: document.getElementById("feed-list"),
  feedPanelSearch: document.getElementById("feed-panel-search"),
  feedVisibilityFilter: document.getElementById("feed-visibility-filter"),
  feedGroupTabs: document.getElementById("feed-group-tabs"),
  feedPanel: document.getElementById("feed-panel"),
  feedPanelToggle: document.getElementById("feed-panel-toggle"),
  feedPanelContent: document.getElementById("feed-panel-content"),
  addSourceToggle: document.getElementById("add-source-toggle"),
  addSourceContent: document.getElementById("add-source-content"),
  summaryCardTemplate: document.getElementById("summary-card-template"),
  feedItemTemplate: document.getElementById("feed-item-template"),
  articleCardTemplate: document.getElementById("article-card-template"),
  importDmvButton: document.getElementById("import-dmv-button"),
  dmvToggleButton: document.getElementById("dmv-toggle-button"),
  canadaToggleButton: document.getElementById("canada-toggle-button"),
};

function debounce(callback, wait = 250) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

function toDate(value) {
  if (!value) {
    return new Date(0);
  }
  return new Date(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
}

function dismissNotification(notificationId) {
  const notification = elements.notificationRegion?.querySelector(`[data-notification-id="${notificationId}"]`);
  if (!notification) {
    return;
  }

  window.clearTimeout(runtime.notificationTimers.get(notificationId));
  runtime.notificationTimers.delete(notificationId);
  notification.remove();
}

function showNotification({ title, message = "", type = "info", timeout = NOTIFICATION_TIMEOUT_MS }) {
  if (!elements.notificationRegion) {
    return;
  }

  const notificationId = String((runtime.notificationId += 1));
  const notification = document.createElement("article");
  const content = document.createElement("div");
  const titleElement = document.createElement("strong");
  const messageElement = document.createElement("p");
  const closeButton = document.createElement("button");

  notification.className = `notification-toast is-${type}`;
  notification.dataset.notificationId = notificationId;
  content.className = "notification-content";
  titleElement.textContent = title;
  messageElement.textContent = message;
  closeButton.className = "notification-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.textContent = "Dismiss";
  closeButton.addEventListener("click", () => dismissNotification(notificationId));

  content.append(titleElement);
  if (message) {
    content.appendChild(messageElement);
  }
  notification.append(content, closeButton);
  elements.notificationRegion.appendChild(notification);

  if (timeout > 0) {
    const timer = window.setTimeout(() => dismissNotification(notificationId), timeout);
    runtime.notificationTimers.set(notificationId, timer);
  }
}

function parseStreamPayload(event) {
  try {
    return JSON.parse(event?.data || "{}");
  } catch {
    return {};
  }
}

function isNotafiliaUrl(value) {
  try {
    return new URL(String(value || "")).hostname === "news.notafilia.pl";
  } catch {
    return false;
  }
}

function isDmvWrapperFeed(feed) {
  return isDmvSource(feed);
}

function getArticleImageSrc(article) {
  const thumbnail = String(article.thumbnail || "").trim();
  if (!thumbnail) {
    return "";
  }

  return isNotafiliaUrl(thumbnail)
    ? `/api/image?url=${encodeURIComponent(thumbnail)}`
    : thumbnail;
}

function toDateInputValue(value) {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applyTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = value === "dark" ? "dark" : "";
  elements.themeToggle.textContent = value === "dark" ? "Light mode" : "Dark mode";
  window.localStorage.setItem(THEME_STORAGE_KEY, value);
}

function loadTheme() {
  applyTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || "light");
}

function isFeedPanelCollapsed() {
  return window.localStorage.getItem(FEED_PANEL_COLLAPSED_STORAGE_KEY) === "true";
}

function getFeedName(feedId) {
  return state.feeds.find((feed) => feed.id === feedId)?.name || "Unknown feed";
}

function getFeedTopic(feedId) {
  return state.feeds.find((feed) => feed.id === feedId)?.topic || "";
}

function getNonDmvFeeds() {
  return state.feeds.filter((feed) => !isDmvWrapperFeed(feed));
}

function getDmvFeeds() {
  return state.feeds.filter(isDmvWrapperFeed);
}

function isCanadianDmvAbbr(abbr) {
  return ["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "NT", "NU", "YT"].includes(
    String(abbr || "").toUpperCase()
  );
}

function normalizeCountry(value) {
  const country = String(value || "").trim().toLowerCase();
  if (country === "usa" || country === "united states" || country === "united states of america") {
    return "us";
  }
  if (country === "ca") {
    return "canada";
  }
  return country;
}

function getCountryLabel(country) {
  const normalized = normalizeCountry(country);
  if (normalized === "us") {
    return "USA";
  }
  if (normalized === "canada") {
    return "Canada";
  }
  return normalized
    ? normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "";
}

function getCatalogEntryCountry(entry) {
  if (!entry) {
    return "";
  }

  return (
    normalizeCountry(entry?.country || entry?.dmvCountry || entry?.region) ||
    (isCanadianDmvAbbr(entry?.abbr) ? "canada" : "us")
  );
}

function getFeedCountry(feed) {
  return (
    normalizeCountry(feed?.country || feed?.dmvCountry || feed?.dmvRegion) ||
    (isCanadianDmvAbbr(feed?.dmvAbbr) ? "canada" : "")
  );
}

function getCatalogEntrySubdivisionLabel(entry) {
  return entry?.subdivision || entry?.province || entry?.state || entry?.abbr || "Untitled Feed";
}

function getSourceFamily(item) {
  return String(item?.sourceFamily || item?.dmvSourceFamily || item?.source_family || "")
    .trim()
    .toLowerCase();
}

function isDmvSource(item) {
  return (
    getSourceFamily(item) === "dmv" ||
    Boolean(item?.dmvState || item?.dmvRegion || item?.dmvCountry)
  );
}

function getCatalogEntryMode(entry) {
  const rssUrl = entry?.rssUrl || entry?.rss_url || "";
  return String(entry?.mode || (rssUrl ? "rss" : "link-only")).toLowerCase();
}

function getCatalogEntryRssUrl(entry) {
  return String(entry?.rssUrl || entry?.rss_url || "").trim();
}

function getUsDmvFeeds() {
  return getDmvFeeds().filter((feed) => {
    const country = getFeedCountry(feed);
    return country === "us" || (!country && !isCanadianDmvAbbr(feed.dmvAbbr));
  });
}

function getCanadaImportedDmvFeeds() {
  return getDmvFeeds().filter(isCanadaRssBackedFeed);
}

function getUsDmvCatalogEntries() {
  return state.dmvCatalog
    .filter((entry) => getCatalogEntryCountry(entry) === "us")
    .slice()
    .sort((left, right) =>
      String(getCatalogEntrySubdivisionLabel(left)).localeCompare(String(getCatalogEntrySubdivisionLabel(right)))
    );
}

function getCanadaDmvCatalogEntries() {
  return state.dmvCatalog
    .filter((entry) => getCatalogEntryCountry(entry) === "canada")
    .slice()
    .sort((left, right) =>
      String(getCatalogEntrySubdivisionLabel(left)).localeCompare(String(getCatalogEntrySubdivisionLabel(right)))
    );
}

function isUsLinkOnlyEntry(entry) {
  return getCatalogEntryCountry(entry) === "us" && getCatalogEntryMode(entry) === "link-only";
}

function isCanadaLinkOnlyEntry(entry) {
  return getCatalogEntryCountry(entry) === "canada" && getCatalogEntryMode(entry) === "link-only";
}

function isCanadaLinkOnlyFeed(feed) {
  const catalogEntry = getCanadaCatalogEntryForFeed(feed);

  if (catalogEntry) {
    if (getCatalogEntryMode(catalogEntry) === "rss") {
      return false;
    }

    return isCanadaLinkOnlyEntry(catalogEntry);
  }

  const name = String(feed?.name || "").toLowerCase();
  const country = getFeedCountry(feed);

  return (
    country === "canada" ||
    isCanadianDmvAbbr(feed?.dmvAbbr) ||
    isCanadianDmvName(name)
  );
}

function isCanadaRssBackedFeed(feed) {
  const catalogEntry = getCanadaCatalogEntryForFeed(feed);
  const catalogRssUrl = getCatalogEntryRssUrl(catalogEntry);
  const feedRssUrl = String(feed?.rssUrl || "").trim();

  return Boolean(
    getCatalogEntryCountry(catalogEntry) === "canada" &&
      getCatalogEntryMode(catalogEntry) === "rss" &&
      catalogRssUrl &&
      feedRssUrl === catalogRssUrl
  );
}

function isLinkOnlyDmvSource(feed) {
  return Boolean(
    isCanadaLinkOnlyFeed(feed) ||
      feed?.isCatalogOnly ||
      feed?.sourceType === "link-only" ||
      feed?.dmvMode === "link-only"
  );
}

function isRssBackedDmvFeed(feed) {
  return Boolean(isCanadaRssBackedFeed(feed) || (isDmvSource(feed) && feed?.dmvMode === "rss"));
}

function toCatalogSource(entry, { idPrefix = "catalog-dmv", topic = "DMV Directory" } = {}) {
  const stateName = String(getCatalogEntrySubdivisionLabel(entry) || "DMV Directory").trim();
  const title = stateName.toLowerCase().includes("dmv") ? stateName : `${stateName} DMV`;
  const country = getCatalogEntryCountry(entry);

  return {
    id: `${idPrefix}-${country}-${entry?.feedPath || entry?.abbr || stateName}`,
    name: title,
    topic,
    rssUrl: entry?.officialUrl || "",
    officialUrl: entry?.officialUrl || "",
    sourceType: "link-only",
    isActive: true,
    isCatalogOnly: true,
    lastFetchedAt: null,
    lastStatus: "idle",
    dmvState: getCatalogEntrySubdivisionLabel(entry),
    dmvAbbr: entry?.abbr || null,
    dmvFeedPath: entry?.feedPath || null,
    dmvRegion: country,
    dmvCountry: country,
    dmvSubdivision: getCatalogEntrySubdivisionLabel(entry),
    dmvSubdivisionType: entry?.subdivisionType || (country === "canada" ? "province-territory" : "region"),
    dmvSourceFamily: entry?.sourceFamily || "dmv",
    dmvMode: getCatalogEntryMode(entry),
  };
}

function getCatalogOnlySourcesForCountry(country) {
  const normalizedCountry = normalizeCountry(country);
  const countryLabel = getCountryLabel(normalizedCountry) || "DMV";

  return state.dmvCatalog
    .filter(
      (entry) =>
        getCatalogEntryCountry(entry) === normalizedCountry &&
        getCatalogEntryMode(entry) === "link-only" &&
        !getFeedForCatalogEntry(entry)
    )
    .map((entry) =>
      toCatalogSource(entry, {
        idPrefix: `catalog-${normalizedCountry}`,
        topic: `${countryLabel} DMV`,
      })
    );
}

function getNonUsCatalogOnlySources() {
  return state.dmvCatalog
    .filter(
      (entry) =>
        getCatalogEntryCountry(entry) !== "us" &&
        getCatalogEntryMode(entry) === "link-only" &&
        !getFeedForCatalogEntry(entry)
    )
    .map((entry) => {
      const country = getCatalogEntryCountry(entry);
      const countryLabel = getCountryLabel(country) || "DMV";
      return toCatalogSource(entry, {
        idPrefix: `catalog-${country}`,
        topic: `${countryLabel} DMV`,
      });
    });
}

function getCanadaCatalogOnlySources() {
  return getCatalogOnlySourcesForCountry("canada");
}

function isGoogleAlertsFeed(feed) {
  const name = String(feed?.name || "").toLowerCase();
  const rssUrl = String(feed?.rssUrl || "").toLowerCase();

  return (
    feed?.sourceType === "google" ||
    name.includes("google") ||
    name.includes("alert") ||
    rssUrl.includes("google.com/alerts")
  );
}

function isCanadianDmvName(name) {
  return [
    "alberta",
    "british columbia",
    "manitoba",
    "new brunswick",
    "newfoundland and labrador",
    "nova scotia",
    "northwest territories",
    "nunavut",
    "ontario",
    "prince edward island",
    "quebec",
    "saskatchewan",
    "yukon",
  ].some((province) => name.includes(province));
}

function getFeedGroupName(feed) {
  const name = String(feed?.name || "").toLowerCase();
  const country = getFeedCountry(feed);

  if (isDmvSource(feed) && country) {
    return getCountryLabel(country);
  }

  if (
    isCanadianDmvAbbr(feed?.dmvAbbr) ||
    isCanadianDmvName(name) ||
    name.includes("canada")
  ) {
    return "Canada";
  }

  if (name.includes("dmv")) {
    return "USA";
  }

  if (isGoogleAlertsFeed(feed)) {
    return "Google Alerts";
  }

  return "Other";
}

function getSourceGroupLabels(feeds) {
  const labels = new Set(DEFAULT_SOURCE_GROUPS.filter((label) => label !== "Other"));
  feeds.forEach((feed) => {
    const label = getFeedGroupName(feed);
    if (label && label !== "Other") {
      labels.add(label);
    }
  });
  return Array.from(labels).concat("Other");
}

function getSourceGroupTabLabels() {
  return ["all"].concat(getSourceGroupLabels(state.feeds.concat(getNonUsCatalogOnlySources())));
}

function getActiveArticleFeedId() {
  if (state.filters.feedId) {
    return state.filters.feedId;
  }

  if (state.filters.dmvFeedId) {
    return getSelectedDmvFeed()?.id || "";
  }

  const selectedCanadaFeed = getSelectedCanadaFeed();
  return selectedCanadaFeed?.id || "";
}

function getActiveSidebarFeedId() {
  if (state.filters.feedId) {
    return state.filters.feedId;
  }

  if (state.filters.dmvFeedId) {
    return state.filters.dmvFeedId;
  }

  const selectedCanadaFeed = getSelectedCanadaFeed();
  return selectedCanadaFeed?.id || "";
}

function getSourceListMode() {
  if (state.filters.feedId) {
    return "normal-feed";
  }

  if (state.filters.canadaDmvFeedPath) {
    return "canada-entry";
  }

  if (state.filters.dmvFeedId) {
    return "dmv-feed";
  }

  if (state.filters.canadaDmvAll) {
    return "canada-all";
  }

  if (state.dashboardMode === "usa") {
    return "dmv-only";
  }

  if (state.dashboardMode === "canada") {
    return "canada-all";
  }

  return "all";
}

function getSelectedUsDmvCatalogEntry() {
  if (!state.filters.dmvFeedId) {
    return null;
  }

  return state.dmvCatalog.find(
    (entry) => getCatalogEntryCountry(entry) === "us" && entry.abbr === state.filters.dmvFeedId
  ) || null;
}

function getSelectedCanadaCatalogEntry() {
  if (!state.filters.canadaDmvFeedPath) {
    return null;
  }

  return state.dmvCatalog.find((entry) => entry.feedPath === state.filters.canadaDmvFeedPath) || null;
}

function getFeedForCatalogEntry(entry) {
  if (!entry) {
    return null;
  }

  if (getCatalogEntryCountry(entry) !== "us") {
    const entryRssUrl = getCatalogEntryRssUrl(entry);

    if (getCatalogEntryMode(entry) !== "rss" || !entryRssUrl) {
      return null;
    }

    return state.feeds.find((feed) => String(feed.rssUrl || "").trim() === entryRssUrl) || null;
  }

  return state.feeds.find((feed) => {
    const entryState = String(getCatalogEntrySubdivisionLabel(entry) || "").toLowerCase();
    const feedName = String(feed.name || "").toLowerCase();
    const entryRssUrl = getCatalogEntryRssUrl(entry);

    if (entryRssUrl && String(feed.rssUrl || "").trim() === entryRssUrl) {
      return true;
    }

    if (entry.abbr && feed.dmvAbbr === entry.abbr) {
      return true;
    }

    if (entryState && feedName.includes(entryState) && feedName.includes("dmv")) {
      return true;
    }

    return false;
  }) || null;
}

function getCanadaCatalogEntryForFeed(feed) {
  if (!feed) {
    return null;
  }

  const feedName = String(feed.name || "").toLowerCase();
  const feedUrl = String(feed.rssUrl || "").trim();
  const feedAbbr = String(feed.dmvAbbr || "").toUpperCase();

  return getCanadaDmvCatalogEntries().find((entry) => {
    const entryMode = getCatalogEntryMode(entry);
    const entryUrl = getCatalogEntryRssUrl(entry);
    const entryState = String(getCatalogEntrySubdivisionLabel(entry)).toLowerCase();
    const entryAbbr = String(entry.abbr || "").toUpperCase();

    if (entryMode === "rss") {
      return Boolean(entryUrl && feedUrl === entryUrl);
    }

    return (
      (entryAbbr && feedAbbr === entryAbbr) ||
      (entryState && feedName.includes(entryState))
    );
  }) || null;
}

function getSelectedDmvFeed() {
  return getFeedForCatalogEntry(getSelectedUsDmvCatalogEntry());
}

function getSelectedCanadaFeed() {
  return getFeedForCatalogEntry(getSelectedCanadaCatalogEntry());
}

function isDmvFeedId(feedId) {
  return state.feeds.some((feed) => feed.id === feedId && isDmvWrapperFeed(feed));
}

function isOfficialFallbackArticle(article) {
  const title = String(article?.title || "").toLowerCase();
  return (
    title.includes("dmv official site") ||
    article?.sourceType === "dmv-official" ||
    article?.isOfficialFallback === true
  );
}

function getFeedStatusPresentation(feed) {
  if (isLinkOnlyDmvSource(feed)) {
    return {
      text: "No RSS",
      tone: "is-idle",
    };
  }

  const tone =
    feed.lastStatus === "error"
      ? "is-error"
      : feed.lastStatus === "success"
        ? "is-success"
        : "is-idle";

  return {
    text: feed.lastStatus || "idle",
    tone,
  };
}

function isFeedError(feed) {
  return feed?.lastStatus === "error" && !isLinkOnlyDmvSource(feed);
}

function syncFeedErrorNotifications() {
  const errorFeeds = state.feeds.filter(isFeedError);
  const currentErrorFeedIds = new Set(errorFeeds.map((feed) => feed.id));

  if (runtime.snapshotLoaded) {
    errorFeeds
      .filter((feed) => !runtime.knownErrorFeedIds.has(feed.id))
      .slice(0, 3)
      .forEach((feed) => {
        showNotification({
          title: "Feed error detected",
          message: feed.name || "A feed reported an error.",
          type: "warning",
        });
      });
  }

  runtime.knownErrorFeedIds = currentErrorFeedIds;
  runtime.snapshotLoaded = true;
}

function syncNewArticleNotifications(articles) {
  const realArticles = articles.filter((article) => !isOfficialFallbackArticle(article));
  const currentArticleIds = new Set(realArticles.map((article) => article.id).filter(Boolean));

  if (!runtime.snapshotLoaded) {
    runtime.knownArticleIds = currentArticleIds;
    return;
  }

  if (!runtime.realtimeEnabled) {
    const newArticles = realArticles.filter((article) => article.id && !runtime.knownArticleIds.has(article.id));
    if (newArticles.length) {
      const firstArticle = newArticles
        .slice()
        .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime())[0];
      showNotification({
        title: "New articles detected",
        message:
          newArticles.length === 1
            ? firstArticle.title || "A new article was added."
            : `${newArticles.length} new articles were added. Latest: ${firstArticle.title || "Untitled article"}`,
        type: "info",
      });
    }
  }

  runtime.knownArticleIds = currentArticleIds;
}

function getSummaryMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const realArticles = state.articles.filter((article) => !isOfficialFallbackArticle(article));

  return {
    activeFeeds: state.feeds.filter((feed) => feed.isActive !== false).length,
    topics: new Set(
      state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean)
    ).size,
    articlesToday: realArticles.filter((article) => toDate(article.pubDate) >= startOfToday).length,
    totalArticles: realArticles.length,
  };
}

function getFeedArticleCounts(articles) {
  return articles.reduce((counts, article) => {
    const feedId = article.feedId || "";
    if (!feedId) {
      return counts;
    }

    counts.set(feedId, (counts.get(feedId) || 0) + 1);
    return counts;
  }, new Map());
}

function getRecentWindowStart() {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isAnalyticsFeed(feed) {
  return Boolean(feed?.sourceType !== "link-only" && !isLinkOnlyDmvSource(feed));
}

function getFeedActivityStats(feeds, articles) {
  const recentWindowStart = getRecentWindowStart();
  const stats = new Map(
    feeds
      .filter(isAnalyticsFeed)
      .map((feed) => [
        feed.id,
        {
          feed,
          total: 0,
          recent: 0,
          lastArticleDate: null,
          status: "",
        },
      ])
  );

  articles.forEach((article) => {
    const feedStats = stats.get(article.feedId);
    if (!feedStats) {
      return;
    }

    const articleDate = toDate(article.pubDate);
    feedStats.total += 1;
    if (articleDate >= recentWindowStart) {
      feedStats.recent += 1;
    }
    if (!feedStats.lastArticleDate || articleDate > feedStats.lastArticleDate) {
      feedStats.lastArticleDate = articleDate;
    }
  });

  stats.forEach((feedStats) => {
    feedStats.status =
      feedStats.total === 0
        ? "dead"
        : feedStats.recent === 0
          ? "inactive"
          : feedStats.total < LOW_VALUE_ARTICLE_THRESHOLD
            ? "low-value"
            : "healthy";
  });

  return stats;
}

function getCombinedFeedRankings(totalCounts, todayCounts, recentCounts, limit = 8) {
  return Array.from(totalCounts.entries())
    .map(([feedId, total]) => ({
      feedId,
      total,
      today: todayCounts.get(feedId) || 0,
      recent: recentCounts.get(feedId) || 0,
      name: getFeedName(feedId),
      topic: getFeedTopic(feedId),
    }))
    .map((item) => ({
      ...item,
      score: item.today * 12 + item.recent * 2 + Math.log10(item.total + 1) * 10,
    }))
    .sort((left, right) => right.score - left.score || right.today - left.today || right.total - left.total || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function getLowValueFeeds(articles, limit = 8) {
  return Array.from(getFeedActivityStats(state.feeds, articles).values())
    .filter((stats) => stats.status !== "healthy")
    .map((stats) => ({
      id: stats.feed.id,
      name: stats.feed.name || "Untitled feed",
      total: stats.total,
      lastArticleDate: stats.lastArticleDate,
      status: stats.status,
    }))
    .sort((left, right) => {
      const statusPriority = { dead: 0, inactive: 1, "low-value": 2 };
      const leftPriority = statusPriority[left.status] ?? 3;
      const rightPriority = statusPriority[right.status] ?? 3;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftTime = left.lastArticleDate ? left.lastArticleDate.getTime() : 0;
      const rightTime = right.lastArticleDate ? right.lastArticleDate.getTime() : 0;
      return leftTime - rightTime || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

function renderAnalyticsRows(items, emptyText) {
  if (!items.length) {
    return `<p class="analytics-empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ol class="analytics-list">
      ${items
        .map(
          (item) => `
            <li>
              <span>${escapeHtml(item.name)}</span>
              <strong>${item.count}</strong>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderFeedRankingRows(items) {
  if (!items.length) {
    return `<p class="analytics-empty">No article volume yet.</p>`;
  }

  return `
    <ol class="analytics-list analytics-ranking-list">
      ${items
        .map((item) => {
          const topic = String(item.topic || "");
          const clickableAttrs = topic
            ? `class="analytics-clickable" data-analytics-topic="${escapeHtml(topic)}" role="button" tabindex="0" title="Click to filter articles"`
            : "";
          const todayClickableAttrs = topic
            ? `class="analytics-clickable" data-analytics-topic="${escapeHtml(topic)}" data-analytics-today-only="true" role="button" tabindex="0" title="Click to filter articles from today"`
            : "";
          return `
            <li>
              <span ${clickableAttrs}>${escapeHtml(item.name)}</span>
              <div class="analytics-count-pair">
                <strong>${item.total} total</strong>
                <strong ${todayClickableAttrs}>${item.today} today</strong>
              </div>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderLowValueFeedRows(items) {
  if (!items.length) {
    return `<p class="analytics-empty">No dead or inactive feeds detected.</p>`;
  }

  return `
    <ol class="analytics-list analytics-low-value-list">
      ${items
        .map((item) => {
          const lastArticle = item.lastArticleDate ? formatDate(item.lastArticleDate) : "never";
          return `
            <li>
              <span>
                ${escapeHtml(item.name)}
                <small>${item.total} total - last: ${escapeHtml(lastArticle)}</small>
              </span>
              <strong class="analytics-status is-${item.status}">${item.status}</strong>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function addDashboardAlert({
  title,
  detail = "",
  type = "info",
  topic = "",
  todayOnly = false,
  articleIds = [],
}) {
  const exactArticleIds = Array.from(new Set((articleIds || []).filter(Boolean))).sort();
  runtime.dashboardAlertId += 1;
  runtime.dashboardAlerts.unshift({
    id: String(runtime.dashboardAlertId),
    title,
    detail,
    type,
    topic,
    todayOnly,
    articleIds: exactArticleIds,
    createdAt: new Date(),
  });
  runtime.dashboardAlerts = runtime.dashboardAlerts.slice(0, DASHBOARD_ALERT_LIMIT);
}

function dismissDashboardAlert(alertId) {
  runtime.dashboardAlerts = runtime.dashboardAlerts.filter((alert) => alert.id !== alertId);
  renderSummary();
}

function renderDashboardAlerts() {
  if (!runtime.dashboardAlerts.length) {
    return `<p class="analytics-empty">No recent feed alerts this session.</p>`;
  }

  return `
    <ol class="dashboard-alert-list">
      ${runtime.dashboardAlerts
        .map((alert) => {
          const isClickable = Array.isArray(alert.articleIds) && alert.articleIds.length > 0;
          return `
            <li
              class="dashboard-alert is-${alert.type}${isClickable ? " analytics-clickable" : ""}"
              ${isClickable ? `data-alert-id="${escapeHtml(alert.id)}" role="button" tabindex="0" title="Click to view exact matching articles"` : ""}
            >
              <div>
                <strong>${escapeHtml(alert.title)}</strong>
                ${alert.detail ? `<small>${escapeHtml(alert.detail)}</small>` : ""}
              </div>
              <button type="button" data-dismiss-dashboard-alert="${alert.id}" aria-label="Dismiss alert">Dismiss</button>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function buildFeedStats(feeds, articles, todayStart) {
  const feedStats = feeds.reduce((stats, feed) => {
    stats[feed.id] = {
      total: 0,
      today: 0,
    };
    return stats;
  }, {});

  articles.forEach((article) => {
    if (!article.feedId || !feedStats[article.feedId]) {
      return;
    }

    feedStats[article.feedId].total += 1;
    if (toDate(article.pubDate) >= todayStart) {
      feedStats[article.feedId].today += 1;
    }
  });

  return feedStats;
}

function createSnapshotStats(feeds, articles) {
  const realArticles = articles.filter((article) => !isOfficialFallbackArticle(article));
  const articleIds = new Set(realArticles.map((article) => article.id).filter(Boolean));
  const feedActivity = getFeedActivityStats(feeds, realArticles);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const feedStats = buildFeedStats(feeds, realArticles, todayStart);
  const snapshotArticles = realArticles.map((article) => ({
    id: article.id,
    feedId: article.feedId,
    pubDate: article.pubDate,
  }));
  const snapshotFeeds = feeds.map((feed) => ({
    id: feed.id,
    name: feed.name || "Untitled feed",
    topic: feed.topic || "",
    isActive: feed.isActive !== false,
    lastStatus: feed.lastStatus || "idle",
  }));
  const feedStates = new Map(
    snapshotFeeds.map((feed) => [
      feed.id,
      {
        id: feed.id,
        name: feed.name,
        isActive: feed.isActive,
        lastStatus: feed.lastStatus || "idle",
        isError: feed.lastStatus === "error",
        articlesToday: feedStats[feed.id]?.today || 0,
      },
    ])
  );
  const feedsById = new Map(feeds.map((feed) => [feed.id, feed]));

  return {
    articleIds,
    articles: snapshotArticles,
    totalArticles: snapshotArticles.length,
    articlesToday: snapshotArticles.filter((article) => toDate(article.pubDate) >= todayStart).length,
    feedStats,
    hasFeedStats: true,
    feeds: snapshotFeeds,
    feedActivity,
    feedStates,
    feedErrors: new Set(feeds.filter(isFeedError).map((feed) => feed.id)),
    feedsById,
  };
}

function serializeSnapshotStats(snapshot) {
  return {
    articleIds: Array.from(snapshot.articleIds),
    articles: snapshot.articles || [],
    totalArticles: snapshot.totalArticles,
    articlesToday: snapshot.articlesToday,
    feedStats: snapshot.feedStats || {},
    hasFeedStats: snapshot.hasFeedStats === true,
    feeds: snapshot.feeds || Array.from(snapshot.feedStates?.values?.() || []).map((feed) => ({
      id: feed.id,
      name: feed.name,
      topic: feed.topic || "",
      isActive: feed.isActive,
      lastStatus: feed.lastStatus,
      articleCountToday: Number(feed.articleCountToday ?? feed.articlesToday) || 0,
    })),
    feedErrors: Array.from(snapshot.feedErrors),
    feedStates: Array.from(snapshot.feedStates?.values?.() || []),
    feedActivity: Array.from(snapshot.feedActivity.entries()).map(([feedId, stats]) => ({
      feedId,
      name: stats.feed.name || "Untitled feed",
      isActive: stats.feed.isActive !== false,
      lastStatus: stats.feed.lastStatus || "idle",
      isDmvRssFeed: isDmvSource(stats.feed) && stats.feed.dmvMode === "rss",
      total: stats.total,
      recent: stats.recent,
      status: stats.status,
      lastArticleDate: stats.lastArticleDate ? stats.lastArticleDate.toISOString() : null,
    })),
  };
}

function hydrateSnapshotStats(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.articleIds)) {
    return null;
  }

  const feedActivityItems = Array.isArray(snapshot.feedActivity) ? snapshot.feedActivity : [];
  const feedActivity = new Map(
    feedActivityItems.map((item) => [
      item.feedId,
      {
        feed: {
          id: item.feedId,
          name: item.name,
          isActive: item.isActive,
          lastStatus: item.lastStatus,
          dmvMode: item.isDmvRssFeed ? "rss" : "",
          dmvCountry: item.isDmvRssFeed ? "stored" : "",
        },
        total: Number(item.total) || 0,
        recent: Number(item.recent) || 0,
        status: item.status || "",
        lastArticleDate: item.lastArticleDate ? new Date(item.lastArticleDate) : null,
        isDmvRssFeed: Boolean(item.isDmvRssFeed),
        isActive: item.isActive !== false,
        lastStatus: item.lastStatus || "idle",
      },
    ])
  );
  const fallbackFeedStates = feedActivityItems.map((item) => ({
    id: item.feedId,
    name: item.name,
    isActive: item.isActive !== false,
    lastStatus: item.lastStatus || "idle",
    isError: item.lastStatus === "error",
    articlesToday: 0,
  }));
  const snapshotFeeds = Array.isArray(snapshot.feeds)
    ? snapshot.feeds
    : (Array.isArray(snapshot.feedStates) ? snapshot.feedStates : fallbackFeedStates).map((item) => ({
        id: item.id,
        name: item.name || "Untitled feed",
        topic: item.topic || "",
        isActive: item.isActive !== false,
        lastStatus: item.lastStatus || "idle",
      }));
  const feedStats =
    snapshot.feedStats && typeof snapshot.feedStats === "object"
      ? snapshot.feedStats
      : snapshotFeeds.reduce((stats, feed) => {
          stats[feed.id] = {
            total: 0,
            today: Number(feed.articleCountToday ?? feed.articlesToday) || 0,
          };
          return stats;
        }, {});
  const hasFeedStats = snapshot.hasFeedStats === true || Boolean(snapshot.feedStats && typeof snapshot.feedStats === "object");
  const feedStates = new Map(
    snapshotFeeds.map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name || "Untitled feed",
        isActive: item.isActive !== false,
        lastStatus: item.lastStatus || "idle",
        isError: item.lastStatus === "error" || Boolean(item.isError),
        articlesToday: Number(feedStats[item.id]?.today) || 0,
      },
    ])
  );

  return {
    articleIds: new Set(snapshot.articleIds),
    articles: Array.isArray(snapshot.articles) ? snapshot.articles : snapshot.articleIds.map((id) => ({ id })),
    totalArticles: Number(snapshot.totalArticles) || snapshot.articleIds.length,
    articlesToday: Number(snapshot.articlesToday) || 0,
    feedStats,
    hasFeedStats,
    feeds: snapshotFeeds,
    feedErrors: new Set(Array.isArray(snapshot.feedErrors) ? snapshot.feedErrors : []),
    feedActivity,
    feedStates,
    feedsById: new Map(
      feedActivityItems.map((item) => [
        item.feedId,
        {
          id: item.feedId,
          name: item.name,
          isActive: item.isActive,
          lastStatus: item.lastStatus,
          dmvMode: item.isDmvRssFeed ? "rss" : "",
          dmvCountry: item.isDmvRssFeed ? "stored" : "",
        },
      ])
    ),
  };
}

function loadStoredAlertSnapshot() {
  try {
    return hydrateSnapshotStats(JSON.parse(window.localStorage.getItem(ALERT_SNAPSHOT_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function saveAlertSnapshot(snapshot) {
  try {
    window.localStorage.setItem(ALERT_SNAPSHOT_STORAGE_KEY, JSON.stringify(serializeSnapshotStats(snapshot)));
  } catch {
    // Storage can fail in private browsing or quota-constrained environments; alerts still work in-memory.
  }
}

function getAlertDedupeKey(alert) {
  const exactArticleIds = Array.isArray(alert.articleIds) ? alert.articleIds.join(",") : "";
  return [alert.type || "info", alert.title || "", alert.detail || "", exactArticleIds].join("|").toLowerCase();
}

function loadRecentAlertKeys() {
  try {
    const now = Date.now();
    return JSON.parse(window.localStorage.getItem(ALERT_DEDUPE_STORAGE_KEY) || "[]").filter(
      (entry) => entry?.key && now - Number(entry.shownAt || 0) < ALERT_DEDUPE_WINDOW_MS
    );
  } catch {
    return [];
  }
}

function saveRecentAlertKeys(entries) {
  try {
    window.localStorage.setItem(ALERT_DEDUPE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Alert dedupe is a convenience; alerts can still render without storage access.
  }
}

function shouldShowDashboardAlert(alert) {
  const key = getAlertDedupeKey(alert);
  const recentKeys = loadRecentAlertKeys();
  if (recentKeys.some((entry) => entry.key === key)) {
    return false;
  }

  recentKeys.unshift({ key, shownAt: Date.now() });
  saveRecentAlertKeys(recentKeys.slice(0, 50));
  return true;
}

function generateAlerts(previous, current) {
  console.log("[alerts][snapshot-compare]", { previous, current });
  const candidates = [];
  const feedDiffs = [];
  const queueAlert = (priority, alert, score = 0) => {
    candidates.push({ priority, score, alert });
  };

  if (!previous) {
    addDashboardAlert({
      title: "Monitoring started",
      detail: "Alerts will compare future snapshots against this baseline.",
      type: "info",
    });
    return;
  }

  const previousArticleIds = previous.articleIds instanceof Set
    ? previous.articleIds
    : new Set(Array.isArray(previous.articleIds) ? previous.articleIds : []);
  const newArticles = (current.articles || []).filter((article) => article.id && !previousArticleIds.has(article.id));
  const newArticleIds = newArticles.map((article) => article.id);
  const newArticleIdsByFeed = newArticles.reduce((groups, article) => {
    if (!article.feedId) {
      return groups;
    }

    const feedArticleIds = groups.get(article.feedId) || [];
    feedArticleIds.push(article.id);
    groups.set(article.feedId, feedArticleIds);
    return groups;
  }, new Map());
  const newArticleCount = newArticleIds.length;
  if (newArticleCount > 0) {
    queueAlert(3, {
      title: `+${newArticleCount} new article${newArticleCount === 1 ? "" : "s"} since last refresh`,
      detail: "Total article count increased since the previous snapshot.",
      type: "info",
      articleIds: newArticleIds,
    });
  }

  const previousFeedsById = new Map((previous.feeds || []).map((feed) => [feed.id, feed]));
  const previousFeedStats = previous.feedStats || {};
  const currentFeedStats = current.feedStats || {};
  const canCompareFeedStats = previous.hasFeedStats === true;

  (current.feeds || []).forEach((feed) => {
    const previousFeed = previousFeedsById.get(feed.id);
    const previousStats = previousFeedStats[feed.id];
    const currentStats = currentFeedStats[feed.id];
    if (!previousFeed || !currentStats) {
      return;
    }

    const previousTotal = canCompareFeedStats && previousStats ? Number(previousStats.total) || 0 : null;
    const currentTotal = Number(currentStats.total) || 0;
    const totalDiff = previousTotal === null ? 0 : currentTotal - previousTotal;
    const previousToday = canCompareFeedStats && previousStats ? Number(previousStats.today) || 0 : null;
    const currentToday = Number(currentStats.today) || 0;
    const todayDiff = previousToday === null ? 0 : currentToday - previousToday;
    const enteredError = previousFeed.lastStatus !== "error" && feed.lastStatus === "error";
    const alertScore = currentToday * 3 + currentTotal * 0.1;
    const passesFeedThreshold = canCompareFeedStats && (totalDiff >= 2 || todayDiff >= 1);
    const feedNewArticleIds = newArticleIdsByFeed.get(feed.id) || [];

    if ((canCompareFeedStats && (totalDiff !== 0 || todayDiff !== 0)) || enteredError) {
      feedDiffs.push({
        id: feed.id,
        name: feed.name,
        previousTotal,
        currentTotal,
        totalDiff,
        previousToday,
        currentToday,
        todayDiff,
        score: alertScore,
        previousStatus: previousFeed.lastStatus,
        currentStatus: feed.lastStatus,
      });
    }

    if (enteredError) {
      queueAlert(1, {
        title: `${feed.name} entered error state`,
        detail: "The feed reported an error in the latest snapshot.",
        type: "error",
        topic: feed.topic || "",
        todayOnly: false,
      }, alertScore);
    }

    if (passesFeedThreshold && totalDiff > 0) {
      queueAlert(2, {
        title: `${feed.name}: +${totalDiff} new articles`,
        detail: `${currentTotal} total article${currentTotal === 1 ? "" : "s"} for this feed.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: false,
        articleIds: feedNewArticleIds,
      }, alertScore);
    }

    if (passesFeedThreshold && previousToday === 0 && currentToday > 0) {
      queueAlert(2, {
        title: `${feed.name} is active again`,
        detail: `+${todayDiff} new article${todayDiff === 1 ? "" : "s"} today.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: true,
        articleIds: feedNewArticleIds,
      }, alertScore);
    } else if (passesFeedThreshold && todayDiff > 0) {
      queueAlert(2, {
        title: `${feed.name}: +${todayDiff} new articles today`,
        detail: `${currentToday} article${currentToday === 1 ? "" : "s"} today.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: true,
        articleIds: feedNewArticleIds,
      }, alertScore);
    } else if (passesFeedThreshold && previousToday > 0 && currentToday === 0) {
      queueAlert(2, {
        title: `${feed.name} stopped producing`,
        detail: "No articles today in the latest snapshot.",
        type: "warning",
        topic: feed.topic || "",
        todayOnly: true,
      }, alertScore);
    }
  });

  console.log("ALERT DIFF", {
    totalDiff: newArticleCount,
    feedDiffs,
  });

  current.feedActivity.forEach((stats, feedId) => {
    const previousStats = previous.feedActivity.get(feedId);
    if (!previousStats) {
      return;
    }

    const feedName = stats.feed.name || "Untitled feed";
    const isDmvRssFeed = isDmvSource(stats.feed) && stats.feed.dmvMode === "rss";
    const wasDmvRssFeed = previousStats.isDmvRssFeed || (isDmvSource(previousStats.feed) && previousStats.feed.dmvMode === "rss");

    if (stats.status === "dead" && previousStats.status !== "dead") {
      queueAlert(1, {
        title: `${feedName} is now dead`,
        detail: "No imported articles are available for this feed.",
        type: "error",
        topic: stats.feed.topic || "",
        todayOnly: false,
      });
    } else if (stats.status === "inactive" && previousStats.status !== "inactive") {
      queueAlert(2, {
        title: `${feedName} is now inactive`,
        detail: "No articles in the last 30 days.",
        type: "warning",
        topic: stats.feed.topic || "",
        todayOnly: false,
      });
    }

    if ((isDmvRssFeed || wasDmvRssFeed) && previousStats.total === 0 && stats.total > 0) {
      queueAlert(2, {
        title: `${feedName} started producing articles`,
        detail: `${stats.total} article${stats.total === 1 ? "" : "s"} now available.`,
        type: "success",
        topic: stats.feed.topic || "",
        todayOnly: false,
        articleIds: newArticleIdsByFeed.get(feedId) || [],
      });
    }

    if ((isDmvRssFeed || wasDmvRssFeed) && stats.status === "inactive" && previousStats.status !== "inactive") {
      queueAlert(2, {
        title: `${feedName} DMV activity stopped`,
        detail: "No DMV RSS articles in the last 30 days.",
        type: "warning",
        topic: stats.feed.topic || "",
        todayOnly: false,
      });
    }
  });

  if (!candidates.length) {
    queueAlert(4, {
      title: "Sources refreshed — no significant changes detected",
      detail: "Article counts and feed status are unchanged since the previous snapshot.",
      type: "info",
    });
  }

  const selectedAlerts = [];
  candidates
    .sort((left, right) => left.priority - right.priority || right.score - left.score)
    .forEach((candidate) => {
      if (selectedAlerts.length < 5 && shouldShowDashboardAlert(candidate.alert)) {
        selectedAlerts.push(candidate);
      }
    });

  selectedAlerts
    .slice()
    .reverse()
    .forEach(({ alert }) => addDashboardAlert(alert));
}

function syncDashboardAlerts(feeds, articles) {
  const previous = loadStoredAlertSnapshot();
  const current = createSnapshotStats(feeds, articles);

  generateAlerts(previous, current);
  runtime.previousSnapshotStats = current;
  saveAlertSnapshot(current);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getDashboardAnalytics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const realArticles = state.articles.filter((article) => !isOfficialFallbackArticle(article));
  const todayArticles = realArticles.filter((article) => toDate(article.pubDate) >= startOfToday);
  const startOfRecentWindow = new Date();
  startOfRecentWindow.setDate(startOfRecentWindow.getDate() - 30);
  startOfRecentWindow.setHours(0, 0, 0, 0);
  const recentArticles = realArticles.filter((article) => toDate(article.pubDate) >= startOfRecentWindow);
  const articleCounts = getFeedArticleCounts(realArticles);
  const todayCounts = getFeedArticleCounts(todayArticles);
  const recentCounts = getFeedArticleCounts(recentArticles);
  const activeFeeds = state.feeds.filter((feed) => feed.isActive !== false).length;
  const errorFeeds = state.feeds.filter(isFeedError).length;
  const rssFeedCount = state.feeds.filter((feed) => feed.sourceType !== "link-only").length;
  const catalogOnlySources = getNonUsCatalogOnlySources();
  const linkOnlyCount =
    state.feeds.filter((feed) => feed.sourceType === "link-only" || isLinkOnlyDmvSource(feed)).length +
    catalogOnlySources.length;
  const feedCount = state.feeds.length + catalogOnlySources.length || 1;
  const lowValueFeeds = getLowValueFeeds(realArticles);
  const deadFeeds = lowValueFeeds.filter((feed) => feed.status === "dead").length;
  const inactiveFeeds = lowValueFeeds.filter((feed) => feed.status === "inactive").length;
  const lowValueCount = lowValueFeeds.filter((feed) => feed.status === "low-value").length;

  return {
    feedRankings: getCombinedFeedRankings(articleCounts, todayCounts, recentCounts),
    lowValueFeeds,
    averageArticlesPerFeed: (realArticles.length / feedCount).toFixed(1),
    averageArticlesTodayPerFeed: (todayArticles.length / feedCount).toFixed(1),
    activeFeeds,
    inactiveFeeds,
    errorFeeds,
    deadFeeds,
    lowValueCount,
    rssFeedCount,
    linkOnlyCount,
    usaFeeds: getUsDmvCatalogEntries().length,
    canadaRssFeeds: getCanadaImportedDmvFeeds().length,
    canadaLinkOnly: getCanadaCatalogOnlySources().length,
    googleAlertsFeeds: state.feeds.filter(isGoogleAlertsFeed).length,
  };
}

function renderAnalyticsCard() {
  const analytics = getDashboardAnalytics();
  const card = document.createElement("article");
  card.className = "summary-card analytics-card";
  card.innerHTML = `
    <div class="analytics-card-head">
      <span class="summary-label">Feed analytics</span>
      <strong class="summary-value">${analytics.averageArticlesPerFeed}</strong>
      <span class="analytics-note">articles per feed</span>
    </div>
    <div class="analytics-grid">
      <div class="analytics-panel analytics-panel-wide">
        <span class="analytics-label">Feed ranking</span>
        ${renderFeedRankingRows(analytics.feedRankings)}
      </div>
      <div class="analytics-panel analytics-panel-wide">
        <span class="analytics-label">Dead / low value feeds</span>
        ${renderLowValueFeedRows(analytics.lowValueFeeds)}
      </div>
      <div class="analytics-panel analytics-panel-wide">
        <span class="analytics-label">Recent alerts</span>
        ${renderDashboardAlerts()}
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">Feed health</span>
        <p>${analytics.activeFeeds} active, ${analytics.errorFeeds} errors, ${analytics.deadFeeds} dead, ${analytics.inactiveFeeds} inactive, ${analytics.lowValueCount} low value</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">Source mix</span>
        <p>${analytics.rssFeedCount} RSS-backed, ${analytics.linkOnlyCount} link-only</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">DMV directory</span>
        <p>${analytics.usaFeeds} USA, ${analytics.canadaRssFeeds} Canada RSS, ${analytics.canadaLinkOnly} Canada link-only</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">Google Alerts</span>
        <p>${analytics.googleAlertsFeeds} feeds, ${analytics.averageArticlesTodayPerFeed} articles today/feed</p>
      </div>
    </div>
  `;

  return card;
}

function renderSummary() {
  const metrics = getSummaryMetrics();
  elements.summaryGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const todayFilterActive = state.filters.date === toDateInputValue(new Date());

  SUMMARY_METRICS.forEach((item) => {
    const card = elements.summaryCardTemplate.content.cloneNode(true);
    const summaryCard = card.querySelector(".summary-card");
    card.querySelector(".summary-label").textContent = item.label;
    card.querySelector(".summary-value").textContent = String(metrics[item.key]);

    if (item.key === "articlesToday") {
      summaryCard.classList.add("is-clickable");
      summaryCard.classList.toggle("is-active", todayFilterActive);
      summaryCard.dataset.action = "filter-today";
      summaryCard.setAttribute("role", "button");
      summaryCard.setAttribute("tabindex", "0");
      summaryCard.setAttribute("aria-pressed", String(todayFilterActive));
      summaryCard.setAttribute("aria-label", "Show today's articles");
    }

    fragment.appendChild(card);
  });

  fragment.appendChild(renderAnalyticsCard());
  elements.summaryGrid.appendChild(fragment);
}

function applyTodayArticleFilter() {
  const today = toDateInputValue(new Date());
  const nextDate = state.filters.date === today ? "" : today;
  clearExactArticleFilter();
  state.filters.date = nextDate;
  elements.dateFilter.value = nextDate;
  renderSummary();
  renderArticles();
}

function loadStoredExactArticleFilter() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(ALERT_ARTICLE_FILTER_STORAGE_KEY) || "null");
    if (!stored || !Array.isArray(stored.articleIds)) {
      return null;
    }

    return {
      articleIds: Array.from(new Set(stored.articleIds.filter(Boolean))),
      label: String(stored.label || "").trim(),
    };
  } catch {
    return null;
  }
}

function saveExactArticleFilter(articleIds, label) {
  try {
    window.sessionStorage.setItem(
      ALERT_ARTICLE_FILTER_STORAGE_KEY,
      JSON.stringify({
        articleIds: Array.from(new Set((articleIds || []).filter(Boolean))),
        label: String(label || "").trim(),
      })
    );
  } catch {
    // Session storage is a convenience; the in-memory alert filter still works without it.
  }
}

function clearStoredExactArticleFilter() {
  try {
    window.sessionStorage.removeItem(ALERT_ARTICLE_FILTER_STORAGE_KEY);
  } catch {
    // Ignore storage failures; clearing the in-memory filter is the important part.
  }
}

function clearExactArticleFilter(options = {}) {
  const { clearStorage = true } = options;
  state.filters.articleIds = [];
  state.filters.alertLabel = "";
  if (clearStorage) {
    clearStoredExactArticleFilter();
  }
}

function restoreExactArticleFilterFromSession() {
  const storedFilter = loadStoredExactArticleFilter();
  if (!storedFilter?.articleIds?.length) {
    return;
  }

  const availableArticleIds = new Set(state.articles.map((article) => article.id).filter(Boolean));
  const restoredArticleIds = storedFilter.articleIds.filter((articleId) => availableArticleIds.has(articleId));

  if (!restoredArticleIds.length) {
    clearExactArticleFilter();
    return;
  }

  state.filters.articleIds = restoredArticleIds;
  state.filters.alertLabel = storedFilter.label || `${restoredArticleIds.length} articles`;
  saveExactArticleFilter(restoredArticleIds, state.filters.alertLabel);
}

function applyAlertArticleFilter(alert) {
  const articleIds = Array.isArray(alert?.articleIds) ? alert.articleIds.filter(Boolean) : [];
  if (!articleIds.length) {
    return;
  }

  state.filters.articleIds = Array.from(new Set(articleIds));
  state.filters.alertLabel = alert.title || `${state.filters.articleIds.length} articles`;
  state.filters.topic = alert.topic || "";
  state.filters.date = alert.todayOnly ? toDateInputValue(new Date()) : "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  elements.topicFilter.value = state.filters.topic;
  elements.dateFilter.value = state.filters.date;
  elements.feedFilter.value = "";
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }

  saveExactArticleFilter(state.filters.articleIds, state.filters.alertLabel);
  renderDashboard();
}

function applyAnalyticsFilter({ topic, todayOnly = false }) {
  const nextTopic = String(topic || "").trim();
  if (!nextTopic) {
    return;
  }

  clearExactArticleFilter();
  state.filters.topic = nextTopic;
  state.filters.date = todayOnly ? toDateInputValue(new Date()) : "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  elements.topicFilter.value = nextTopic;
  elements.dateFilter.value = state.filters.date;
  elements.feedFilter.value = "";
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }

  renderDashboard();
}

function getTodaySummaryCardFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest('[data-action="filter-today"]');
}

function getAnalyticsFilterTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-topic]");
}

function getDashboardAlertTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-alert-id]");
}

function getSelectedOptionText(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function setFieldActive(control, isActive) {
  control?.closest(".field")?.classList.toggle("is-active-filter", Boolean(isActive));
}

function addActiveFilterChip(fragment, label, value, filterKey) {
  const chip = document.createElement("button");
  chip.className = "active-filter-chip";
  chip.type = "button";
  chip.dataset.clearFilter = filterKey;
  chip.setAttribute("aria-label", `Clear ${label} filter`);
  chip.textContent = `${label}: ${value}`;
  fragment.appendChild(chip);
}

function syncFilterUx() {
  if (!elements.activeFilterList) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const sourceSearch = String(elements.feedPanelSearch?.value || "").trim();
  const sourceStatus = elements.feedVisibilityFilter?.value || "all";
  const sourceGroup = state.filters.sourceGroup || "all";

  setFieldActive(elements.searchFilter, Boolean(state.filters.search));
  setFieldActive(elements.topicFilter, Boolean(state.filters.topic));
  setFieldActive(elements.feedFilter, Boolean(state.filters.feedId));
  setFieldActive(elements.dmvFeedFilter, Boolean(state.filters.dmvFeedId || state.dashboardMode === "usa"));
  setFieldActive(
    elements.canadaDmvFilter,
    Boolean(state.filters.canadaDmvFeedPath || state.filters.canadaDmvAll || state.dashboardMode === "canada")
  );
  setFieldActive(elements.dateFilter, Boolean(state.filters.date));
  setFieldActive(elements.feedPanelSearch, Boolean(sourceSearch));
  setFieldActive(elements.feedVisibilityFilter, sourceStatus !== "all");

  if (state.filters.search) {
    addActiveFilterChip(fragment, "Search", state.filters.search, "search");
  }
  if (Array.isArray(state.filters.articleIds) && state.filters.articleIds.length) {
    addActiveFilterChip(
      fragment,
      "Alert",
      state.filters.alertLabel || `${state.filters.articleIds.length} articles`,
      "article-ids"
    );
  }
  if (state.filters.topic) {
    addActiveFilterChip(fragment, "Topic", state.filters.topic, "topic");
  }
  if (state.filters.feedId) {
    addActiveFilterChip(fragment, "Feed", getSelectedOptionText(elements.feedFilter) || "Selected feed", "feed");
  }
  if (state.filters.dmvFeedId) {
    addActiveFilterChip(fragment, "USA", getSelectedOptionText(elements.dmvFeedFilter) || "Selected state", "usa");
  } else if (state.dashboardMode === "usa") {
    addActiveFilterChip(fragment, "Mode", "USA feeds", "mode");
  }
  if (state.filters.canadaDmvFeedPath) {
    addActiveFilterChip(
      fragment,
      "Canada",
      getSelectedOptionText(elements.canadaDmvFilter) || "Selected province",
      "canada"
    );
  } else if (state.filters.canadaDmvAll) {
    addActiveFilterChip(fragment, "Canada", "All Canada DMV", "canada");
  } else if (state.dashboardMode === "canada") {
    addActiveFilterChip(fragment, "Mode", "Canada feeds", "mode");
  }
  if (state.filters.date) {
    addActiveFilterChip(fragment, "Date", state.filters.date, "date");
  }
  if (sourceSearch) {
    addActiveFilterChip(fragment, "Source search", sourceSearch, "source-search");
  }
  if (sourceStatus !== "all") {
    addActiveFilterChip(fragment, "Source status", getSelectedOptionText(elements.feedVisibilityFilter), "source-status");
  }
  if (sourceGroup !== "all") {
    addActiveFilterChip(fragment, "Source group", sourceGroup, "source-group");
  }

  elements.activeFilterList.innerHTML = "";
  elements.activeFilterList.hidden = !fragment.childNodes.length;
  elements.activeFilterList.appendChild(fragment);
  const hasActiveFilters = Boolean(elements.activeFilterList.childNodes.length);
  elements.clearFilters.classList.toggle("is-active-filter", hasActiveFilters);
  elements.clearFilters.textContent = hasActiveFilters ? "Clear active" : "Reset";
  elements.clearFilters.setAttribute(
    "aria-label",
    hasActiveFilters ? "Clear all active filters" : "Reset filters"
  );
  elements.clearFilters.title = hasActiveFilters ? "Clear all active filters" : "Reset filters";
}

function clearActiveFilter(filterKey) {
  if (filterKey === "search") {
    state.filters.search = "";
    elements.searchFilter.value = "";
  } else if (filterKey === "article-ids") {
    clearExactArticleFilter();
  } else if (filterKey === "topic") {
    state.filters.topic = "";
    elements.topicFilter.value = "";
  } else if (filterKey === "feed") {
    state.filters.feedId = "";
    elements.feedFilter.value = "";
  } else if (filterKey === "usa") {
    state.filters.dmvFeedId = "";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
  } else if (filterKey === "canada") {
    state.filters.canadaDmvFeedPath = "";
    state.filters.canadaDmvAll = false;
    if (elements.canadaDmvFilter) {
      elements.canadaDmvFilter.value = "";
    }
  } else if (filterKey === "date") {
    state.filters.date = "";
    elements.dateFilter.value = "";
  } else if (filterKey === "mode") {
    state.dashboardMode = "normal";
  } else if (filterKey === "source-search" && elements.feedPanelSearch) {
    elements.feedPanelSearch.value = "";
  } else if (filterKey === "source-status" && elements.feedVisibilityFilter) {
    elements.feedVisibilityFilter.value = "all";
  } else if (filterKey === "source-group") {
    state.filters.sourceGroup = "all";
  }

  renderDashboard();
}

function renderFeedOptions() {
  const topics = Array.from(
    new Set(state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean))
  ).sort();
  const nonDmvFeeds = getNonDmvFeeds()
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  const usDmvCatalogEntries = getUsDmvCatalogEntries();
  const canadaCatalogEntries = getCanadaDmvCatalogEntries();

  if (
    state.filters.feedId &&
    !nonDmvFeeds.some((feed) => feed.id === state.filters.feedId)
  ) {
    state.filters.feedId = "";
  }

  if (
    state.filters.dmvFeedId &&
    !usDmvCatalogEntries.some((entry) => entry.abbr === state.filters.dmvFeedId)
  ) {
    state.filters.dmvFeedId = "";
  }

  if (
    state.filters.canadaDmvFeedPath &&
    !canadaCatalogEntries.some((entry) => entry.feedPath === state.filters.canadaDmvFeedPath)
  ) {
    state.filters.canadaDmvFeedPath = "";
  }

  if (state.filters.canadaDmvAll && !canadaCatalogEntries.length) {
    state.filters.canadaDmvAll = false;
  }

  elements.topicFilter.innerHTML = [`<option value="">All topics</option>`]
    .concat(topics.map((topic) => `<option value="${topic}">${topic}</option>`))
    .join("");
  elements.topicFilter.value = state.filters.topic;

  elements.feedFilter.innerHTML = [`<option value="">All feeds</option>`]
    .concat(
      nonDmvFeeds.map((feed) => `<option value="${feed.id}">${feed.name || "Untitled Feed"}</option>`)
    )
    .join("");
  elements.feedFilter.value = state.filters.feedId;

  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.innerHTML = [`<option value="">All DMV states</option>`]
      .concat(
        usDmvCatalogEntries.map(
          (entry) => `<option value="${entry.abbr}">${getCatalogEntrySubdivisionLabel(entry)}</option>`
        )
      )
      .join("");
    elements.dmvFeedFilter.value = state.filters.dmvFeedId;
  }

  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.innerHTML = [`<option value="">All Canada DMV</option>`]
      .concat(
        canadaCatalogEntries.map(
          (entry) => `<option value="${entry.feedPath}">${getCatalogEntrySubdivisionLabel(entry)}</option>`
        )
      )
      .join("");
    elements.canadaDmvFilter.value = state.filters.canadaDmvFeedPath;
  }
}

function renderDmvOfficialLink() {
  if (!elements.dmvOfficialLinkWrap || !elements.dmvOfficialLink) {
    return;
  }

  const selectedDmvFeed = getSelectedDmvFeed();
  const selectedUsDmvEntry = getSelectedUsDmvCatalogEntry();
  const selectedCanadaEntry = getSelectedCanadaCatalogEntry();
  const officialUrl = String(
    selectedDmvFeed?.officialUrl ||
      selectedUsDmvEntry?.officialUrl ||
      selectedCanadaEntry?.officialUrl ||
      ""
  ).trim();

  if (!officialUrl) {
    elements.dmvOfficialLinkWrap.hidden = true;
    elements.dmvOfficialLink.removeAttribute("href");
    return;
  }

  elements.dmvOfficialLinkWrap.hidden = false;
  elements.dmvOfficialLink.href = officialUrl;
}

function renderDmvModeIndicator() {
  if (!elements.dmvModeIndicator) {
    return;
  }

  if (state.dashboardMode === "usa") {
    elements.dmvModeIndicator.hidden = false;
    elements.dmvModeIndicator.textContent = "Showing USA DMV feeds only";
    return;
  }

  if (state.dashboardMode === "canada") {
    elements.dmvModeIndicator.hidden = false;
    elements.dmvModeIndicator.textContent = "Showing Canada DMV feeds only";
    return;
  }

  elements.dmvModeIndicator.hidden = true;
}

function getVisibleFeeds() {
  const sourceListMode = getSourceListMode();
  let feeds = state.feeds.slice();
  const canadaCatalogOnlySources = getCanadaCatalogOnlySources();
  const nonUsCatalogOnlySources = getNonUsCatalogOnlySources();
  const feedPanelSearch = String(elements.feedPanelSearch?.value || "").trim().toLowerCase();
  const visibilityFilter = elements.feedVisibilityFilter?.value || "all";
  const groupFilter = state.filters.sourceGroup || "all";

  if (sourceListMode === "dmv-only") {
    feeds = getUsDmvFeeds().slice();
  } else if (sourceListMode === "normal-feed") {
    feeds = feeds.filter((feed) => feed.id === state.filters.feedId);
  } else if (sourceListMode === "canada-entry") {
    const selectedCanadaFeed = getSelectedCanadaFeed();
    const selectedCanadaEntry = getSelectedCanadaCatalogEntry();
    feeds = selectedCanadaFeed
      ? feeds.filter((feed) => feed.id === selectedCanadaFeed.id)
      : selectedCanadaEntry && getCatalogEntryMode(selectedCanadaEntry) === "link-only"
        ? [toCatalogSource(selectedCanadaEntry, { idPrefix: "catalog-canada", topic: "Canada DMV" })]
        : [];
  } else if (sourceListMode === "dmv-feed") {
    const selectedUsFeed = getSelectedDmvFeed();
    feeds = selectedUsFeed ? feeds.filter((feed) => feed.id === selectedUsFeed.id) : [];
  } else if (sourceListMode === "canada-all") {
    feeds = getCanadaImportedDmvFeeds().concat(canadaCatalogOnlySources);
  } else {
    feeds = feeds.concat(nonUsCatalogOnlySources);
  }

  if (visibilityFilter === "active") {
    feeds = feeds.filter(
      (feed) => feed.isActive !== false && (isLinkOnlyDmvSource(feed) || feed.lastStatus !== "error")
    );
  }

  if (visibilityFilter === "inactive") {
    feeds = feeds.filter(
      (feed) => feed.isActive === false || (!isLinkOnlyDmvSource(feed) && feed.lastStatus === "error")
    );
  }

  if (feedPanelSearch) {
    feeds = feeds.filter((feed) => {
      const haystack = [
        feed.name,
        feed.topic,
        feed.rssUrl,
        feed.sourceType,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(feedPanelSearch);
    });
  }

  if (groupFilter !== "all") {
    feeds = feeds.filter((feed) => getFeedGroupName(feed) === groupFilter);
  }

  return feeds.sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""))
  );
}

function updateDmvToggleButton() {
  if (!elements.dmvToggleButton) return;

  if (state.dashboardMode === "usa") {
    elements.dmvToggleButton.textContent = "Show all feeds";
    elements.dmvToggleButton.classList.add("active-toggle");
    elements.dmvToggleButton.setAttribute("aria-pressed", "true");
  } else {
    elements.dmvToggleButton.textContent = "Show USA feeds";
    elements.dmvToggleButton.classList.remove("active-toggle");
    elements.dmvToggleButton.setAttribute("aria-pressed", "false");
  }

  if (!elements.canadaToggleButton) {
    return;
  }

  if (state.dashboardMode === "canada") {
    elements.canadaToggleButton.textContent = "Show all feeds";
    elements.canadaToggleButton.classList.add("active-toggle");
    elements.canadaToggleButton.setAttribute("aria-pressed", "true");
  } else {
    elements.canadaToggleButton.textContent = "Show Canada feeds";
    elements.canadaToggleButton.classList.remove("active-toggle");
    elements.canadaToggleButton.setAttribute("aria-pressed", "false");
  }
}

function syncFeedPanelVisibility() {
  if (!elements.feedPanelToggle || !elements.feedPanelContent) {
    return;
  }

  const collapsed = Boolean(state.feedPanelCollapsed);
  const expanded = !collapsed;
  if (!expanded) {
    state.addSourceExpanded = false;
  }

  const addSourceExpanded = expanded && state.addSourceExpanded;
  const trackedSourcesPanel = elements.feedPanel || elements.feedPanelContent.closest(".panel");

  elements.feedPanelToggle.setAttribute("aria-expanded", String(expanded));
  elements.feedPanelToggle.textContent = expanded ? "Hide sources" : "Show sources";
  elements.feedPanelContent.hidden = collapsed;
  elements.feedPanelContent.classList.toggle("is-collapsed", collapsed);
  trackedSourcesPanel?.classList.toggle("is-collapsed", collapsed);
  trackedSourcesPanel?.setAttribute("data-collapsed", String(collapsed));

  if (elements.addSourceContent) {
    elements.addSourceContent.hidden = !addSourceExpanded;
  }

  if (elements.addSourceToggle) {
    elements.addSourceToggle.setAttribute("aria-expanded", String(addSourceExpanded));
    elements.addSourceToggle.textContent = addSourceExpanded ? "Hide add" : "+ Add";
  }

  console.log("Panel collapsed:", collapsed, {
    feedPanelContentHidden: elements.feedPanelContent.hidden,
    addSourceContentHidden: elements.addSourceContent?.hidden,
  });
}

function syncAddSourcePanel(expanded) {
  if (!elements.addSourceToggle) {
    return;
  }

  state.addSourceExpanded = expanded;
  syncFeedPanelVisibility();
}

function syncSourceGroupTabs() {
  if (!elements.feedGroupTabs) {
    return;
  }

  const labels = getSourceGroupTabLabels();
  if (!labels.includes(state.filters.sourceGroup || "all")) {
    state.filters.sourceGroup = "all";
  }

  const activeGroup = state.filters.sourceGroup || "all";
  elements.feedGroupTabs.innerHTML = "";
  labels.forEach((label) => {
    const button = document.createElement("button");
    const isActive = label === activeGroup;
    button.className = "feed-group-tab";
    button.type = "button";
    button.dataset.sourceGroup = label;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("is-active", isActive);
    button.textContent = label === "all" ? "All" : label;
    elements.feedGroupTabs.appendChild(button);
  });
}

function syncFeedFormMode() {
  const isEditing = Boolean(state.editingFeedId);

  if (elements.feedSubmit) {
    elements.feedSubmit.textContent = isEditing ? "Save changes" : "Add source";
  }

  if (elements.feedCancel) {
    elements.feedCancel.hidden = !isEditing;
  }
}

function resetDashboardState() {
  state.dashboardMode = "normal";
  state.filters.search = "";
  state.filters.topic = "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.filters.sourceGroup = "all";
  state.filters.date = "";
  clearExactArticleFilter({ clearStorage: false });

  if (elements.searchFilter) {
    elements.searchFilter.value = "";
  }
  if (elements.topicFilter) {
    elements.topicFilter.value = "";
  }
  if (elements.feedFilter) {
    elements.feedFilter.value = "";
  }
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }
  if (elements.dateFilter) {
    elements.dateFilter.value = "";
  }
}

function resetFeedForm(options = {}) {
  const { preserveStatus = false } = options;
  state.editingFeedId = "";
  elements.feedForm.reset();
  syncFeedFormMode();

  if (!preserveStatus) {
    elements.feedFormStatus.textContent = "Monitor up to 50 RSS feeds and websites.";
  }
}

function startFeedEdit(feed) {
  if (!feed) {
    return;
  }

  state.editingFeedId = feed.id;
  elements.feedName.value = feed.name || "";
  elements.feedTopic.value = feed.topic || "";
  elements.feedUrl.value = feed.rssUrl || "";
  if (elements.feedSourceType) {
    elements.feedSourceType.value = feed.sourceType || "rss";
  }
  syncFeedFormMode();
  syncAddSourcePanel(true);
  elements.feedFormStatus.textContent = "Editing source. Update the fields and save your changes.";
  elements.feedName.focus();
}

function renderFeedGroupHeader(label) {
  const header = document.createElement("div");
  header.className = "feed-group-heading";
  header.textContent = label;
  return header;
}

function renderFeedItem(feed) {
  const node = elements.feedItemTemplate.content.cloneNode(true);
  const item = node.querySelector(".feed-item");
  const title = node.querySelector(".feed-item-title");
  const meta = node.querySelector(".feed-item-meta");
  const status = node.querySelector(".feed-status");
  const editButton = node.querySelector(".feed-edit-button");
  const deleteButton = node.querySelector(".feed-delete-button");
  const actions = node.querySelector(".feed-item-actions");
  const isCatalogOnly = Boolean(feed.isCatalogOnly);
  const isLinkOnly = isLinkOnlyDmvSource(feed);
  const isRssBacked = isRssBackedDmvFeed(feed);
  const lastFetched = feed.lastFetchedAt
    ? formatDate(feed.lastFetchedAt)
    : isCatalogOnly
      ? "Official link only"
      : "Waiting for first sync";
  const statusPresentation = getFeedStatusPresentation(feed);
  const sourceKind = isLinkOnly
    ? "Link-only source"
    : isRssBacked
      ? "RSS-backed source"
      : "";

  item.classList.toggle("is-catalog-only", isCatalogOnly);
  item.classList.toggle("is-canada-link-only", isCanadaLinkOnlyFeed(feed));
  item.classList.toggle("is-canada-rss", isCanadaRssBackedFeed(feed));
  item.classList.toggle("is-link-only-source", isLinkOnly);
  item.classList.toggle("is-rss-backed-source", isRssBacked);
  title.textContent = feed.name || "Untitled feed";
  meta.textContent = [feed.topic || "General", sourceKind, lastFetched, feed.rssUrl || ""]
    .filter(Boolean)
    .join(" - ");
  status.textContent = statusPresentation.text;
  status.classList.add(statusPresentation.tone);

  if (isCatalogOnly) {
    editButton.hidden = true;
    deleteButton.hidden = true;
    if (feed.officialUrl && actions) {
      const officialLink = document.createElement("a");
      officialLink.className = "ghost-button feed-official-link";
      officialLink.href = feed.officialUrl;
      officialLink.target = "_blank";
      officialLink.rel = "noopener noreferrer";
      officialLink.textContent = "Open official";
      actions.appendChild(officialLink);
    }
  } else {
    editButton.dataset.feedId = feed.id;
    deleteButton.dataset.feedId = feed.id;
    editButton.dataset.action = "edit-feed";
    deleteButton.dataset.action = "delete-feed";
  }

  return node;
}

function renderFeedList() {
  syncSourceGroupTabs();
  const visibleFeeds = getVisibleFeeds();
  const activeGroup = state.filters.sourceGroup || "all";

  elements.feedCount.textContent = String(visibleFeeds.length);
  elements.feedList.innerHTML = "";

  if (!visibleFeeds.length) {
    elements.feedList.innerHTML = `<div class="empty-state">No feeds match the current view.</div>`;
    updateDmvToggleButton();
    syncFilterUx();
    syncFeedPanelVisibility();
    return;
  }

  const fragment = document.createDocumentFragment();
  const groups =
    activeGroup === "all"
      ? getSourceGroupLabels(visibleFeeds).map((label) => ({
          label,
          feeds: visibleFeeds.filter((feed) => getFeedGroupName(feed) === label),
        }))
      : [{ label: activeGroup, feeds: visibleFeeds }];

  groups.forEach((group) => {
    if (!group.feeds.length) {
      return;
    }

    if (activeGroup === "all") {
      fragment.appendChild(renderFeedGroupHeader(group.label));
    }
    group.feeds.forEach((feed) => {
      fragment.appendChild(renderFeedItem(feed));
    });
  });

  elements.feedList.appendChild(fragment);
  updateDmvToggleButton();
  syncFilterUx();
  syncFeedPanelVisibility();
}

function articleMatchesFilters(article) {
  if (isOfficialFallbackArticle(article)) {
    return false;
  }

  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];
  if (exactArticleIds.length) {
    return exactArticleIds.includes(article.id);
  }

  const selectedUsDmvEntry = getSelectedUsDmvCatalogEntry();
  if (selectedUsDmvEntry) {
    if (isUsLinkOnlyEntry(selectedUsDmvEntry)) {
      return false;
    }

    const selectedUsFeed = getSelectedDmvFeed();
    if (!selectedUsFeed || article.feedId !== selectedUsFeed.id) {
      return false;
    }
  }

  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (state.filters.canadaDmvFeedPath) {
    const selectedCanadaFeed = getSelectedCanadaFeed();
    if (!selectedCanadaFeed || article.feedId !== selectedCanadaFeed.id) {
      return false;
    }
  }

  if (getActiveArticleFeedId() && article.feedId !== getActiveArticleFeedId()) {
    return false;
  }

  if (!getActiveArticleFeedId() && state.filters.canadaDmvAll && !isCanadianDmvAbbr(
    state.feeds.find((feed) => feed.id === article.feedId)?.dmvAbbr
  )) {
    return false;
  }

  if (!getActiveArticleFeedId() && state.dashboardMode === "usa" && !isDmvFeedId(article.feedId)) {
    return false;
  }

  if (state.filters.date && toDateInputValue(article.pubDate) !== state.filters.date) {
    return false;
  }

  if (state.filters.search) {
    const haystack = [article.title, article.source, article.topic, getFeedName(article.feedId)]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(state.filters.search.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function getVisibleArticles() {
  return state.articles
    .filter(articleMatchesFilters)
    .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime());
}

function renderArticleCard(article) {
  const node = elements.articleCardTemplate.content.cloneNode(true);
  const link = node.querySelector(".article-link");
  const image = node.querySelector(".article-image");
  const topic = node.querySelector(".article-topic");
  const source = node.querySelector(".article-source");
  const date = node.querySelector(".article-date");
  const title = node.querySelector(".article-title");
  const feed = node.querySelector(".article-feed");
  const finalImageSrc = getArticleImageSrc(article);

  if (
    isNotafiliaUrl(article.link) ||
    isNotafiliaUrl(article.canonicalLink) ||
    isNotafiliaUrl(article.thumbnail)
  ) {
    console.log(
      `[notafilia][frontend] articleUrl=${article.canonicalLink || article.link} apiThumbnail=${article.thumbnail || ""} finalImageSrc=${finalImageSrc || ""}`
    );
  }

  link.href = article.canonicalLink || article.link;
  image.src = finalImageSrc || PLACEHOLDER_IMAGE;
  image.alt = article.title || "Article thumbnail";
  image.onerror = () => {
    image.onerror = null;
    image.src = PLACEHOLDER_IMAGE;
  };

  topic.textContent = article.topic || "General";
  source.textContent = article.source || "Unknown source";
  date.textContent = formatDate(article.pubDate);
  title.textContent = article.title || "Untitled article";
  feed.textContent = getFeedName(article.feedId);

  return node;
}

function renderDmvPlaceholderCard(feed) {
  const card = document.createElement("div");
  const message = document.createElement("p");
  const link = document.createElement("a");
  const officialUrl = String(feed.officialUrl || feed.rssUrl || "#").trim();
  const isLinkOnly = feed?.dmvMode === "link-only";

  card.className = "empty-state";
  message.textContent = isLinkOnly ? "No RSS feed available" : "No news available";

  link.href = officialUrl || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "dmv-official-link";
  link.textContent = "Open official DMV page";

  card.append(message, link);

  return card;
}

function renderDmvEmptyState(message, officialUrl = "") {
  elements.articlesGrid.innerHTML =
    `<div class="empty-state">${message}</div>` +
    (officialUrl
      ? `<div class="empty-state"><a class="dmv-official-link" href="${officialUrl}" target="_blank" rel="noopener noreferrer">Open official DMV page</a></div>`
      : "");
}

function renderFeedGroup(titleText, cards) {
  const section = document.createElement("section");
  section.className = "dmv-feed-group";

  const heading = document.createElement("h3");
  heading.className = "dmv-feed-group-title";
  heading.textContent = titleText;

  const grid = document.createElement("div");
  grid.className = "dmv-feed-group-grid";
  cards.forEach((card) => grid.appendChild(card));

  section.appendChild(heading);
  section.appendChild(grid);
  return section;
}

function renderSkeletons() {
  elements.articlesGrid.classList.remove("is-grouped-feed-view");
  elements.articlesGrid.innerHTML = Array.from({ length: 8 })
    .map(
      () => `
        <article class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-body">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderArticles() {
  const articles = getVisibleArticles();
  const selectedUsDmvEntry = getSelectedUsDmvCatalogEntry();
  const selectedUsDmvFeed = getSelectedDmvFeed();
  const selectedCanadaEntry = getSelectedCanadaCatalogEntry();
  const selectedDmvOfficialUrl = String(
    selectedUsDmvFeed?.officialUrl ||
      selectedUsDmvEntry?.officialUrl ||
      selectedCanadaEntry?.officialUrl ||
      ""
  ).trim();

  syncFilterUx();

  if (state.filters.feedId) {
    elements.articlesGrid.classList.remove("is-grouped-feed-view");
    elements.resultsCount.textContent = `${articles.length} results`;
    elements.articlesGrid.innerHTML = "";

    if (!articles.length) {
      elements.articlesGrid.innerHTML =
        `<div class="empty-state">No articles match the active filters.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    articles.forEach((article) => {
      fragment.appendChild(renderArticleCard(article));
    });
    elements.articlesGrid.appendChild(fragment);
    return;
  }

  if ((selectedUsDmvEntry || selectedCanadaEntry) && !state.filters.feedId) {
    elements.articlesGrid.classList.remove("is-grouped-feed-view");
    elements.resultsCount.textContent = `${articles.length} results`;
    elements.articlesGrid.innerHTML = "";

    if (!articles.length) {
      renderDmvEmptyState(
        isUsLinkOnlyEntry(selectedUsDmvEntry) || isCanadaLinkOnlyEntry(selectedCanadaEntry)
          ? "No RSS feed available for this DMV."
          : "No news available",
        selectedDmvOfficialUrl
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    articles.forEach((article) => {
      fragment.appendChild(renderArticleCard(article));
    });
    elements.articlesGrid.appendChild(fragment);
    return;
  }

  if (state.dashboardMode === "usa" && !getActiveArticleFeedId()) {
    elements.articlesGrid.classList.add("is-grouped-feed-view");
    const dmvFeeds = getUsDmvFeeds();
    const articlesByFeedId = new Map();

    articles.forEach((article) => {
      const items = articlesByFeedId.get(article.feedId) || [];
      items.push(article);
      articlesByFeedId.set(article.feedId, items);
    });

    elements.resultsCount.textContent = `${dmvFeeds.length} results`;
    elements.articlesGrid.innerHTML = "";

    if (!dmvFeeds.length) {
      elements.articlesGrid.innerHTML =
        `<div class="empty-state">No articles match the active filters.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    dmvFeeds.forEach((feed) => {
      const feedArticles = articlesByFeedId.get(feed.id) || [];
      const groupCards = feedArticles.length
        ? feedArticles.map((article) => renderArticleCard(article))
        : [renderDmvPlaceholderCard(feed)];
      fragment.appendChild(renderFeedGroup(feed.name || "Untitled feed", groupCards));
    });
    elements.articlesGrid.appendChild(fragment);
    return;
  }

  if (state.dashboardMode === "canada" && !state.filters.canadaDmvFeedPath) {
    elements.articlesGrid.classList.add("is-grouped-feed-view");
    const canadaEntries = getCanadaDmvCatalogEntries();
    const articlesByFeedId = new Map();

    articles.forEach((article) => {
      const items = articlesByFeedId.get(article.feedId) || [];
      items.push(article);
      articlesByFeedId.set(article.feedId, items);
    });

    elements.resultsCount.textContent = `${canadaEntries.length} results`;
    elements.articlesGrid.innerHTML = "";

    if (!canadaEntries.length) {
      elements.articlesGrid.innerHTML =
        `<div class="empty-state">No imported news available for Canada DMV entries yet.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    canadaEntries.forEach((entry) => {
      const importedFeed = getFeedForCatalogEntry(entry);
      const feedArticles = importedFeed ? articlesByFeedId.get(importedFeed.id) || [] : [];
      const entryLabel = getCatalogEntrySubdivisionLabel(entry);
      const entryCountry = getCatalogEntryCountry(entry);
      const feedLike = importedFeed || {
        name: entryLabel,
        topic: "General",
        officialUrl: entry.officialUrl,
        rssUrl: "",
        dmvMode: getCatalogEntryMode(entry),
        dmvRegion: entryCountry,
        dmvCountry: entryCountry,
        dmvSubdivision: entryLabel,
        dmvSubdivisionType: entry.subdivisionType || "province-territory",
        dmvSourceFamily: entry.sourceFamily || "dmv",
      };
      const groupCards = feedArticles.length
        ? feedArticles.map((article) => renderArticleCard(article))
        : [renderDmvPlaceholderCard(feedLike)];
      fragment.appendChild(renderFeedGroup(entryLabel, groupCards));
    });
    elements.articlesGrid.appendChild(fragment);
    return;
  }

  elements.resultsCount.textContent = `${articles.length} results`;
  elements.articlesGrid.classList.remove("is-grouped-feed-view");
  elements.articlesGrid.innerHTML = "";

  if (!articles.length) {
    const emptyStateMessage = state.filters.canadaDmvAll
      ? "Canada DMV entries are shown as official links unless RSS news is available."
      : selectedCanadaEntry
        ? isCanadaLinkOnlyEntry(selectedCanadaEntry)
          ? "This Canada DMV entry is available as an official link only."
          : "No imported news available for this Canada DMV entry yet."
        : selectedUsDmvEntry
          ? isUsLinkOnlyEntry(selectedUsDmvEntry)
            ? "No RSS feed available for this DMV."
            : "No imported news available for this USA DMV entry yet."
        : selectedUsDmvFeed
          ? "No imported news available for this USA DMV entry yet."
          : "No articles match the active filters.";
    const officialUrl = !state.filters.canadaDmvAll ? selectedDmvOfficialUrl : "";
    renderDmvEmptyState(emptyStateMessage, officialUrl);
    return;
  }

  const fragment = document.createDocumentFragment();

  articles.forEach((article) => {
    fragment.appendChild(renderArticleCard(article));
  });

  elements.articlesGrid.appendChild(fragment);
}

function renderDashboard() {
  renderSummary();
  renderFeedOptions();
  renderDmvOfficialLink();
  renderDmvModeIndicator();
  renderFeedList();
  renderArticles();
  syncFeedPanelVisibility();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return response.json().catch(() => ({}));
}

async function loadAllArticles() {
  const articles = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await apiRequest(
      `/api/articles?includePagination=true&showDuplicates=true&limit=${ARTICLE_PAGE_SIZE}&page=${page}`
    );
    const items = Array.isArray(response?.items) ? response.items : [];
    articles.push(...items);
    totalPages = Math.max(1, Number(response?.pagination?.totalPages) || 1);
    page += 1;
  }

  return articles;
}

async function loadSnapshot() {
  const [feeds, articles, dmvCatalog] = await Promise.all([
    apiRequest("/api/feeds"),
    loadAllArticles(),
    apiRequest("/api/dmv-catalog"),
  ]);

  state.feeds = feeds;
  state.articles = articles;
  state.dmvCatalog = Array.isArray(dmvCatalog) ? dmvCatalog : [];
  restoreExactArticleFilterFromSession();
  syncDashboardAlerts(feeds, articles);
  renderDashboard();
  syncNewArticleNotifications(articles);
  syncFeedErrorNotifications();
  syncFeedPanelVisibility();
}

function startPolling() {
  if (runtime.pollTimer) {
    window.clearInterval(runtime.pollTimer);
  }

  runtime.pollTimer = window.setInterval(() => {
    void loadSnapshot();
  }, POLLING_INTERVAL_MS);
}

function initRealtime() {
  if (runtime.eventSource) {
    runtime.eventSource.close();
  }

  try {
    const eventSource = new EventSource("/api/stream");
    const refreshSnapshot = debounce(() => {
      void loadSnapshot();
    });

    runtime.eventSource = eventSource;
    runtime.realtimeEnabled = true;

    eventSource.addEventListener("ready", () => {
      elements.connectionStatus.textContent = "Live updates enabled.";
    });

    eventSource.addEventListener("article:new", (event) => {
      const payload = parseStreamPayload(event);
      const articleId = payload?.id || payload?.article?.id;
      if (articleId) {
        runtime.knownArticleIds.add(articleId);
      }
      showNotification({
        title: "New article detected",
        message: payload?.title || payload?.article?.title || "A new article was added to the live stream.",
        type: "info",
      });
      refreshSnapshot();
    });

    eventSource.addEventListener("refresh:complete", () => {
      showNotification({
        title: "Feed refresh completed",
        message: "Latest feed data has been loaded.",
        type: "success",
      });
      refreshSnapshot();
    });

    ["article:update", "feed:update"].forEach((eventName) => {
      eventSource.addEventListener(eventName, refreshSnapshot);
    });

    eventSource.onerror = () => {
      runtime.realtimeEnabled = false;
      elements.connectionStatus.textContent = "Realtime unavailable. Using 30 second refresh.";
      eventSource.close();
      startPolling();
    };
  } catch {
    runtime.realtimeEnabled = false;
    elements.connectionStatus.textContent = "Realtime unavailable. Using 30 second refresh.";
    startPolling();
  }
}

async function updateFeed(feedId, payload) {
  return apiRequest(`/api/feeds/${feedId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteFeed(feedId) {
  return apiRequest(`/api/feeds/${feedId}`, {
    method: "DELETE",
  });
}

async function importDmvFeeds() {
  if (!elements.importDmvButton) {
    return;
  }

  const originalLabel = elements.importDmvButton.textContent;
  elements.importDmvButton.disabled = true;
  elements.importDmvButton.textContent = "Importing DMV feeds...";
  elements.feedFormStatus.textContent = "Importing DMV feeds...";

  try {
    const result = await apiRequest("/api/admin/import-dmv", {
      method: "POST",
    });

    elements.feedFormStatus.textContent =
      `Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}, failed ${result.failed ?? 0}`;
    showNotification({
      title: "DMV import completed",
      message: `Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}, failed ${result.failed ?? 0}.`,
      type: result.failed ? "warning" : "success",
    });
    await loadSnapshot();
  } catch (error) {
    elements.feedFormStatus.textContent = error.message;
    showNotification({
      title: "DMV import failed",
      message: error.message,
      type: "warning",
    });
  } finally {
    elements.importDmvButton.disabled = false;
    elements.importDmvButton.textContent = originalLabel;
  }
}

function bindEvents() {
  elements.searchFilter.addEventListener("input", (event) => {
    clearExactArticleFilter();
    state.filters.search = event.target.value.trim();
    renderArticles();
  });

  elements.topicFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.topic = event.target.value;
    renderArticles();
  });

  elements.feedFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.feedId = event.target.value;
    state.filters.dmvFeedId = "";
    state.filters.canadaDmvFeedPath = "";
    state.filters.canadaDmvAll = false;
    state.dashboardMode = "normal";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
    if (elements.canadaDmvFilter) {
      elements.canadaDmvFilter.value = "";
    }
    renderFeedList();
    renderDmvOfficialLink();
    renderDmvModeIndicator();
    renderArticles();
  });

  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.dmvFeedId = event.target.value;
      state.filters.feedId = "";
      state.filters.canadaDmvFeedPath = "";
      state.filters.canadaDmvAll = false;
      state.dashboardMode = "normal";
      elements.feedFilter.value = "";
      if (elements.canadaDmvFilter) {
        elements.canadaDmvFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      renderArticles();
    });
  }

  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.canadaDmvFeedPath = event.target.value;
      state.filters.canadaDmvAll = event.target.value === "";
      state.filters.feedId = "";
      state.filters.dmvFeedId = "";
      state.dashboardMode = "normal";
      elements.feedFilter.value = "";
      if (elements.dmvFeedFilter) {
        elements.dmvFeedFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      renderArticles();
    });
  }

  elements.dateFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.date = event.target.value;
    renderSummary();
    renderArticles();
  });

  elements.summaryGrid.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const dismissButton = target?.closest("[data-dismiss-dashboard-alert]");
    if (dismissButton) {
      dismissDashboardAlert(dismissButton.dataset.dismissDashboardAlert || "");
      return;
    }

    const dashboardAlertTarget = getDashboardAlertTargetFromEvent(event);
    if (dashboardAlertTarget) {
      const alert = runtime.dashboardAlerts.find((item) => item.id === dashboardAlertTarget.dataset.alertId);
      applyAlertArticleFilter(alert);
      return;
    }

    const analyticsFilterTarget = getAnalyticsFilterTargetFromEvent(event);
    if (analyticsFilterTarget) {
      applyAnalyticsFilter({
        topic: analyticsFilterTarget.dataset.analyticsTopic || "",
        todayOnly: analyticsFilterTarget.dataset.analyticsTodayOnly === "true",
      });
      return;
    }

    const todayCard = getTodaySummaryCardFromEvent(event);
    if (todayCard) {
      applyTodayArticleFilter();
    }
  });

  elements.summaryGrid.addEventListener("keydown", (event) => {
    const dashboardAlertTarget = getDashboardAlertTargetFromEvent(event);
    if (dashboardAlertTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const alert = runtime.dashboardAlerts.find((item) => item.id === dashboardAlertTarget.dataset.alertId);
      applyAlertArticleFilter(alert);
      return;
    }

    const analyticsFilterTarget = getAnalyticsFilterTargetFromEvent(event);
    if (analyticsFilterTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      applyAnalyticsFilter({
        topic: analyticsFilterTarget.dataset.analyticsTopic || "",
        todayOnly: analyticsFilterTarget.dataset.analyticsTodayOnly === "true",
      });
      return;
    }

    const todayCard = getTodaySummaryCardFromEvent(event);
    if (!todayCard || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    applyTodayArticleFilter();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.filters = {
      search: "",
      topic: "",
      feedId: "",
      dmvFeedId: "",
      canadaDmvFeedPath: "",
      canadaDmvAll: false,
      sourceGroup: "all",
      date: "",
      articleIds: [],
      alertLabel: "",
    };
    clearStoredExactArticleFilter();
    state.dashboardMode = "normal";

    elements.searchFilter.value = "";
    elements.topicFilter.value = "";
    elements.feedFilter.value = "";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
    if (elements.canadaDmvFilter) {
      elements.canadaDmvFilter.value = "";
    }
    elements.dateFilter.value = "";
    if (elements.feedPanelSearch) {
      elements.feedPanelSearch.value = "";
    }
    if (elements.feedVisibilityFilter) {
      elements.feedVisibilityFilter.value = "all";
    }
    renderDmvOfficialLink();
    renderDmvModeIndicator();
    renderSummary();
    renderArticles();
    renderFeedList();
  });

  if (elements.activeFilterList) {
    elements.activeFilterList.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest("[data-clear-filter]");
      if (!button) {
        return;
      }

      clearActiveFilter(button.dataset.clearFilter || "");
    });
  }

  elements.themeToggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  elements.refreshButton.addEventListener("click", async () => {
    elements.connectionStatus.textContent = "Refreshing feeds...";
    try {
      const result = await apiRequest("/api/feeds/refresh", { method: "POST" });
      elements.connectionStatus.textContent = result.message || "Feed refresh started.";
      showNotification({
        title: "Feed refresh started",
        message: result.message || "Refresh is running in the background.",
        type: "info",
      });
    } catch (error) {
      elements.connectionStatus.textContent = error.message;
      showNotification({
        title: "Feed refresh failed",
        message: error.message,
        type: "warning",
      });
    }
  });

  elements.feedForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.feedSubmit.disabled = true;
    const isEditing = Boolean(state.editingFeedId);
    elements.feedFormStatus.textContent = isEditing ? "Saving changes..." : "Adding feed...";

    try {
      const payload = {
        name: elements.feedName.value.trim(),
        topic: elements.feedTopic.value.trim(),
        rssUrl: elements.feedUrl.value.trim(),
        sourceType: elements.feedSourceType?.value || "rss",
      };

      if (isEditing) {
        await updateFeed(state.editingFeedId, payload);
        elements.feedFormStatus.textContent = "Feed updated successfully.";
      } else {
        await apiRequest("/api/feeds", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            isActive: true,
          }),
        });
        elements.feedFormStatus.textContent = "Feed added successfully.";
      }

      resetFeedForm({ preserveStatus: true });
      await loadSnapshot();
    } catch (error) {
      elements.feedFormStatus.textContent = error.message;
    } finally {
      elements.feedSubmit.disabled = false;
    }
  });

  if (elements.importDmvButton) {
    elements.importDmvButton.addEventListener("click", async () => {
      await importDmvFeeds();
    });
  }

  if (elements.feedCancel) {
    elements.feedCancel.addEventListener("click", () => {
      resetFeedForm();
    });
  }

  if (elements.dmvToggleButton) {
    elements.dmvToggleButton.addEventListener("click", () => {
      clearExactArticleFilter();
      state.dashboardMode = state.dashboardMode === "usa" ? "normal" : "usa";
      state.filters.feedId = "";
      state.filters.dmvFeedId = "";
      state.filters.canadaDmvFeedPath = "";
      state.filters.canadaDmvAll = false;
      elements.feedFilter.value = "";
      if (elements.dmvFeedFilter) {
        elements.dmvFeedFilter.value = "";
      }
      if (elements.canadaDmvFilter) {
        elements.canadaDmvFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      renderArticles();
    });
  }

  if (elements.canadaToggleButton) {
    elements.canadaToggleButton.addEventListener("click", () => {
      clearExactArticleFilter();
      state.dashboardMode = state.dashboardMode === "canada" ? "normal" : "canada";
      state.filters.feedId = "";
      state.filters.dmvFeedId = "";
      state.filters.canadaDmvFeedPath = "";
      state.filters.canadaDmvAll = false;
      elements.feedFilter.value = "";
      if (elements.dmvFeedFilter) {
        elements.dmvFeedFilter.value = "";
      }
      if (elements.canadaDmvFilter) {
        elements.canadaDmvFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      renderArticles();
    });
  }

  if (elements.feedPanelSearch) {
    elements.feedPanelSearch.addEventListener(
      "input",
      debounce(() => {
        renderFeedList();
      }, 150)
    );
  }

  if (elements.feedVisibilityFilter) {
    elements.feedVisibilityFilter.addEventListener("change", () => {
      renderFeedList();
    });
  }

  if (elements.feedGroupTabs) {
    elements.feedGroupTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-source-group]");
      if (!button) {
        return;
      }

      state.filters.sourceGroup = button.dataset.sourceGroup || "all";
      renderFeedList();
    });
  }

  if (elements.feedPanelToggle && elements.feedPanelContent) {
    syncFeedPanelVisibility();

    elements.feedPanelToggle.addEventListener("click", () => {
      state.feedPanelCollapsed = !state.feedPanelCollapsed;
      syncFeedPanelVisibility();
      window.localStorage.setItem(
        FEED_PANEL_COLLAPSED_STORAGE_KEY,
        String(state.feedPanelCollapsed)
      );
    });
  }

  if (elements.addSourceToggle && elements.addSourceContent) {
    syncAddSourcePanel(false);

    elements.addSourceToggle.addEventListener("click", () => {
      const expanded = elements.addSourceToggle.getAttribute("aria-expanded") === "true";
      syncAddSourcePanel(!expanded);
    });
  }

  elements.feedList.addEventListener("click", async (event) => {
    const editButton = event.target.closest('[data-action="edit-feed"]');
    const deleteButton = event.target.closest('[data-action="delete-feed"]');

    if (editButton) {
      const feedId = editButton.dataset.feedId;
      const feed = state.feeds.find((item) => item.id === feedId);
      if (!feed) {
        return;
      }
      startFeedEdit(feed);

      return;
    }

    if (deleteButton) {
      const feedId = deleteButton.dataset.feedId;
      const confirmed = window.confirm("Delete this feed?");
      if (!confirmed) {
        return;
      }

      try {
        elements.feedFormStatus.textContent = "Deleting feed...";
        await deleteFeed(feedId);
        elements.feedFormStatus.textContent = "Feed deleted.";
        await loadSnapshot();
      } catch (error) {
        elements.feedFormStatus.textContent = error.message;
      }
    }
  });
}

async function init() {
  loadTheme();
  state.feedPanelCollapsed = isFeedPanelCollapsed();
  resetDashboardState();
  syncFeedFormMode();
  bindEvents();
  renderSkeletons();
  await loadSnapshot();
  syncFeedPanelVisibility();
  initRealtime();
}

window.addEventListener("beforeunload", () => {
  if (runtime.pollTimer) {
    window.clearInterval(runtime.pollTimer);
  }

  if (runtime.eventSource) {
    runtime.eventSource.close();
  }
});

void init();
