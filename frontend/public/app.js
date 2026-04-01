const API_BASE = "/api";

const state = {
  feeds: [],
  articles: [],
  stats: {}
};

function $(id) {
  return document.getElementById(id);
}

function setFormStatus(message) {
  const el = $("feed-form-status");
  if (el) el.textContent = message;
}

function setConnectionStatus(message) {
  const el = $("connection-status");
  if (el) el.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

async function loadSnapshot() {
  try {
    setConnectionStatus("Loading dashboard...");

    const [feedsRes, articlesRes] = await Promise.all([
      fetch(`${API_BASE}/feeds`, {
        headers: { Accept: "application/json" }
      }),
      fetch(`${API_BASE}/articles`, {
        headers: { Accept: "application/json" }
      })
    ]);

    if (!feedsRes.ok) {
      throw new Error(`Feeds load failed (${feedsRes.status})`);
    }

    if (!articlesRes.ok) {
      throw new Error(`Articles load failed (${articlesRes.status})`);
    }

    const feeds = await feedsRes.json();
    const articles = await articlesRes.json();

    state.feeds = Array.isArray(feeds) ? feeds : [];
    state.articles = Array.isArray(articles) ? articles : [];
    state.stats = {};

    renderSummary();
    renderFeeds();
    renderArticles();

    setConnectionStatus("Live updates connected.");
  } catch (error) {
    console.error("Failed to load snapshot:", error);
    setConnectionStatus("Failed to load dashboard data.");
  }
}

function renderSummary() {
  const grid = $("summary-grid");
  const resultsCount = $("results-count");
  if (!grid) return;

  grid.innerHTML = "";

  const cards = [
    { label: "Tracked sources", value: state.feeds.length },
    { label: "Articles", value: state.articles.length },
    { label: "Active topics", value: new Set(state.feeds.map((f) => f.topic).filter(Boolean)).size },
    { label: "Live status", value: "Healthy" }
  ];

  for (const card of cards) {
    const article = document.createElement("article");
    article.className = "summary-card";
    article.innerHTML = `
      <span class="summary-label">${escapeHtml(card.label)}</span>
      <strong class="summary-value">${escapeHtml(card.value)}</strong>
    `;
    grid.appendChild(article);
  }

  if (resultsCount) {
    resultsCount.textContent = `${state.articles.length} results`;
  }
}

function getFeedMeta(feed) {
  const parts = [];
  if (feed.topic) parts.push(feed.topic);
  if (feed.sourceType) parts.push(feed.sourceType.toUpperCase());
  if (feed.rssUrl) parts.push(feed.rssUrl);
  return parts.join(" • ");
}

function renderFeeds() {
  const list = $("feed-list");
  const count = $("feed-count");
  if (!list) return;

  list.innerHTML = "";

  for (const feed of state.feeds) {
    const item = document.createElement("article");
    item.className = "feed-item";
    item.innerHTML = `
      <div class="feed-item-main">
        <h3 class="feed-item-title">${escapeHtml(feed.name || "Untitled source")}</h3>
        <p class="feed-item-meta">${escapeHtml(getFeedMeta(feed))}</p>
      </div>
      <div class="feed-item-side">
        <span class="feed-status">${escapeHtml(feed.lastStatus || "idle")}</span>
        <div class="feed-item-actions">
          <button class="ghost-button feed-edit-button" type="button" data-edit-id="${escapeHtml(feed.id)}">Edit</button>
          <button class="ghost-button feed-refresh-button" type="button" data-refresh-id="${escapeHtml(feed.id)}">Refresh</button>
          <button class="ghost-button feed-delete-button" type="button" data-delete-id="${escapeHtml(feed.id)}">Delete</button>
        </div>
      </div>
    `;
    list.appendChild(item);
  }

  if (count) {
    count.textContent = String(state.feeds.length);
  }
}

function renderArticles() {
  const grid = $("articles-grid");
  if (!grid) return;

  grid.innerHTML = "";

  for (const article of state.articles) {
    const card = document.createElement("article");
    card.className = "article-card";

    const href = article.link || article.canonicalLink || "#";
    const hasThumbnail = Boolean(article.thumbnail);

    card.innerHTML = `
      <a class="article-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
        <div class="article-media ${hasThumbnail ? "has-thumbnail" : "is-empty"}" data-thumbnail-state="${hasThumbnail ? "has-thumbnail" : "no-thumbnail"}">
          ${
            hasThumbnail
              ? `<img class="article-image" src="/api/image?url=${encodeURIComponent(article.thumbnail)}" alt="${escapeHtml(article.title || "")}" loading="lazy" />`
              : ""
          }
          <span class="article-topic">${escapeHtml(article.topic || "")}</span>
        </div>
        <div class="article-body">
          <div class="article-meta">
            <span class="article-source">${escapeHtml(article.source || "")}</span>
            <span class="article-date">${escapeHtml(formatDate(article.pubDate))}</span>
          </div>
          <h3 class="article-title">${escapeHtml(article.title || "Untitled article")}</h3>
          <p class="article-feed">${escapeHtml(article.summaryShort || article.feedName || "")}</p>
        </div>
      </a>
    `;

    grid.appendChild(card);
  }
}

async function importDmvFeeds() {
  const btn = $("import-dmv-button");
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Importing DMV feeds...";
  setFormStatus("Importing DMV feeds...");

  try {
    const res = await fetch(`${API_BASE}/admin/import-dmv`, {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Import failed");
    }

    setFormStatus(
      `Imported ${data.imported ?? 0}, skipped ${data.skipped ?? 0}, failed ${data.failed ?? 0}`
    );

    await loadSnapshot();
  } catch (error) {
    console.error("DMV import failed:", error);
    setFormStatus(error?.message || "Import failed");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function editFeed(feedId) {
  const feed = state.feeds.find((item) => item.id === feedId);
  if (!feed) return;

  const newName = window.prompt("Edit source name", feed.name || "");
  if (newName === null) return;

  const trimmedName = newName.trim();
  if (!trimmedName) {
    setFormStatus("Name cannot be empty.");
    return;
  }

  try {
    setFormStatus("Saving source...");
    const res = await fetch(`${API_BASE}/feeds/${feedId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        name: trimmedName
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Failed to update source");
    }

    setFormStatus("Source updated.");
    await loadSnapshot();
  } catch (error) {
    console.error("Edit feed failed:", error);
    setFormStatus(error?.message || "Failed to update source");
  }
}

async function refreshFeed(feedId) {
  try {
    setFormStatus("Refreshing source...");
    const res = await fetch(`${API_BASE}/feeds/${feedId}/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Failed to refresh source");
    }

    setFormStatus("Source refresh started.");
    await loadSnapshot();
  } catch (error) {
    console.error("Refresh feed failed:", error);
    setFormStatus(error?.message || "Failed to refresh source");
  }
}

async function deleteFeed(feedId) {
  const confirmed = window.confirm("Delete this source?");
  if (!confirmed) return;

  try {
    setFormStatus("Deleting source...");
    const res = await fetch(`${API_BASE}/feeds/${feedId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json"
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Failed to delete source");
    }

    setFormStatus("Source deleted.");
    await loadSnapshot();
  } catch (error) {
    console.error("Delete feed failed:", error);
    setFormStatus(error?.message || "Failed to delete source");
  }
}

function bindEvents() {
  const refreshBtn = $("refresh-button");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadSnapshot);
  }

  const importBtn = $("import-dmv-button");
  if (importBtn) {
    importBtn.addEventListener("click", importDmvFeeds);
  }

  const themeBtn = $("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }

  const panelToggle = $("feed-panel-toggle");
  const panelContent = $("feed-panel-content");
  if (panelToggle && panelContent) {
    panelToggle.addEventListener("click", () => {
      const expanded = panelToggle.getAttribute("aria-expanded") === "true";
      panelToggle.setAttribute("aria-expanded", String(!expanded));
      panelToggle.textContent = expanded ? "Show sources" : "Hide sources";
      panelContent.hidden = expanded;
    });
  }

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-id]");
    if (editButton) {
      editFeed(editButton.getAttribute("data-edit-id"));
      return;
    }

    const refreshButton = event.target.closest("[data-refresh-id]");
    if (refreshButton) {
      refreshFeed(refreshButton.getAttribute("data-refresh-id"));
      return;
    }

    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) {
      deleteFeed(deleteButton.getAttribute("data-delete-id"));
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadSnapshot();
});
