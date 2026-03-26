const THEME_STORAGE_KEY = "rss-monitor-theme";
const POLLING_INTERVAL_MS = 30000;
const SUMMARY_METRICS = [
  { label: "Active feeds", key: "activeFeeds" },
  { label: "Tracked topics", key: "topics" },
  { label: "Articles today", key: "articlesToday" },
  { label: "Latest articles", key: "totalArticles" },
];

const state = {
  feeds: [],
  articles: [],
  editingFeedId: null,
  feedPanelCollapsed: false,
  feedPanelFilter: "all",
  feedPanelSearch: "",
  filters: {
    search: "",
    topic: "",
    feedId: "",
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
  dateFilter: document.getElementById("date-filter"),
  searchFilter: document.getElementById("search-filter"),
  clearFilters: document.getElementById("clear-filters"),
  refreshButton: document.getElementById("refresh-button"),
  connectionStatus: document.getElementById("connection-status"),
  resultsCount: document.getElementById("results-count"),
  themeToggle: document.getElementById("theme-toggle"),
  feedForm: document.getElementById("feed-form"),
  feedSubmit: document.getElementById("feed-submit"),
  feedCancel: document.getElementById("feed-cancel"),
  feedName: document.getElementById("feed-name"),
  feedTopic: document.getElementById("feed-topic"),
  feedSourceType: document.getElementById("feed-source-type"),
  feedUrl: document.getElementById("feed-url"),
  feedFormStatus: document.getElementById("feed-form-status"),
  feedCount: document.getElementById("feed-count"),
  feedPanelToggle: document.getElementById("feed-panel-toggle"),
  feedPanelContent: document.getElementById("feed-panel-content"),
  feedVisibilityFilter: document.getElementById("feed-visibility-filter"),
  feedPanelSearch: document.getElementById("feed-panel-search"),
  feedList: document.getElementById("feed-list"),
  summaryCardTemplate: document.getElementById("summary-card-template"),
  feedItemTemplate: document.getElementById("feed-item-template"),
  articleCardTemplate: document.getElementById("article-card-template"),
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

function getSummaryMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    activeFeeds: state.feeds.filter((feed) => feed.isActive !== false).length,
    topics: new Set(state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean)).size,
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
  const topics = Array.from(new Set(state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean))).sort();
  elements.topicFilter.innerHTML = [`<option value="">All topics</option>`]
    .concat(topics.map((topic) => `<option value="${topic}">${topic}</option>`))
    .join("");
  elements.topicFilter.value = state.filters.topic;

  elements.feedFilter.innerHTML = [`<option value="">All feeds</option>`]
    .concat(
      state.feeds
        .slice()
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
        .map((feed) => `<option value="${feed.id}">${feed.name || "Untitled Feed"}</option>`),
    )
    .join("");
  elements.feedFilter.value = state.filters.feedId;
}

function getVisibleFeedsForPanel() {
  return state.feeds
    .filter((feed) => {
      if (state.feedPanelSearch) {
        const haystack = [feed.name, feed.topic, feed.rssUrl, feed.sourceType].join(" ").toLowerCase();
        if (!haystack.includes(state.feedPanelSearch.toLowerCase())) {
          return false;
        }
      }

      if (state.feedPanelFilter === "active") {
        return feed.isActive !== false;
      }

      if (state.feedPanelFilter === "inactive") {
        return feed.isActive === false || feed.lastStatus === "error";
      }

      return true;
    })
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
}

function renderFeedPanelState() {
  elements.feedPanelContent.classList.toggle("is-collapsed", state.feedPanelCollapsed);
  elements.feedPanelToggle.textContent = state.feedPanelCollapsed ? "Show sources" : "Hide sources";
  elements.feedPanelToggle.setAttribute("aria-expanded", String(!state.feedPanelCollapsed));
  elements.feedVisibilityFilter.value = state.feedPanelFilter;
  elements.feedPanelSearch.value = state.feedPanelSearch;
}

function renderFeedList() {
  const feeds = getVisibleFeedsForPanel();
  elements.feedCount.textContent = String(feeds.length);
  elements.feedList.innerHTML = "";
  renderFeedPanelState();

  if (!feeds.length && !state.feeds.length) {
    elements.feedList.innerHTML = `<div class="empty-state">No sources configured yet.</div>`;
    return;
  }

  if (!feeds.length) {
    elements.feedList.innerHTML = `<div class="empty-state">No sources match the current search or filter.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  feeds.forEach((feed) => {
      const node = elements.feedItemTemplate.content.cloneNode(true);
      const title = node.querySelector(".feed-item-title");
      const meta = node.querySelector(".feed-item-meta");
      const status = node.querySelector(".feed-status");
      const editButton = node.querySelector(".feed-edit-button");
      const deleteButton = node.querySelector(".feed-delete-button");
      const lastFetched = feed.lastFetchedAt ? formatDate(feed.lastFetchedAt) : "Waiting for first sync";
      const tone = feed.lastStatus === "error" ? "is-error" : feed.lastStatus === "success" ? "is-success" : "is-idle";
      const sourceLabel = feed.sourceType === "website" ? "Website" : "RSS";

      title.textContent = feed.name || "Untitled source";
      meta.textContent = `${sourceLabel} • ${feed.topic || "General"} • ${lastFetched}`;
      status.textContent = feed.lastStatus || "idle";
      status.classList.add(tone);
      editButton.dataset.feedId = feed.id;
      deleteButton.dataset.feedId = feed.id;
      editButton.disabled = state.editingFeedId === feed.id;
      fragment.appendChild(node);
    });

  elements.feedList.appendChild(fragment);
}

function articleMatchesFilters(article) {
  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (state.filters.feedId && article.feedId !== state.filters.feedId) {
    return false;
  }

  if (state.filters.date && toDateInputValue(article.pubDate) !== state.filters.date) {
    return false;
  }

  if (state.filters.search) {
    const haystack = [article.title, article.source, article.topic, getFeedName(article.feedId)].join(" ").toLowerCase();
    if (!haystack.includes(state.filters.search.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function getVisibleArticles() {
  return state.articles
    .filter((article) => !article.isDuplicate)
    .filter(articleMatchesFilters)
    .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime());
}

function isAbsoluteUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getArticleDestination(article) {
  if (isAbsoluteUrl(article.canonicalLink)) {
    return article.canonicalLink;
  }

  if (String(article.canonicalLink || "").startsWith("/") && isAbsoluteUrl(article.link)) {
    try {
      return new URL(article.canonicalLink, article.link).toString();
    } catch {
      return article.link;
    }
  }

  return article.link;
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
      `,
    )
    .join("");
}

function renderArticles() {
  const articles = getVisibleArticles();
  elements.resultsCount.textContent = `${articles.length} results`;
  elements.articlesGrid.innerHTML = "";

  if (!articles.length) {
    elements.articlesGrid.innerHTML = `<div class="empty-state">No articles match the active filters.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  articles.forEach((article) => {
    const node = elements.articleCardTemplate.content.cloneNode(true);
    const link = node.querySelector(".article-link");
    const media = node.querySelector(".article-media");
    const image = node.querySelector(".article-image");
    const thumbnailState = node.querySelector(".article-thumbnail-state");
    const topic = node.querySelector(".article-topic");
    const source = node.querySelector(".article-source");
    const date = node.querySelector(".article-date");
    const title = node.querySelector(".article-title");
    const feed = node.querySelector(".article-feed");
    const hasThumbnail = Boolean(article.thumbnail && String(article.thumbnail).trim());
    const finalImageSrc = hasThumbnail ? article.thumbnail.trim() : "";

    link.href = getArticleDestination(article);
    if (hasThumbnail) {
      image.setAttribute("src", finalImageSrc);
      image.classList.remove("is-hidden");
      media.classList.remove("is-empty");
      media.dataset.thumbnailState = "has-thumbnail";
      thumbnailState.textContent = "has-thumbnail";
    } else {
      image.removeAttribute("src");
      image.classList.add("is-hidden");
      media.classList.add("is-empty");
      media.dataset.thumbnailState = "no-thumbnail";
      thumbnailState.textContent = "no-thumbnail";
    }
    image.alt = article.title || "Article thumbnail";
    image.onerror = () => {
      console.warn("Article image failed to load", {
        title: article.title,
        thumbnail: article.thumbnail || "",
        domSrc: image.getAttribute("src") || "",
      });
    };
    topic.textContent = article.topic || "General";
    source.textContent = article.source || "Unknown source";
    date.textContent = formatDate(article.pubDate);
    title.textContent = article.title || "Untitled article";
    feed.textContent = getFeedName(article.feedId);

    console.log("Article image render debug", {
      title: article.title,
      thumbnail: article.thumbnail || "",
      finalImageSrc,
      domSrc: image.getAttribute("src") || "",
      thumbnailState: media.dataset.thumbnailState,
    });

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

function initializeFeedPanelState() {
  state.feedPanelCollapsed = window.matchMedia("(max-width: 720px)").matches;
}

function syncFeedFormMode() {
  elements.feedSubmit.disabled = false;
  elements.feedSubmit.textContent = state.editingFeedId ? "Save changes" : "Add source";
  elements.feedCancel.hidden = !state.editingFeedId;
}

function resetFeedForm(statusMessage = "Monitor up to 50 RSS feeds and websites.") {
  state.editingFeedId = null;
  elements.feedForm.reset();
  elements.feedSourceType.value = "rss";
  syncFeedFormMode();
  elements.feedFormStatus.textContent = statusMessage;
}

function startFeedEdit(feedId) {
  const feed = state.feeds.find((item) => item.id === feedId);
  if (!feed) {
    elements.feedFormStatus.textContent = "Unable to find that feed.";
    return;
  }

  state.editingFeedId = feedId;
  elements.feedName.value = feed.name || "";
  elements.feedTopic.value = feed.topic || "";
  elements.feedSourceType.value = feed.sourceType || "rss";
  elements.feedUrl.value = feed.rssUrl || "";
  syncFeedFormMode();
  elements.feedFormStatus.textContent = `Editing ${feed.name || "source"}.`;
  renderFeedList();
  elements.feedName.focus();
}

async function deleteFeed(feedId) {
  const feed = state.feeds.find((item) => item.id === feedId);
  if (!feed) {
    return;
  }

  const confirmed = window.confirm(`Delete "${feed.name || "this source"}"? This will also remove its stored articles.`);
  if (!confirmed) {
    return;
  }

  elements.feedFormStatus.textContent = `Deleting ${feed.name || "source"}...`;

  try {
    await apiRequest(`/api/feeds/${feedId}`, { method: "DELETE" });

    if (state.editingFeedId === feedId) {
      resetFeedForm();
    }

    state.feeds = state.feeds.filter((item) => item.id !== feedId);
    state.articles = state.articles.filter((article) => article.feedId !== feedId);
    if (state.filters.feedId === feedId) {
      state.filters.feedId = "";
      elements.feedFilter.value = "";
    }
    renderDashboard();
    elements.feedFormStatus.textContent = "Feed deleted successfully.";
  } catch (error) {
    elements.feedFormStatus.textContent = error.message;
  }
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

async function optionalApiRequest(path, fallbackValue) {
  try {
    return await apiRequest(path);
  } catch (error) {
    console.warn(`Optional API request failed for ${path}:`, error);
    return fallbackValue;
  }
}

async function loadSnapshot() {
  const [feeds, articles] = await Promise.all([
    apiRequest("/api/feeds"),
    optionalApiRequest("/api/articles", []),
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
    renderArticles();
  });

  elements.dateFilter.addEventListener("change", (event) => {
    state.filters.date = event.target.value;
    renderArticles();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.filters = {
      search: "",
      topic: "",
      feedId: "",
      date: "",
    };
    elements.searchFilter.value = "";
    elements.topicFilter.value = "";
    elements.feedFilter.value = "";
    elements.dateFilter.value = "";
    renderArticles();
  });

  elements.themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  elements.refreshButton.addEventListener("click", async () => {
    elements.connectionStatus.textContent = "Refreshing sources...";
    try {
      const result = await apiRequest("/api/feeds/refresh", { method: "POST" });
      elements.connectionStatus.textContent = result.message || "Source refresh started.";
    } catch (error) {
      elements.connectionStatus.textContent = "Source refresh is not enabled yet.";
    }
  });

  elements.feedCancel.addEventListener("click", () => {
    resetFeedForm();
    renderFeedList();
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
        sourceType: elements.feedSourceType.value,
        isActive: true,
      };

      await apiRequest(isEditing ? `/api/feeds/${state.editingFeedId}` : "/api/feeds", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          ...payload,
        }),
      });

      resetFeedForm(isEditing ? "Feed updated successfully." : "Feed added successfully.");
      await loadSnapshot();
    } catch (error) {
      elements.feedFormStatus.textContent = error.message;
    } finally {
      elements.feedSubmit.disabled = false;
    }
  });

  elements.feedList.addEventListener("click", (event) => {
    const editButton = event.target.closest(".feed-edit-button");
    if (editButton) {
      startFeedEdit(editButton.dataset.feedId);
      return;
    }

    const deleteButton = event.target.closest(".feed-delete-button");
    if (deleteButton) {
      void deleteFeed(deleteButton.dataset.feedId);
    }
  });

  elements.feedPanelToggle.addEventListener("click", () => {
    state.feedPanelCollapsed = !state.feedPanelCollapsed;
    renderFeedPanelState();
  });

  elements.feedVisibilityFilter.addEventListener("change", (event) => {
    state.feedPanelFilter = event.target.value;
    renderFeedList();
  });

  elements.feedPanelSearch.addEventListener("input", (event) => {
    state.feedPanelSearch = event.target.value.trim();
    renderFeedList();
  });
}

async function init() {
  loadTheme();
  initializeFeedPanelState();
  syncFeedFormMode();
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
