const API_BASE = "";
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#5eead4"/>
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="#101a2d"/>
      <rect x="20" y="20" width="760" height="410" rx="24" fill="url(#g)" opacity="0.2"/>
      <text x="50%" y="50%" fill="#edf3fb" font-size="36" font-family="Segoe UI, sans-serif" text-anchor="middle">
        No Thumbnail
      </text>
    </svg>
  `);

const state = {
  articles: [],
  feeds: [],
  topics: [],
  filters: {
    topic: "",
    feedId: "",
    startDate: "",
    endDate: ""
  }
};

const elements = {
  articleGrid: document.getElementById("articles-grid"),
  articleTemplate: document.getElementById("article-card-template"),
  topicFilter: document.getElementById("topic-filter"),
  feedFilter: document.getElementById("feed-filter"),
  startDateFilter: document.getElementById("start-date-filter"),
  endDateFilter: document.getElementById("end-date-filter"),
  resultsCount: document.getElementById("results-count"),
  connectionBadge: document.getElementById("connection-badge"),
  lastPollLabel: document.getElementById("last-poll-label"),
  metricActiveFeeds: document.getElementById("metric-active-feeds"),
  metricTopics: document.getElementById("metric-topics"),
  metricArticlesToday: document.getElementById("metric-articles-today"),
  metricFailedFeeds: document.getElementById("metric-failed-feeds"),
  feedList: document.getElementById("feed-list"),
  applyFiltersButton: document.getElementById("apply-filters-button"),
  clearFiltersButton: document.getElementById("clear-filters-button"),
  feedForm: document.getElementById("feed-form"),
  feedFormMessage: document.getElementById("feed-form-message"),
  refreshAllButton: document.getElementById("refresh-all-button")
};

function formatDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function renderSummary(summary) {
  elements.metricActiveFeeds.textContent = summary.activeFeeds ?? 0;
  elements.metricTopics.textContent = summary.topics ?? 0;
  elements.metricArticlesToday.textContent = summary.articleCountToday ?? 0;
  elements.metricFailedFeeds.textContent = summary.failedFeeds ?? 0;
  elements.lastPollLabel.textContent = `Last poll: ${summary.latestPollAt ? formatDate(summary.latestPollAt) : "--"}`;
}

function renderFeeds() {
  if (!state.feeds.length) {
    elements.feedList.innerHTML = `<div class="empty-state">No feeds configured yet.</div>`;
    return;
  }

  elements.feedList.innerHTML = state.feeds
    .map((feed) => {
      const status = feed.lastStatus || "idle";
      return `
        <article class="feed-item">
          <div class="feed-item-top">
            <strong>${escapeHtml(feed.name)}</strong>
            <span class="feed-state ${status}">${status}</span>
          </div>
          <div class="feed-item-meta">
            <span>${escapeHtml(feed.topic)}</span>
            <span>${feed.lastFetchedAt ? formatDate(feed.lastFetchedAt) : "Never"}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFilterOptions() {
  elements.topicFilter.innerHTML = `<option value="">All topics</option>${state.topics
    .map((topic) => `<option value="${escapeAttribute(topic)}">${escapeHtml(topic)}</option>`)
    .join("")}`;

  elements.feedFilter.innerHTML = `<option value="">All feeds</option>${state.feeds
    .map((feed) => `<option value="${feed._id}">${escapeHtml(feed.name)}</option>`)
    .join("")}`;
}

function createCard(article) {
  const fragment = elements.articleTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".article-card");
  const link = fragment.querySelector(".article-link");
  const image = fragment.querySelector(".card-image");
  const topic = fragment.querySelector(".card-topic");
  const source = fragment.querySelector(".card-source");
  const date = fragment.querySelector(".card-date");
  const title = fragment.querySelector(".card-title");
  const feed = fragment.querySelector(".card-feed");

  link.href = article.link;
  image.src = article.thumbnailUrl || PLACEHOLDER_IMAGE;
  image.alt = article.title;
  topic.textContent = article.topic;
  source.textContent = article.source;
  date.textContent = formatDate(article.publishedAt);
  title.textContent = article.title;
  feed.textContent = article.feedName;
  card.dataset.id = article._id;

  return fragment;
}

function renderArticles() {
  elements.articleGrid.innerHTML = "";

  if (!state.articles.length) {
    elements.articleGrid.innerHTML = `<div class="empty-state">No articles match the current filters.</div>`;
    elements.resultsCount.textContent = "0 results";
    return;
  }

  const fragment = document.createDocumentFragment();
  state.articles.forEach((article) => fragment.appendChild(createCard(article)));
  elements.articleGrid.appendChild(fragment);
  elements.resultsCount.textContent = `${state.articles.length} results`;
}

function articleMatchesFilters(article) {
  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (state.filters.feedId && article.feedId !== state.filters.feedId) {
    return false;
  }

  if (state.filters.startDate && new Date(article.publishedAt) < new Date(`${state.filters.startDate}T00:00:00`)) {
    return false;
  }

  if (state.filters.endDate && new Date(article.publishedAt) > new Date(`${state.filters.endDate}T23:59:59`)) {
    return false;
  }

  return true;
}

function upsertArticle(article) {
  const index = state.articles.findIndex((item) => item._id === article._id);

  if (!articleMatchesFilters(article)) {
    if (index !== -1) {
      state.articles.splice(index, 1);
      renderArticles();
    }
    return;
  }

  if (index === -1) {
    state.articles.unshift(article);
  } else {
    state.articles[index] = article;
  }

  state.articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  renderArticles();
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

async function loadSummary() {
  const summary = await api("/api/dashboard/summary");
  renderSummary(summary);
}

async function loadFeeds() {
  state.feeds = await api("/api/feeds");
  renderFeeds();
  renderFilterOptions();
}

async function loadFilters() {
  const payload = await api("/api/articles/filters");
  state.topics = payload.topics;
  renderFilterOptions();
}

function buildArticleQuery() {
  const params = new URLSearchParams();
  if (state.filters.topic) params.set("topic", state.filters.topic);
  if (state.filters.feedId) params.set("feedId", state.filters.feedId);
  if (state.filters.startDate) params.set("startDate", state.filters.startDate);
  if (state.filters.endDate) params.set("endDate", state.filters.endDate);
  params.set("limit", "48");
  return params.toString();
}

async function loadArticles() {
  const query = buildArticleQuery();
  const payload = await api(`/api/articles${query ? `?${query}` : ""}`);
  state.articles = payload.items;
  renderArticles();
}

function collectFilters() {
  state.filters.topic = elements.topicFilter.value;
  state.filters.feedId = elements.feedFilter.value;
  state.filters.startDate = elements.startDateFilter.value;
  state.filters.endDate = elements.endDateFilter.value;
}

function clearFilters() {
  elements.topicFilter.value = "";
  elements.feedFilter.value = "";
  elements.startDateFilter.value = "";
  elements.endDateFilter.value = "";
  collectFilters();
}

async function submitFeedForm(event) {
  event.preventDefault();
  elements.feedFormMessage.textContent = "";

  const formData = new FormData(elements.feedForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    topic: String(formData.get("topic") || "").trim(),
    rssUrl: String(formData.get("rssUrl") || "").trim()
  };

  try {
    await api("/api/feeds", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    elements.feedForm.reset();
    elements.feedFormMessage.textContent = "Feed added successfully.";
    await Promise.all([loadFeeds(), loadFilters(), loadSummary()]);
  } catch (error) {
    elements.feedFormMessage.textContent = error.message;
  }
}

async function refreshAllFeeds() {
  const activeFeeds = state.feeds.filter((feed) => feed.isActive);
  await Promise.all(activeFeeds.map((feed) => api(`/api/feeds/${feed._id}/refresh`, { method: "POST" })));
  await Promise.all([loadSummary(), loadFeeds(), loadArticles()]);
}

function connectStream() {
  const events = new EventSource("/api/stream");

  events.addEventListener("ready", () => {
    elements.connectionBadge.textContent = "Online";
    elements.connectionBadge.classList.remove("offline");
    elements.connectionBadge.classList.add("online");
  });

  events.addEventListener("article:new", (event) => {
    const payload = JSON.parse(event.data);
    upsertArticle(payload.article);
    loadSummary().catch(() => {});
  });

  events.addEventListener("article:update", (event) => {
    const payload = JSON.parse(event.data);
    upsertArticle(payload.article);
  });

  events.onerror = () => {
    elements.connectionBadge.textContent = "Offline";
    elements.connectionBadge.classList.remove("online");
    elements.connectionBadge.classList.add("offline");
  };
}

function bindEvents() {
  elements.applyFiltersButton.addEventListener("click", async () => {
    collectFilters();
    await loadArticles();
  });

  elements.clearFiltersButton.addEventListener("click", async () => {
    clearFilters();
    await loadArticles();
  });

  elements.feedForm.addEventListener("submit", submitFeedForm);
  elements.refreshAllButton.addEventListener("click", refreshAllFeeds);
}

async function init() {
  bindEvents();
  await Promise.all([loadSummary(), loadFeeds(), loadFilters(), loadArticles()]);
  connectStream();
}

init().catch((error) => {
  console.error(error);
  elements.articleGrid.innerHTML = `<div class="empty-state">Failed to load dashboard.</div>`;
});
