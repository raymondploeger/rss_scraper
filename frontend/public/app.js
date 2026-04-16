const PLACEHOLDER_IMAGE = "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";
const THEME_STORAGE_KEY = "rss-monitor-theme";
const FEED_PANEL_COLLAPSED_STORAGE_KEY = "feedPanelCollapsed";
const POLLING_INTERVAL_MS = 30000;
const ARTICLE_PAGE_SIZE = 400;
const SUMMARY_METRICS = [
  { label: "Active feeds", key: "activeFeeds" },
  { label: "Tracked topics", key: "topics" },
  { label: "Articles today", key: "articlesToday" },
  { label: "Latest articles", key: "totalArticles" },
];

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
  },
};

const runtime = {
  pollTimer: null,
  eventSource: null,
  realtimeEnabled: false,
};

const elements = {
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

function isNotafiliaUrl(value) {
  try {
    return new URL(String(value || "")).hostname === "news.notafilia.pl";
  } catch {
    return false;
  }
}

function isDmvWrapperFeed(feed) {
  return Boolean(feed?.dmvState || feed?.dmvRegion);
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

function getUsDmvFeeds() {
  return getDmvFeeds().filter((feed) => !isCanadianDmvAbbr(feed.dmvAbbr));
}

function getCanadaImportedDmvFeeds() {
  return getDmvFeeds().filter((feed) => isCanadianDmvAbbr(feed.dmvAbbr));
}

function getUsDmvCatalogEntries() {
  return state.dmvCatalog
    .filter((entry) => entry.region === "us")
    .slice()
    .sort((left, right) => String(left.state || "").localeCompare(String(right.state || "")));
}

function getCanadaDmvCatalogEntries() {
  return state.dmvCatalog
    .filter((entry) => entry.region === "canada")
    .slice()
    .sort((left, right) => String(left.state || "").localeCompare(String(right.state || "")));
}

function isUsLinkOnlyEntry(entry) {
  return entry?.region === "us" && entry?.mode === "link-only";
}

function isCanadaLinkOnlyEntry(entry) {
  return entry?.region === "canada" && entry?.mode === "link-only";
}

function isCanadaLinkOnlyFeed(feed) {
  const catalogEntry = getCanadaCatalogEntryForFeed(feed);

  if (catalogEntry) {
    if (catalogEntry.mode === "rss") {
      return false;
    }

    return catalogEntry.mode === "link-only";
  }

  const name = String(feed?.name || "").toLowerCase();
  const dmvRegion = String(feed?.dmvRegion || "").toLowerCase();

  return (
    dmvRegion === "canada" ||
    dmvRegion === "ca" ||
    isCanadianDmvAbbr(feed?.dmvAbbr) ||
    isCanadianDmvName(name)
  );
}

function toCanadaCatalogSource(entry) {
  const stateName = String(entry?.state || entry?.abbr || "Canada DMV").trim();
  const title = stateName.toLowerCase().includes("dmv") ? stateName : `${stateName} DMV`;

  return {
    id: `catalog-canada-${entry?.feedPath || entry?.abbr || stateName}`,
    name: title,
    topic: "Canada DMV",
    rssUrl: entry?.officialUrl || "",
    officialUrl: entry?.officialUrl || "",
    sourceType: "link-only",
    isActive: true,
    isCatalogOnly: true,
    lastFetchedAt: null,
    lastStatus: "idle",
    dmvState: entry?.state || null,
    dmvAbbr: entry?.abbr || null,
    dmvFeedPath: entry?.feedPath || null,
    dmvRegion: "canada",
    dmvMode: entry?.mode || "link-only",
  };
}

function getCanadaCatalogOnlySources() {
  return getCanadaDmvCatalogEntries()
    .filter((entry) => entry.mode === "link-only" && !getFeedForCatalogEntry(entry))
    .map(toCanadaCatalogSource);
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
  const dmvRegion = String(feed?.dmvRegion || "").toLowerCase();

  if (
    dmvRegion === "canada" ||
    dmvRegion === "ca" ||
    isCanadianDmvAbbr(feed?.dmvAbbr) ||
    isCanadianDmvName(name) ||
    name.includes("canada")
  ) {
    return "Canada";
  }

  if (dmvRegion === "us" || name.includes("dmv")) {
    return "USA";
  }

  if (isGoogleAlertsFeed(feed)) {
    return "Google Alerts";
  }

  return "Other";
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
    (entry) => entry.region === "us" && entry.abbr === state.filters.dmvFeedId
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

  if (entry.region === "canada" && entry.mode === "link-only") {
    return null;
  }

  return state.feeds.find((feed) => {
    const entryState = String(entry.state || "").toLowerCase();
    const feedName = String(feed.name || "").toLowerCase();

    if (entry.rssUrl && feed.rssUrl === entry.rssUrl) {
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
    const entryUrl = String(entry.rss_url || entry.rssUrl || "").trim();
    const entryState = String(entry.state || "").toLowerCase();
    const entryAbbr = String(entry.abbr || "").toUpperCase();

    return (
      (entryUrl && feedUrl === entryUrl) ||
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
  if (isCanadaLinkOnlyFeed(feed)) {
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

function getSummaryMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    activeFeeds: state.feeds.filter((feed) => feed.isActive !== false).length,
    topics: new Set(
      state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean)
    ).size,
    articlesToday: state.articles.filter((article) => toDate(article.pubDate) >= startOfToday).length,
    totalArticles: state.articles.length,
  };
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

  elements.summaryGrid.appendChild(fragment);
}

function applyTodayArticleFilter() {
  const today = toDateInputValue(new Date());
  const nextDate = state.filters.date === today ? "" : today;
  state.filters.date = nextDate;
  elements.dateFilter.value = nextDate;
  renderSummary();
  renderArticles();
}

function getTodaySummaryCardFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest('[data-action="filter-today"]');
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
  chip.textContent = `${label}: ${value} x`;
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
  elements.clearFilters.classList.toggle("is-active-filter", Boolean(elements.activeFilterList.childNodes.length));
  elements.clearFilters.textContent = elements.activeFilterList.childNodes.length ? "Clear filters" : "Reset";
}

function clearActiveFilter(filterKey) {
  if (filterKey === "search") {
    state.filters.search = "";
    elements.searchFilter.value = "";
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
          (entry) => `<option value="${entry.abbr}">${entry.state || "Untitled Feed"}</option>`
        )
      )
      .join("");
    elements.dmvFeedFilter.value = state.filters.dmvFeedId;
  }

  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.innerHTML = [`<option value="">All Canada DMV</option>`]
      .concat(
        canadaCatalogEntries.map(
          (entry) => `<option value="${entry.feedPath}">${entry.state || "Untitled Feed"}</option>`
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
      : selectedCanadaEntry && selectedCanadaEntry.mode === "link-only"
        ? [toCanadaCatalogSource(selectedCanadaEntry)]
        : [];
  } else if (sourceListMode === "dmv-feed") {
    const selectedUsFeed = getSelectedDmvFeed();
    feeds = selectedUsFeed ? feeds.filter((feed) => feed.id === selectedUsFeed.id) : [];
  } else if (sourceListMode === "canada-all") {
    feeds = getCanadaImportedDmvFeeds().concat(canadaCatalogOnlySources);
  } else {
    feeds = feeds.concat(canadaCatalogOnlySources);
  }

  if (visibilityFilter === "active") {
    feeds = feeds.filter(
      (feed) => feed.isActive !== false && (isCanadaLinkOnlyFeed(feed) || feed.lastStatus !== "error")
    );
  }

  if (visibilityFilter === "inactive") {
    feeds = feeds.filter(
      (feed) => feed.isActive === false || (!isCanadaLinkOnlyFeed(feed) && feed.lastStatus === "error")
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

  console.log("Panel collapsed:", state.feedPanelCollapsed);
  const expanded = !state.feedPanelCollapsed;
  if (!expanded) {
    state.addSourceExpanded = false;
  }

  const addSourceExpanded = expanded && state.addSourceExpanded;
  const trackedSourcesPanel = elements.feedPanel || elements.feedPanelContent.closest(".panel");

  elements.feedPanelToggle.setAttribute("aria-expanded", String(expanded));
  elements.feedPanelToggle.textContent = expanded ? "Hide sources" : "Show sources";
  elements.feedPanelContent.hidden = !expanded;
  elements.feedPanelContent.classList.toggle("is-collapsed", !expanded);
  trackedSourcesPanel?.classList.toggle("is-collapsed", !expanded);
  trackedSourcesPanel?.setAttribute("data-collapsed", String(!expanded));

  if (elements.addSourceContent) {
    elements.addSourceContent.hidden = !addSourceExpanded;
  }

  if (elements.addSourceToggle) {
    elements.addSourceToggle.setAttribute("aria-expanded", String(addSourceExpanded));
    elements.addSourceToggle.textContent = addSourceExpanded ? "Hide add" : "+ Add";
  }
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

  const activeGroup = state.filters.sourceGroup || "all";
  elements.feedGroupTabs.querySelectorAll("[data-source-group]").forEach((button) => {
    const isActive = button.dataset.sourceGroup === activeGroup;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
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
  const isCatalogOnly = Boolean(feed.isCatalogOnly);
  const lastFetched = feed.lastFetchedAt
    ? formatDate(feed.lastFetchedAt)
    : isCatalogOnly
      ? "Official link only"
      : "Waiting for first sync";
  const statusPresentation = getFeedStatusPresentation(feed);

  item.classList.toggle("is-catalog-only", isCatalogOnly);
  title.textContent = feed.name || "Untitled feed";
  meta.textContent = `${feed.topic || "General"} • ${lastFetched} • ${feed.rssUrl || ""}`;
  status.textContent = statusPresentation.text;
  status.classList.add(statusPresentation.tone);

  if (isCatalogOnly) {
    editButton.hidden = true;
    deleteButton.hidden = true;
  } else {
    editButton.dataset.feedId = feed.id;
    deleteButton.dataset.feedId = feed.id;
    editButton.dataset.action = "edit-feed";
    deleteButton.dataset.action = "delete-feed";
  }

  return node;
}

function renderFeedList() {
  const visibleFeeds = getVisibleFeeds();
  const activeGroup = state.filters.sourceGroup || "all";

  syncSourceGroupTabs();
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
      ? ["USA", "Canada", "Google Alerts", "Other"].map((label) => ({
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
      const feedLike = importedFeed || {
        name: entry.state,
        topic: "General",
        officialUrl: entry.officialUrl,
        rssUrl: "",
        dmvMode: entry.mode,
        dmvRegion: entry.region,
      };
      const groupCards = feedArticles.length
        ? feedArticles.map((article) => renderArticleCard(article))
        : [renderDmvPlaceholderCard(feedLike)];
      fragment.appendChild(renderFeedGroup(entry.state || "Untitled feed", groupCards));
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
  renderDashboard();
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

    ["article:new", "article:update", "feed:update", "refresh:complete"].forEach((eventName) => {
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
    await loadSnapshot();
  } catch (error) {
    elements.feedFormStatus.textContent = error.message;
  } finally {
    elements.importDmvButton.disabled = false;
    elements.importDmvButton.textContent = originalLabel;
  }
}

function bindEvents() {
  elements.searchFilter.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim();
    renderArticles();
  });

  elements.topicFilter.addEventListener("change", (event) => {
    state.filters.topic = event.target.value;
    renderArticles();
  });

  elements.feedFilter.addEventListener("change", (event) => {
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
    state.filters.date = event.target.value;
    renderSummary();
    renderArticles();
  });

  elements.summaryGrid.addEventListener("click", (event) => {
    const todayCard = getTodaySummaryCardFromEvent(event);
    if (todayCard) {
      applyTodayArticleFilter();
    }
  });

  elements.summaryGrid.addEventListener("keydown", (event) => {
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
    };
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
    } catch (error) {
      elements.connectionStatus.textContent = error.message;
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
