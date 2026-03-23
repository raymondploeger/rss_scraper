const placeholderImage = "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";
const themeStorageKey = "rss-monitor-theme";
const feedManagerStorageKey = "rss-monitor-feed-manager-collapsed";
const pollingIntervalMs = 30000;
const maxVisibleTrends = 6;

const state = {
  feeds: [],
  articles: [],
  clusters: [],
  trends: [],
  feedManagerCollapsed: true,
  trendTimeframe: "24h",
  activeTrend: "",
  filters: {
    search: "",
    topic: "",
    feedId: "",
    from: "",
    to: "",
    showDuplicates: false,
    groupedView: true
  }
};

const renderState = {
  queued: false
};

const runtimeState = {
  pollTimer: null,
  eventSource: null,
  unsubscribeFns: [],
  realtimeMode: false
};

const elements = {
  summary: document.getElementById("summary"),
  articles: document.getElementById("articles"),
  statusLine: document.getElementById("status-line"),
  resultsCount: document.getElementById("results-count"),
  contentTitle: document.getElementById("content-title"),
  searchFilter: document.getElementById("search-filter"),
  topicFilter: document.getElementById("topic-filter"),
  feedFilter: document.getElementById("feed-filter"),
  fromFilter: document.getElementById("from-filter"),
  toFilter: document.getElementById("to-filter"),
  duplicatesToggle: document.getElementById("duplicates-toggle"),
  groupedToggle: document.getElementById("grouped-toggle"),
  clearFilters: document.getElementById("clear-filters"),
  trendTimeframe: document.getElementById("trend-timeframe"),
  trends: document.getElementById("trends"),
  refreshNow: document.getElementById("refresh-now"),
  themeToggle: document.getElementById("theme-toggle"),
  feedForm: document.getElementById("feed-form"),
  feedName: document.getElementById("feed-name"),
  feedTopic: document.getElementById("feed-topic"),
  feedUrl: document.getElementById("feed-url"),
  feedSourceType: document.getElementById("feed-source-type"),
  feedActive: document.getElementById("feed-active"),
  adminStatus: document.getElementById("admin-status"),
  toggleFeedManager: document.getElementById("toggle-feed-manager"),
  feedManagerSection: document.getElementById("feed-manager-section"),
  feedManager: document.getElementById("feed-manager"),
  summaryCardTemplate: document.getElementById("summary-card-template"),
  articleCardTemplate: document.getElementById("article-card-template"),
  feedManagerTemplate: document.getElementById("feed-manager-template")
};

function debounce(callback, wait = 180) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  const themeValue = isDark ? "dark" : "";
  document.documentElement.dataset.theme = themeValue;
  document.documentElement.classList.toggle("dark-theme", isDark);
  document.body.dataset.theme = themeValue;
  document.body.classList.toggle("dark-theme", isDark);
  if (elements.themeToggle) {
    elements.themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  }
}

function loadThemePreference() {
  const value = window.localStorage.getItem(themeStorageKey);
  return value === "dark" ? "dark" : "light";
}

function loadFeedManagerPreference() {
  const value = window.localStorage.getItem(feedManagerStorageKey);
  if (value === null) {
    return true;
  }

  return value === "true";
}

function applyFeedManagerState() {
  elements.feedManagerSection.hidden = state.feedManagerCollapsed;
  elements.toggleFeedManager.textContent = state.feedManagerCollapsed ? "Show" : "Hide";
}

function setAdminStatus(message, tone = "") {
  elements.adminStatus.textContent = message;
  elements.adminStatus.classList.remove("is-success", "is-error");
  if (tone) {
    elements.adminStatus.classList.add(`is-${tone}`);
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

function toDate(value) {
  if (!value) {
    return new Date(0);
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000);
  }

  return new Date(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(toDate(value));
}

function getThumbnailUrl(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate === placeholderImage) {
    return placeholderImage;
  }

  return `/api/image?url=${encodeURIComponent(candidate)}`;
}

function renderSkeletons() {
  elements.articles.innerHTML = Array.from({ length: 6 })
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

function renderSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const summaryItems = [
    { label: "Active feeds", value: state.feeds.filter((feed) => feed.isActive !== false).length },
    { label: "Tracked topics", value: new Set(state.feeds.map((feed) => feed.topic).filter(Boolean)).size },
    { label: "Articles today", value: state.articles.filter((item) => toDate(item.pubDate) >= today).length },
    { label: "Live clusters", value: state.clusters.length },
    { label: "Duplicate items", value: state.articles.filter((item) => item.isDuplicate).length },
    { label: "Trend signals", value: state.trends.length }
  ];

  elements.summary.innerHTML = "";
  const fragment = document.createDocumentFragment();
  summaryItems.forEach((item) => {
    const card = elements.summaryCardTemplate.content.cloneNode(true);
    card.querySelector(".summary-label").textContent = item.label;
    card.querySelector(".summary-value").textContent = String(item.value);
    fragment.appendChild(card);
  });
  elements.summary.appendChild(fragment);
}

function renderFilterOptions() {
  const topics = Array.from(new Set(state.feeds.map((feed) => feed.topic).filter(Boolean))).sort();
  elements.topicFilter.innerHTML = `<option value="">All topics</option>${topics
    .map((topic) => `<option value="${topic}">${topic}</option>`)
    .join("")}`;
  elements.topicFilter.value = state.filters.topic;

  elements.feedFilter.innerHTML = `<option value="">All feeds</option>${state.feeds
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
    .map((feed) => `<option value="${feed.id}">${feed.name || "Untitled Feed"}</option>`)
    .join("")}`;
  elements.feedFilter.value = state.filters.feedId;
}

function renderTrends() {
  elements.trends.innerHTML = "";

  if (!state.trends.length) {
    elements.trends.innerHTML = `<div class="empty-state">No trend data yet.</div>`;
    return;
  }

  const visibleTrends = state.trends
    .slice()
    .sort((left, right) => {
      const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const articleDelta = Number(right.articleCount || 0) - Number(left.articleCount || 0);
      if (articleDelta !== 0) {
        return articleDelta;
      }

      return String(left.label || "").localeCompare(String(right.label || ""));
    })
    .slice(0, maxVisibleTrends);

  const fragment = document.createDocumentFragment();
  visibleTrends.forEach((trend) => {
    const button = document.createElement("button");
    button.className = `trend-pill${state.activeTrend === trend.label ? " is-active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <strong>${trend.label}</strong>
      <span class="trend-meta">${trend.articleCount} articles • ${trend.sourceCount || 0} sources</span>
    `;
    button.addEventListener("click", () => {
      state.activeTrend = state.activeTrend === trend.label ? "" : trend.label;
      renderTrends();
      renderContent();
    });
    fragment.appendChild(button);
  });

  if (state.trends.length > visibleTrends.length) {
    const note = document.createElement("div");
    note.className = "empty-state";
    note.textContent = `Showing top ${visibleTrends.length} signals.`;
    fragment.appendChild(note);
  }

  elements.trends.appendChild(fragment);
}

function renderFeedManager() {
  elements.feedManager.innerHTML = "";
  if (!state.feeds.length) {
    elements.feedManager.innerHTML = `<div class="empty-state">No feeds configured yet.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  state.feeds
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
    .forEach((feed) => {
      const card = elements.feedManagerTemplate.content.cloneNode(true);
      const name = card.querySelector(".manage-name");
      const topic = card.querySelector(".manage-topic");
      const url = card.querySelector(".manage-url");
      const sourceType = card.querySelector(".manage-source-type");
      const active = card.querySelector(".manage-active");
      const saveButton = card.querySelector(".save-feed");
      const deleteButton = card.querySelector(".delete-feed");
      const meta = card.querySelector(".feed-meta");

      name.value = feed.name || "";
      topic.value = feed.topic || "";
      url.value = feed.rssUrl || "";
      sourceType.value = feed.sourceType || "rss";
      active.checked = feed.isActive !== false;
      meta.textContent = `Status: ${feed.lastStatus || "idle"}${feed.lastError ? ` | Error: ${feed.lastError}` : ""}`;

      saveButton.addEventListener("click", async () => {
        setAdminStatus(`Saving ${feed.name || "feed"}...`);
        try {
          await apiRequest(`/api/feeds/${feed.id}`, {
            method: "PUT",
            body: JSON.stringify({
              name: name.value.trim(),
              topic: topic.value.trim(),
              rssUrl: url.value.trim(),
              sourceType: sourceType.value,
              isActive: active.checked
            })
          });
          setAdminStatus("Feed updated successfully.", "success");
          await loadSnapshot();
        } catch (error) {
          setAdminStatus(error.message, "error");
        }
      });

      deleteButton.addEventListener("click", async () => {
        if (!window.confirm(`Delete feed "${feed.name || "Untitled Feed"}" and its articles?`)) {
          return;
        }

        try {
          const result = await apiRequest(`/api/feeds/${feed.id}`, { method: "DELETE" });
          setAdminStatus(`Feed deleted. Removed ${result.deletedArticles || 0} articles.`, "success");
          await loadSnapshot();
        } catch (error) {
          setAdminStatus(error.message, "error");
        }
      });

      fragment.appendChild(card);
    });

  elements.feedManager.appendChild(fragment);
}

function getFilteredArticles() {
  return state.articles
    .filter((article) => {
      if (!state.filters.showDuplicates && article.isDuplicate) {
        return false;
      }

      if (state.filters.topic && article.topic !== state.filters.topic) {
        return false;
      }

      if (state.filters.feedId && article.feedId !== state.filters.feedId) {
        return false;
      }

      if (state.filters.from && toDate(article.pubDate) < new Date(state.filters.from)) {
        return false;
      }

      if (state.filters.to) {
        const end = new Date(state.filters.to);
        end.setHours(23, 59, 59, 999);
        if (toDate(article.pubDate) > end) {
          return false;
        }
      }

      const searchTerms = [article.title, article.source, article.topic, article.summaryShort, ...(article.keywords || [])]
        .join(" ")
        .toLowerCase();
      if (state.filters.search && !searchTerms.includes(state.filters.search.toLowerCase())) {
        return false;
      }

      if (state.activeTrend && ![article.topic, ...(article.keywords || [])].includes(state.activeTrend)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => toDate(right.pubDate) - toDate(left.pubDate));
}

function getFilteredClusters() {
  const filteredArticles = getFilteredArticles();
  const articleMap = new Map(filteredArticles.map((article) => [article.id, article]));
  const resolvedClusters = state.clusters.length
    ? state.clusters
    : filteredArticles
        .filter((article) => !article.isDuplicate)
        .map((article) => ({
          id: article.clusterId || article.id,
          clusterTitle: article.title,
          representativeArticleId: article.id,
          articleIds: [article.id],
          topic: article.topic,
          sourceCount: 1,
          latestPubDate: article.pubDate
        }));

  return resolvedClusters
    .map((cluster) => {
      const relatedArticles = (cluster.articleIds || []).map((id) => articleMap.get(id)).filter(Boolean);
      const representative =
        articleMap.get(cluster.representativeArticleId) ||
        relatedArticles[0] ||
        state.articles.find((article) => article.id === cluster.representativeArticleId);
      return {
        ...cluster,
        relatedArticles,
        representative
      };
    })
    .filter((cluster) => cluster.representative && cluster.relatedArticles.length)
    .sort((left, right) => toDate(right.latestPubDate) - toDate(left.latestPubDate));
}

function renderContent() {
  const grouped = state.filters.groupedView;
  const clusterItems = getFilteredClusters();
  const articleItems = getFilteredArticles();
  const items = grouped ? clusterItems : articleItems;

  elements.contentTitle.textContent = grouped ? "Clustered coverage" : "Latest coverage";
  elements.resultsCount.textContent = `${items.length} results`;
  elements.articles.innerHTML = "";

  if (!items.length) {
    elements.articles.innerHTML = `<div class="empty-state">No coverage matches the active filters.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = elements.articleCardTemplate.content.cloneNode(true);
    const link = card.querySelector(".article-link");
    const image = card.querySelector(".article-image");
    const topic = card.querySelector(".article-topic");
    const source = card.querySelector(".article-source");
    const date = card.querySelector(".article-date");
    const title = card.querySelector(".article-title");
    const summary = card.querySelector(".article-summary");
    const feed = card.querySelector(".article-feed");
    const badge = card.querySelector(".article-badge");
    const relatedPanel = card.querySelector(".related-panel");
    const relatedList = card.querySelector(".related-list");

    const article = grouped ? item.representative : item;
    const relatedArticles = grouped ? item.relatedArticles : [];
    const feedName = state.feeds.find((entry) => entry.id === article.feedId)?.name || "Unknown feed";

    link.href = article.canonicalLink || article.link;
    image.src = getThumbnailUrl(article.thumbnail);
    image.alt = article.title || "Article thumbnail";
    image.onerror = () => {
      image.onerror = null;
      image.src = placeholderImage;
    };
    topic.textContent = article.topic || "General";
    source.textContent = grouped
      ? `${item.sourceCount || new Set(relatedArticles.map((entry) => entry.source)).size} sources`
      : article.source || "Unknown";
    date.textContent = formatDate(grouped ? item.latestPubDate : article.pubDate);
    title.textContent = grouped ? item.clusterTitle || article.title : article.title || "Untitled Article";
    summary.textContent = article.summaryShort || article.summary || article.contentSnippet || "No summary available.";
    feed.textContent = grouped ? feedName : `${feedName}${article.isDuplicate ? " • Duplicate" : ""}`;
    badge.textContent =
      grouped && relatedArticles.length > 1 ? `${relatedArticles.length} related articles` : article.isDuplicate ? "Duplicate" : "";

    if (grouped && relatedArticles.length > 1) {
      relatedPanel.hidden = false;
      relatedArticles
        .filter((relatedArticle) => relatedArticle.id !== article.id)
        .slice(0, 6)
        .forEach((relatedArticle) => {
          const row = document.createElement("div");
          row.className = "related-item";
          row.innerHTML = `
            <a class="related-link" href="${relatedArticle.canonicalLink || relatedArticle.link}" target="_blank" rel="noopener noreferrer">
              <span class="related-thumb-wrap">
                <img class="related-thumb" src="${relatedArticle.thumbnail || placeholderImage}" alt="${relatedArticle.title || "Related article"}" loading="lazy" />
              </span>
              <span class="related-copy">
                <strong class="related-title">${relatedArticle.title}</strong>
                <span class="trend-meta">${relatedArticle.source} • ${formatDate(relatedArticle.pubDate)}</span>
              </span>
            </a>
          `;
          const relatedImage = row.querySelector(".related-thumb");
          relatedImage.src = getThumbnailUrl(relatedArticle.thumbnail);
          relatedImage.onerror = () => {
            relatedImage.onerror = null;
            relatedImage.src = placeholderImage;
          };
          relatedList.appendChild(row);
        });
    }

    fragment.appendChild(card);
  });

  elements.articles.appendChild(fragment);
}

function renderDashboard() {
  renderSummary();
  renderFilterOptions();
  renderTrends();
  renderFeedManager();
  renderContent();
}

function scheduleRender(mode = "full") {
  if (renderState.queued) {
    return;
  }

  renderState.queued = true;
  window.requestAnimationFrame(() => {
    renderState.queued = false;
    if (mode === "content") {
      renderSummary();
      renderContent();
      return;
    }

    if (mode === "trends") {
      renderSummary();
      renderTrends();
      return;
    }

    renderDashboard();
  });
}

async function loadFeeds() {
  state.feeds = await apiRequest("/api/feeds");
}

async function loadArticles() {
  state.articles = await apiRequest("/api/articles");
}

async function loadClusters() {
  state.clusters = await apiRequest("/api/clusters");
}

async function loadTrends() {
  state.trends = await apiRequest(`/api/trends?timeframe=${encodeURIComponent(state.trendTimeframe)}`);
}

async function loadSnapshot() {
  try {
    await Promise.all([loadFeeds(), loadArticles(), loadClusters(), loadTrends()]);
    scheduleRender("full");
    if (!runtimeState.realtimeMode) {
      elements.statusLine.textContent = "Dashboard connected using background refresh.";
    }
  } catch (error) {
    console.error(error);
    elements.statusLine.textContent = "Dashboard data failed to load.";
  }
}

function startPolling() {
  if (runtimeState.pollTimer) {
    window.clearInterval(runtimeState.pollTimer);
  }

  runtimeState.pollTimer = window.setInterval(() => {
    void loadSnapshot();
  }, pollingIntervalMs);
}

async function initRealtime() {
  try {
    if (runtimeState.eventSource) {
      runtimeState.eventSource.close();
    }

    const eventSource = new EventSource("/api/stream");
    runtimeState.eventSource = eventSource;
    runtimeState.realtimeMode = true;
    elements.statusLine.textContent = "Connecting to live updates...";

    const refreshSnapshot = debounce(() => {
      void loadSnapshot();
    }, 250);

    eventSource.addEventListener("ready", () => {
      elements.statusLine.textContent = "Live updates enabled. Articles update automatically.";
    });

    ["article:new", "article:update", "feed:update", "refresh:complete"].forEach((eventName) => {
      eventSource.addEventListener(eventName, () => {
        refreshSnapshot();
      });
    });

    eventSource.onerror = (error) => {
      console.error("Realtime initialization failed", error);
      runtimeState.realtimeMode = false;
      elements.statusLine.textContent = "Realtime unavailable. Using background refresh.";
      eventSource.close();
      startPolling();
    };
  } catch (error) {
    console.error("Realtime initialization failed", error);
    runtimeState.realtimeMode = false;
    elements.statusLine.textContent = "Realtime unavailable. Using background refresh.";
    startPolling();
  }
}

function bindEvents() {
  const debouncedSearch = debounce((value) => {
    state.filters.search = value.trim();
    renderContent();
  });

  elements.searchFilter.addEventListener("input", (event) => debouncedSearch(event.target.value));
  elements.topicFilter.addEventListener("change", (event) => {
    state.filters.topic = event.target.value;
    renderContent();
  });
  elements.feedFilter.addEventListener("change", (event) => {
    state.filters.feedId = event.target.value;
    renderContent();
  });
  elements.fromFilter.addEventListener("change", (event) => {
    state.filters.from = event.target.value;
    renderContent();
  });
  elements.toFilter.addEventListener("change", (event) => {
    state.filters.to = event.target.value;
    renderContent();
  });
  elements.duplicatesToggle.addEventListener("change", (event) => {
    state.filters.showDuplicates = event.target.checked;
    renderContent();
  });
  elements.groupedToggle.addEventListener("change", (event) => {
    state.filters.groupedView = event.target.checked;
    renderContent();
  });
  elements.clearFilters.addEventListener("click", () => {
    state.activeTrend = "";
    state.filters = {
      search: "",
      topic: "",
      feedId: "",
      from: "",
      to: "",
      showDuplicates: false,
      groupedView: true
    };
    elements.searchFilter.value = "";
    elements.topicFilter.value = "";
    elements.feedFilter.value = "";
    elements.fromFilter.value = "";
    elements.toFilter.value = "";
    elements.duplicatesToggle.checked = false;
    elements.groupedToggle.checked = true;
    renderDashboard();
  });

  elements.refreshNow.addEventListener("click", async () => {
    elements.statusLine.textContent = "Refreshing feeds in the background...";
    try {
      const result = await apiRequest("/api/feeds/refresh", { method: "POST" });
      elements.statusLine.textContent = result.message || "Feed refresh started.";
      await loadSnapshot();
    } catch (error) {
      elements.statusLine.textContent = error.message;
    }
  });

  elements.trendTimeframe.addEventListener("change", async (event) => {
    state.trendTimeframe = event.target.value;
    await loadTrends();
    scheduleRender("trends");
  });

  elements.themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
  });

  elements.feedForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = document.getElementById("submit-feed");
    const payload = {
      name: elements.feedName.value.trim(),
      topic: elements.feedTopic.value.trim(),
      rssUrl: elements.feedUrl.value.trim(),
      sourceType: elements.feedSourceType.value,
      isActive: elements.feedActive.checked
    };

    if (!payload.rssUrl) {
      setAdminStatus("RSS URL is required.", "error");
      return;
    }

    submitButton.disabled = true;
    setAdminStatus("Adding feed...");

    try {
      await apiRequest("/api/feeds", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      elements.feedName.value = "";
      elements.feedTopic.value = "";
      elements.feedUrl.value = "";
      elements.feedSourceType.value = "google-alert";
      elements.feedActive.checked = true;
      setAdminStatus("Feed added successfully.", "success");
      await loadSnapshot();
    } catch (error) {
      setAdminStatus(error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  elements.toggleFeedManager.addEventListener("click", () => {
    state.feedManagerCollapsed = !state.feedManagerCollapsed;
    window.localStorage.setItem(feedManagerStorageKey, String(state.feedManagerCollapsed));
    applyFeedManagerState();
  });
}

async function init() {
  state.feedManagerCollapsed = loadFeedManagerPreference();
  applyTheme(loadThemePreference());
  applyFeedManagerState();
  bindEvents();
  renderSkeletons();
  await loadSnapshot();
  await initRealtime();
}

void init();
