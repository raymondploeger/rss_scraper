const PLACEHOLDER_IMAGE = "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";
const THEME_STORAGE_KEY = "rss-monitor-theme";
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
  articles: [],
  filters: {
    search: "",
    topic: "",
    feedId: "",
    dmvFeedId: "",
    date: "",
    dmvOnly: false,
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
  dateFilter: document.getElementById("date-filter"),
  searchFilter: document.getElementById("search-filter"),
  clearFilters: document.getElementById("clear-filters"),
  refreshButton: document.getElementById("refresh-button"),
  connectionStatus: document.getElementById("connection-status"),
  resultsCount: document.getElementById("results-count"),
  themeToggle: document.getElementById("theme-toggle"),
  feedForm: document.getElementById("feed-form"),
  feedSubmit: document.getElementById("feed-submit"),
  feedName: document.getElementById("feed-name"),
  feedTopic: document.getElementById("feed-topic"),
  feedUrl: document.getElementById("feed-url"),
  feedSourceType: document.getElementById("feed-source-type"),
  feedFormStatus: document.getElementById("feed-form-status"),
  feedCount: document.getElementById("feed-count"),
  feedList: document.getElementById("feed-list"),
  feedPanelSearch: document.getElementById("feed-panel-search"),
  feedVisibilityFilter: document.getElementById("feed-visibility-filter"),
  feedPanelToggle: document.getElementById("feed-panel-toggle"),
  feedPanelContent: document.getElementById("feed-panel-content"),
  summaryCardTemplate: document.getElementById("summary-card-template"),
  feedItemTemplate: document.getElementById("feed-item-template"),
  articleCardTemplate: document.getElementById("article-card-template"),
  importDmvButton: document.getElementById("import-dmv-button"),
  dmvToggleButton: document.getElementById("dmv-toggle-button"),
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
  return Boolean(
    String(feed?.rssUrl || "").includes("rssdmv-production.up.railway.app/feeds/")
  );
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

function getFeedName(feedId) {
  return state.feeds.find((feed) => feed.id === feedId)?.name || "Unknown feed";
}

function getNonDmvFeeds() {
  return state.feeds.filter((feed) => !isDmvWrapperFeed(feed));
}

function getDmvFeeds() {
  return state.feeds.filter(isDmvWrapperFeed);
}

function getActiveArticleFeedId() {
  return state.filters.feedId || state.filters.dmvFeedId;
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

  SUMMARY_METRICS.forEach((item) => {
    const card = elements.summaryCardTemplate.content.cloneNode(true);
    card.querySelector(".summary-label").textContent = item.label;
    card.querySelector(".summary-value").textContent = String(metrics[item.key]);
    fragment.appendChild(card);
  });

  elements.summaryGrid.appendChild(fragment);
}

function renderFeedOptions() {
  const topics = Array.from(
    new Set(state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean))
  ).sort();
  const nonDmvFeeds = getNonDmvFeeds()
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  const dmvFeeds = getDmvFeeds()
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));

  if (
    state.filters.feedId &&
    !nonDmvFeeds.some((feed) => feed.id === state.filters.feedId)
  ) {
    state.filters.feedId = "";
  }

  if (
    state.filters.dmvFeedId &&
    !dmvFeeds.some((feed) => feed.id === state.filters.dmvFeedId)
  ) {
    state.filters.dmvFeedId = "";
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
        dmvFeeds.map((feed) => `<option value="${feed.id}">${feed.name || "Untitled Feed"}</option>`)
      )
      .join("");
    elements.dmvFeedFilter.value = state.filters.dmvFeedId;
  }
}

function getVisibleFeeds() {
  let feeds = state.feeds.slice();

  const feedPanelSearch = String(elements.feedPanelSearch?.value || "").trim().toLowerCase();
  const visibilityFilter = elements.feedVisibilityFilter?.value || "all";

  if (state.filters.dmvOnly) {
    feeds = feeds.filter(isDmvWrapperFeed);
  }

  if (visibilityFilter === "active") {
    feeds = feeds.filter((feed) => feed.isActive !== false && feed.lastStatus !== "error");
  }

  if (visibilityFilter === "inactive") {
    feeds = feeds.filter((feed) => feed.isActive === false || feed.lastStatus === "error");
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

  return feeds.sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""))
  );
}

function updateDmvToggleButton() {
  if (!elements.dmvToggleButton) return;

  if (state.filters.dmvOnly) {
    elements.dmvToggleButton.textContent = "Show all feeds";
    elements.dmvToggleButton.classList.add("active-toggle");
    elements.dmvToggleButton.setAttribute("aria-pressed", "true");
  } else {
    elements.dmvToggleButton.textContent = "Show DMV feeds";
    elements.dmvToggleButton.classList.remove("active-toggle");
    elements.dmvToggleButton.setAttribute("aria-pressed", "false");
  }
}

function syncFeedPanelVisibility(expanded) {
  if (!elements.feedPanelToggle || !elements.feedPanelContent) {
    return;
  }

  elements.feedPanelToggle.setAttribute("aria-expanded", String(expanded));
  elements.feedPanelToggle.textContent = expanded ? "Hide sources" : "Show sources";
  elements.feedPanelContent.hidden = !expanded;
  elements.feedPanelContent.classList.toggle("is-collapsed", !expanded);
}

function renderFeedList() {
  const visibleFeeds = getVisibleFeeds();

  elements.feedCount.textContent = String(visibleFeeds.length);
  elements.feedList.innerHTML = "";

  if (!visibleFeeds.length) {
    elements.feedList.innerHTML = `<div class="empty-state">No feeds match the current view.</div>`;
    updateDmvToggleButton();
    return;
  }

  const fragment = document.createDocumentFragment();

  visibleFeeds.forEach((feed) => {
    const node = elements.feedItemTemplate.content.cloneNode(true);
    const title = node.querySelector(".feed-item-title");
    const meta = node.querySelector(".feed-item-meta");
    const status = node.querySelector(".feed-status");
    const editButton = node.querySelector(".feed-edit-button");
    const deleteButton = node.querySelector(".feed-delete-button");
    const lastFetched = feed.lastFetchedAt ? formatDate(feed.lastFetchedAt) : "Waiting for first sync";
    const tone =
      feed.lastStatus === "error"
        ? "is-error"
        : feed.lastStatus === "success"
          ? "is-success"
          : "is-idle";

    title.textContent = feed.name || "Untitled feed";
    meta.textContent = `${feed.topic || "General"} • ${lastFetched} • ${feed.rssUrl || ""}`;
    status.textContent = feed.lastStatus || "idle";
    status.classList.add(tone);

    editButton.dataset.feedId = feed.id;
    deleteButton.dataset.feedId = feed.id;
    editButton.dataset.action = "edit-feed";
    deleteButton.dataset.action = "delete-feed";

    fragment.appendChild(node);
  });

  elements.feedList.appendChild(fragment);
  updateDmvToggleButton();
}

function articleMatchesFilters(article) {
  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (getActiveArticleFeedId() && article.feedId !== getActiveArticleFeedId()) {
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

function renderSkeletons() {
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
  elements.resultsCount.textContent = `${articles.length} results`;
  elements.articlesGrid.innerHTML = "";

  if (!articles.length) {
    elements.articlesGrid.innerHTML =
      `<div class="empty-state">No articles match the active filters.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  articles.forEach((article) => {
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

    fragment.appendChild(node);
  });

  elements.articlesGrid.appendChild(fragment);
}

function renderDashboard() {
  renderSummary();
  renderFeedOptions();
  renderFeedList();
  renderArticles();
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
  const [feeds, articles] = await Promise.all([
    apiRequest("/api/feeds"),
    loadAllArticles(),
  ]);

  state.feeds = feeds;
  state.articles = articles;
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
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
    renderArticles();
  });

  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.addEventListener("change", (event) => {
      state.filters.dmvFeedId = event.target.value;
      state.filters.feedId = "";
      elements.feedFilter.value = "";
      renderArticles();
    });
  }

  elements.dateFilter.addEventListener("change", (event) => {
    state.filters.date = event.target.value;
    renderArticles();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.filters = {
      search: "",
      topic: "",
      feedId: "",
      dmvFeedId: "",
      date: "",
      dmvOnly: false,
    };

    elements.searchFilter.value = "";
    elements.topicFilter.value = "";
    elements.feedFilter.value = "";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
    elements.dateFilter.value = "";
    if (elements.feedPanelSearch) {
      elements.feedPanelSearch.value = "";
    }
    if (elements.feedVisibilityFilter) {
      elements.feedVisibilityFilter.value = "all";
    }

    renderArticles();
    renderFeedList();
  });

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
    elements.feedFormStatus.textContent = "Adding feed...";

    try {
      await apiRequest("/api/feeds", {
        method: "POST",
        body: JSON.stringify({
          name: elements.feedName.value.trim(),
          topic: elements.feedTopic.value.trim(),
          rssUrl: elements.feedUrl.value.trim(),
          sourceType: elements.feedSourceType?.value || "rss",
          isActive: true,
        }),
      });

      elements.feedForm.reset();
      elements.feedFormStatus.textContent = "Feed added successfully.";
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

  if (elements.dmvToggleButton) {
    elements.dmvToggleButton.addEventListener("click", () => {
      state.filters.dmvOnly = !state.filters.dmvOnly;
      renderFeedList();
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

  if (elements.feedPanelToggle && elements.feedPanelContent) {
    syncFeedPanelVisibility(
      elements.feedPanelToggle.getAttribute("aria-expanded") !== "false"
    );

    elements.feedPanelToggle.addEventListener("click", () => {
      const expanded = elements.feedPanelToggle.getAttribute("aria-expanded") === "true";
      syncFeedPanelVisibility(!expanded);
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

      const nextName = window.prompt("Edit feed name", feed.name || "");
      if (nextName === null) {
        return;
      }

      const trimmedName = nextName.trim();
      if (!trimmedName) {
        elements.feedFormStatus.textContent = "Feed name cannot be empty.";
        return;
      }

      try {
        elements.feedFormStatus.textContent = "Saving feed...";
        await updateFeed(feedId, { name: trimmedName });
        elements.feedFormStatus.textContent = "Feed updated.";
        await loadSnapshot();
      } catch (error) {
        elements.feedFormStatus.textContent = error.message;
      }

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
  bindEvents();
  renderSkeletons();
  await loadSnapshot();
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
