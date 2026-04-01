const API_BASE = "/api";

let state = {
  feeds: [],
  articles: [],
  stats: {}
};

// ===== Helpers =====

function setStatus(message) {
  const el = document.getElementById("status");
  if (el) el.textContent = message;
}

function $(id) {
  return document.getElementById(id);
}

// ===== Data loading =====

async function loadSnapshot() {
  try {
    setStatus("Loading...");

    const res = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();

    state.feeds = data.feeds || [];
    state.articles = data.articles || [];
    state.stats = data.stats || {};

    renderFeeds();
    renderArticles();
    renderStats();

    setStatus("Ready");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load data");
  }
}

// ===== Rendering =====

function renderFeeds() {
  const container = $("feeds");
  if (!container) return;

  container.innerHTML = "";

  state.feeds.forEach(feed => {
    const div = document.createElement("div");
    div.className = "feed-item";
    div.textContent = feed.name || feed.url;
    container.appendChild(div);
  });
}

function renderArticles() {
  const container = $("articles");
  if (!container) return;

  container.innerHTML = "";

  state.articles.forEach(article => {
    const div = document.createElement("div");
    div.className = "article-item";

    div.innerHTML = `
      <div><strong>${article.title || "No title"}</strong></div>
      <div>${article.source || ""}</div>
    `;

    container.appendChild(div);
  });
}

function renderStats() {
  const el = $("stats");
  if (!el) return;

  el.textContent = `Feeds: ${state.feeds.length} | Articles: ${state.articles.length}`;
}

// ===== DMV Import =====

async function importDmvFeeds() {
  const btn = $("import-dmv-button");
  if (!btn) return;

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Importing DMV feeds...";

  try {
    setStatus("Importing DMV feeds...");

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

    const msg = `Imported ${data.imported}, skipped ${data.skipped}, failed ${data.failed}`;
    setStatus(msg);

    await loadSnapshot();
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Import failed");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ===== Event bindings =====

function bindEvents() {
  const refreshBtn = $("refresh-button");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadSnapshot);
  }

  const importBtn = $("import-dmv-button");
  if (importBtn) {
    importBtn.addEventListener("click", importDmvFeeds);
  }

  const darkBtn = $("dark-mode-toggle");
  if (darkBtn) {
    darkBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }
}

// ===== Init =====

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadSnapshot();
});
