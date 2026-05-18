const PLACEHOLDER_IMAGE = "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";
const THEME_STORAGE_KEY = "rss-monitor-theme";
const FEED_PANEL_COLLAPSED_STORAGE_KEY = "feedPanelCollapsed";
const ALERT_SNAPSHOT_STORAGE_KEY = "prevSnapshot";
const ALERT_DEDUPE_STORAGE_KEY = "recentAlertKeys";
const ALERT_ARTICLE_FILTER_STORAGE_KEY = "activeAlertArticleFilter";
const ACTIVITY_LOG_STORAGE_KEY = "dashboardActivityLog";
const ALERT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const ACTIVITY_LOG_TTL_MS = 24 * 60 * 60 * 1000;
const POLLING_INTERVAL_MS = 30000;
const ARTICLE_PAGE_SIZE = 400;
const NOTIFICATION_TIMEOUT_MS = 7000;
const DEBUG_INTELLIGENCE = false;
const APP_BUILD = "pagination-feed-debug-v1";
const SHOW_FEED_INSIGHTS = false;
const SHOW_RECENT_ALERTS = false;
const SHOW_ACTIVITY_LOG = false;
const DASHBOARD_ALERT_LIMIT = 8;
const ACTIVITY_LOG_LIMIT = 24;
const LOW_VALUE_ARTICLE_THRESHOLD = 5;
const SUMMARY_METRICS = [
  { label: "Active feeds", key: "activeFeeds" },
  { label: "Tracked topics", key: "topics" },
  { label: "Articles today", key: "articlesToday" },
  { label: "Latest articles", key: "totalArticles" },
];
const DEFAULT_SOURCE_GROUPS = ["USA", "Canada", "Google Alerts", "Other"];
const TAG_FILTER_MIN_COUNT = 0;
const ARTICLE_RENDER_PAGE_SIZE = 30;
const TAG_LIST_STORAGE_KEY = "dashboardTagList";
const KEYWORD_FILTER_STORAGE_KEY = "dashboardKeywordFilters";
const NOISE_KEYWORDS_EXPANDED_STORAGE_KEY = "noiseKeywordsExpanded";
const DEFAULT_TAGS = [
  "identity",
  "identity verification",
  "id document",
  "passport",
  "id card",
  "visa",
  "epassport",
  "driver license",
  "banknotes",
  "coins",
  "currency",
  "security",
  "fraud",
  "counterfeit",
  "cyber security",
  "identity theft",
  "biometrics",
  "authentication",
  "artificial intelligence",
  "regulation",
  "travel",
  "privacy",
  "immigration",
  "travel document",
  "document security",
  "border control",
  "forgery",
  "verification",
  "central bank",
  "monetary policy",
  "sanctions",
  "border security",
  "digital identity",
];
const TAG_ALIASES = {
  passports: "passport",
  numismatics: "coins",
  commemorative: "commemorative coins",
};
let activeTags = [];
let activeTagSet = new Set();
let activeTagsLoaded = false;
const DEFAULT_KEYWORD_EXCLUDES = [
  "honda",
  "nissan",
  "toyota",
  "car",
  "cars",
  "suv",
  "vehicle",
  "vehicles",
  "engine",
  "specs",
  "crossover",
  "automotive",
  "auto",
  "review",
  "pricing",
  "horsepower",
];
const DEFAULT_KEYWORD_INCLUDES = [
  "visa",
  "immigration",
  "border",
  "document",
  "identity",
  "verification",
  "travel document",
];
const DRIVER_LICENSE_FALSE_POSITIVE_TERMS = [
  "driver license",
  "drivers license",
  "driver's license",
];
const MUSIC_FALSE_POSITIVE_KEYWORDS = [
  "olivia rodrigo",
  "song",
  "songs",
  "music",
  "lyrics",
  "lyric",
  "album",
  "single",
  "spotify",
  "apple music",
  "youtube music",
  "billboard",
  "chart",
  "charts",
  "streaming",
  "pop star",
  "singer",
  "artist",
  "concert",
  "track",
];
const COIN_FALSE_POSITIVE_TERMS = ["coin", "coins"];
const GAMING_COIN_FALSE_POSITIVE_KEYWORDS = [
  "game",
  "games",
  "gaming",
  "in-game",
  "ingame",
  "virtual currency",
  "virtual coins",
  "coin pack",
  "coins pack",
  "reward",
  "rewards",
  "battle pass",
  "loot",
  "skins",
  "token",
  "tokens",
  "xp",
  "level up",
  "mobile game",
  "steam",
  "xbox",
  "playstation",
  "nintendo",
  "fortnite",
  "roblox",
  "minecraft",
  "app store",
  "google play",
];
const COIN_CONTEXT_KEYWORDS = [
  "mint",
  "commemorative",
  "circulation",
  "collector",
  "collectible",
  "numismatic",
  "numismatics",
  "euro coin",
  "coin design",
  "central bank",
  "issue",
  "issued",
  "mintage",
  "obverse",
  "reverse",
  "bullion",
];
const TOPIC_KEYWORD_RULES = {
  passport: {
    include: ["visa", "immigration", "border", "document", "identity", "travel document"],
    exclude: DEFAULT_KEYWORD_EXCLUDES,
  },
  "driver license": {
    include: ["dmv", "driver", "document", "identity", "permit", "registration"],
    exclude: MUSIC_FALSE_POSITIVE_KEYWORDS,
  },
  coins: {
    include: COIN_CONTEXT_KEYWORDS,
    exclude: GAMING_COIN_FALSE_POSITIVE_KEYWORDS,
  },
  banknotes: {
    include: ["central bank", "note", "banknote", "issued", "circulation", "currency", "security printing"],
    exclude: ["game currency", "gaming", "token pack", "virtual currency"],
  },
  visa: {
    include: ["immigration", "border", "permit", "travel", "passport", "embassy"],
    exclude: ["payment card", "visa card", "credit card", "debit card", "mastercard", "banking"],
  },
  "identity document": {
    include: ["id", "document", "verification", "biometrics", "authentication", "security"],
    exclude: ["celebrity gossip", "music", "song", "songs", "lyrics", "album", "concert", "entertainment"],
  },
};
const TOPIC_KEYWORD_RULE_ALIASES = {
  passport: "passport",
  passports: "passport",
  epassport: "passport",
  "e-passport": "passport",
  "driver licenses": "driver license",
  "drivers license": "driver license",
  "driver's license": "driver license",
  "driving license": "driver license",
  coin: "coins",
  coins: "coins",
  numismatic: "coins",
  numismatics: "coins",
  banknote: "banknotes",
  banknotes: "banknotes",
  visa: "visa",
  visas: "visa",
  identity: "identity document",
  "identity documents": "identity document",
  "identity document": "identity document",
  "id document": "identity document",
  "id documents": "identity document",
  "id card": "identity document",
};
const SIGNAL_CATEGORIES = [
  {
    id: "new-releases",
    label: "New releases",
    badgeLabel: "Release",
    strong: ["issued", "released", "launched", "introduced", "unveiled"],
    requiredObjects: ["banknote", "passport", "id card", "identity document", "driver license"],
    noise: [
      "central bank",
      "inflation",
      "interest rate",
      "borrowing",
      "loan",
      "market",
      "economy",
      "investment",
      "monetary policy",
    ],
    exclude: [],
  },
  {
    id: "regulations",
    label: "Regulations",
    badgeLabel: "Regulation",
    strong: ["regulation", "regulations", "law", "requirement", "requirements", "compliance"],
    weak: ["rule", "rules", "guidance", "policy", "directive", "standard", "standards"],
    exclude: [],
  },
  {
    id: "design-changes",
    label: "Design changes",
    badgeLabel: "Design",
    strong: [
      "new design",
      "redesigned",
      "redesign",
      "updated design",
      "design change",
      "banknote design",
      "passport design",
      "id card design",
    ],
    weak: ["new series", "motif", "portrait", "symbol", "theme", "visual identity", "polymer design"],
    exclude: [],
  },
  {
    id: "security-features",
    label: "Security features",
    badgeLabel: "Security",
    strong: ["hologram", "watermark", "security feature", "uv ink", "ovi", "microprint", "intaglio"],
    weak: ["new", "enhanced", "advanced"],
    exclude: [],
  },
  {
    id: "technology",
    label: "Technology",
    badgeLabel: "Technology",
    strong: ["biometric", "biometrics", "chip", "nfc", "digital id", "verification", "identity verification"],
    weak: ["authentication", "machine readable", "mrz", "mobile id", "eid"],
    exclude: [],
  },
];
const SIGNAL_CATEGORY_BY_ID = new Map(SIGNAL_CATEGORIES.map((category) => [category.id, category]));
const SIGNAL_CORE_OBJECT_KEYWORDS = [
  "banknote",
  "banknotes",
  "currency",
  "passport",
  "identity",
  "id",
  "document",
  "driver license",
];
const SIGNAL_STRICT_INCLUDE_KEYWORDS = [
  "passport",
  "id card",
  "identity document",
  "driver license",
  "hologram",
  "security feature",
  "anti-counterfeit",
  "polymer note",
  "banknote design",
  "new banknote",
  "issued banknote",
  "currency redesign",
  "printing technology",
];
const SIGNAL_RELEASE_VARIANT_KEYWORDS = [
  "confirmed",
  "new sig/date",
  "new signature",
  "new date",
  "signature date",
  "sig/date",
  "new variety",
  "new variant",
  "replacement note",
  "new note",
  "issued note",
  "banknote confirmed",
];
const SIGNAL_RELEASE_OBJECT_KEYWORDS = [
  "banknote",
  "note",
  "notes",
  "quetzal",
  "dollar",
  "dinar",
  "peso",
  "rupee",
  "leu",
  "euro",
  "currency",
];
const BANKNOTE_SIGNAL_OBJECT_KEYWORDS = [
  "banknote",
  "banknotes",
  "note",
  "notes",
  "currency",
  "legal tender",
  "polymer",
  "security thread",
];
const BANKNOTE_HIGH_PRIORITY_KEYWORDS = [
  "withdraw",
  "withdrawn",
  "withdrawal",
  "demonetised",
  "demonetized",
  "demonetisation",
  "demonetization",
  "out of circulation",
  "cease legal tender",
  "no longer legal tender",
  "legal tender until",
  "exchange deadline",
  "banknote series",
  "new series",
  "redesigned",
  "redesign",
  "new design",
  "new banknote design",
  "new banknote family",
  "security feature",
  "security features",
  "hologram",
  "windowed thread",
  "security thread",
  "polymer",
  "upgraded banknote",
  "enhanced security",
  "counterfeit prevention",
  "anti-counterfeit",
];
const BANKNOTE_LOW_PRIORITY_KEYWORDS = [
  "new sig/date",
  "new signature",
  "new date",
  "signature date",
  "confirmed",
  "reported",
  "catalog",
];
const BANKNOTE_LOW_PRIORITY_CODE_PATTERN = /\bb\d{2,}[a-z]?\b/i;
const ID_SIGNAL_OBJECT_KEYWORDS = [
  "passport",
  "passports",
  "id card",
  "identity card",
  "identity document",
  "national id",
  "driver license",
  "driving licence",
  "residence permit",
  "visa",
  "e-passport",
  "epassport",
  "biometric passport",
];
const ID_SIGNAL_VALID_CONTEXT_KEYWORDS = [
  "passport",
  "id card",
  "identity document",
  "driver license",
  "residence permit",
  "national id",
  "biometric",
  "border control",
  "immigration",
  "identity verification",
  "digital id",
  "aadhaar",
  "e-ktp",
];
const ID_SIGNAL_NOISE_CONTEXT_KEYWORDS = [
  "smartphone",
  "foldable",
  "rumor",
  "rumored",
  "leak",
  "speculation",
  "preview",
  "hands-on",
  "review",
  "concept device",
  "prototype device",
];
const ID_SIGNAL_SYSTEM_EVENT_KEYWORDS = [
  "rollout",
  "launched",
  "introduced",
  "deployed",
  "implemented",
  "law",
  "regulation",
  "mandate",
  "policy change",
  "compliance",
  "breach",
  "biometric system",
  "fraud network",
  "identity theft system-level",
  "passport system",
  "id system",
  "identity platform",
  "verification system",
];
const ID_SIGNAL_SYSTEM_IMPACT_KEYWORDS = [
  "rollout",
  "launched",
  "introduced",
  "implemented",
  "deployed",
  "system upgrade",
  "mandatory",
  "enforced",
  "requirement",
  "compliance rule",
  "new law applied",
  "biometric system change",
  "passport system change",
  "id verification change",
  "border control change",
  "breach",
  "fraud network",
  "system vulnerability",
];
const ID_SIGNAL_NON_SYSTEM_NOISE_KEYWORDS = [
  "man",
  "woman",
  "person",
  "individual",
  "case of",
  "arrested",
  "encountered",
  "denied passport",
  "issued wrong",
  "leader says",
  "backs",
  "criticizes",
  "debate",
  "calls for",
  "urges",
  "court case",
  "lawsuit",
  "sues",
  "supreme court",
];
const ID_SIGNAL_NON_IMPACT_KEYWORDS = [
  "why",
  "what is",
  "how to",
  "guide",
  "explained",
  "man",
  "woman",
  "individual",
  "encountered",
  "unable to",
  "denied",
  "says",
  "backs",
  "calls for",
  "criticizes",
  "court",
  "lawsuit",
  "supreme court",
];
const ID_SIGNAL_RELEASE_STRONG_KEYWORDS = [
  "issued",
  "released",
  "launched",
  "introduced",
  "unveiled",
  "rollout",
  "roll out",
  "next generation",
];
const ID_SIGNAL_RELEASE_SUPPORT_KEYWORDS = [
  "new passport",
  "new id card",
  "new identity card",
  "new version",
  "new format",
  "electronic passport",
  "digital identity document",
];
const ID_SIGNAL_DESIGN_STRONG_KEYWORDS = [
  "redesigned passport",
  "redesigned id card",
  "updated passport design",
  "updated id card design",
];
const ID_SIGNAL_DESIGN_WEAK_KEYWORDS = [
  "new design",
  "redesign",
  "redesigned",
  "updated design",
];
const ID_SIGNAL_SECURITY_STRONG_KEYWORDS = [
  "hologram",
  "watermark",
  "security feature",
  "uv ink",
  "biometric",
];
const ID_SIGNAL_TECHNOLOGY_STRONG_KEYWORDS = [
  "chip",
  "nfc",
  "machine readable",
  "mrz",
  "digital id",
  "mobile id",
  "document verification",
  "identity verification",
  "liveness",
  "authentication",
];
const ID_SIGNAL_REGULATION_KEYWORDS = [
  "regulation",
  "law",
  "requirement",
  "compliance",
  "mandate",
  "policy",
  "directive",
  "new rules",
  "document requirements",
  "identity verification rules",
];
const ID_SIGNAL_HIGH_INTENT_KEYWORDS = [
  "issued",
  "released",
  "launched",
  "introduced",
  "rolled out",
  "rollout",
  "unveiled",
  "deployed",
  "implemented",
  "now in use",
  "suspended",
  "blocked",
  "approved",
  "rejected",
  "passed",
  "adopted",
  "law",
  "regulation",
  "mandate",
  "requirement",
  "policy change",
  "directive",
  "compliance rule",
  "enforced",
  "biometric system",
  "passport system",
  "id system",
  "identity verification system",
  "border checks",
  "biometric checks",
  "chip-enabled",
  "nfc passport",
  "digital id system launched",
  "identity verification system deployed",
  "data breach",
  "passport data",
  "identity data",
  "document fraud network",
];
const ID_SIGNAL_WEAK_INTENT_KEYWORDS = [
  "how to",
  "guide",
  "tips",
  "explained",
  "what you need",
  "why you need",
  "advice",
  "overview",
  "comparison",
  "step by step",
  "simple guide",
  "everything you need to know",
  "things to know",
  "faq",
  "tutorial",
  "opinion",
  "analysis only",
  "discussion",
];
const ID_SIGNAL_OVERRIDE_KEYWORDS = [
  "data breach",
  "passport data",
  "identity data",
  "document fraud network",
  "biometric system",
  "identity verification system",
  "identity verification system deployed",
  "digital id system launched",
  "border checks",
  "biometric checks",
  "law",
  "regulation",
  "mandate",
  "directive",
  "enforced",
];
const ID_SIGNAL_NOISE_KEYWORDS = [
  "film",
  "casting",
  "actor",
  "actress",
  "episode",
  "transcript",
  "celebrity",
  "music",
  "song",
  "lyrics",
  "election",
  "voting",
  "voter",
  "crime story",
  "found passport",
  "lost passport",
  "fake passport tracked",
  "travel chaos",
  "airport delays",
  "passport mistake",
  "passport renewal tips",
  "passport photo",
  "car",
  "honda passport",
];
const SIGNAL_RELEVANCE_NOISE_KEYWORDS = [
  "economy",
  "inflation",
  "interest rate",
  "central bank",
  "monetary policy",
  "gdp",
  "forex",
  "borrowing",
  "bond",
  "stock market",
  "currency rate",
  "yen",
];
const SIGNAL_NOISE_CONTEXT_KEYWORDS = [
  "central bank",
  "inflation",
  "interest rate",
  "economy",
  "finance",
  "market",
  "loan",
  "borrowing",
  "investment",
];

const state = {
  feeds: [],
  dmvCatalog: [],
  articles: [],
  dashboardMode: "normal",
  editingFeedId: "",
  feedPanelCollapsed: false,
  addSourceExpanded: false,
  analyticsScope: "all",
  analyticsQualityFilter: "all",
  tagManagerExpanded: false,
  noiseKeywordsExpanded: false,
  keywordFilters: {
    include: [],
    exclude: [],
  },
  filters: {
    search: "",
    topic: "",
    tag: "",
    signalCategory: "",
    feedId: "",
    dmvFeedId: "",
    canadaDmvFeedPath: "",
    canadaDmvAll: false,
    sourceGroup: "all",
    date: "",
    articleIds: [],
    alertLabel: "",
  },
  pagination: {
    page: 1,
    pageSize: ARTICLE_RENDER_PAGE_SIZE,
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
  activityLog: [],
  activityLogId: 0,
  previousSnapshotStats: null,
  snapshotLoaded: false,
  expandedGroupedSourceKeys: new Set(),
  fullyExpandedGroupedSourceKeys: new Set(),
  articleComputationCache: new Map(),
  articlePairComputationCache: new Map(),
  paginationContextKey: "",
  scheduledRenderFrame: 0,
  scheduledRenderTimeout: 0,
  scheduledRenderReason: "",
};

const elements = {
  notificationRegion: document.getElementById("notification-region"),
  summaryGrid: document.getElementById("summary-grid"),
  articlesGrid: document.getElementById("articles-grid"),
  articleFilterContext: document.getElementById("article-filter-context"),
  paginationControls: document.getElementById("pagination-controls"),
  paginationRange: document.getElementById("pagination-range"),
  paginationStatus: document.getElementById("pagination-status"),
  paginationPrev: document.getElementById("pagination-prev"),
  paginationNext: document.getElementById("pagination-next"),
  topicFilter: document.getElementById("topic-filter"),
  tagFilter: document.getElementById("tag-filter"),
  signalFilter: document.getElementById("signal-filter"),
  tagAddInput: document.getElementById("tag-add-input"),
  tagAddButton: document.getElementById("tag-add-button"),
  tagResetButton: document.getElementById("tag-reset-button"),
  tagManagerToggle: document.getElementById("tag-manager-toggle"),
  tagManagerContent: document.getElementById("tag-manager-content"),
  tagManagerList: document.getElementById("tag-manager-list"),
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
  includeKeywordsInput: document.getElementById("include-keywords-input"),
  excludeKeywordsInput: document.getElementById("exclude-keywords-input"),
  keywordResetButton: document.getElementById("keyword-reset-button"),
  keywordToggle: document.getElementById("keyword-toggle"),
  keywordContent: document.getElementById("keyword-filter-content"),
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

function flushScheduledRender() {
  if (runtime.scheduledRenderFrame) {
    window.cancelAnimationFrame(runtime.scheduledRenderFrame);
    runtime.scheduledRenderFrame = 0;
  }

  if (runtime.scheduledRenderTimeout) {
    window.clearTimeout(runtime.scheduledRenderTimeout);
    runtime.scheduledRenderTimeout = 0;
  }

  const reason = runtime.scheduledRenderReason || "scheduled";
  runtime.scheduledRenderReason = "";
  intelligenceDebug("[scheduleRenderArticles:flush]", { reason });
  renderArticles();
}

function scheduleRenderArticles(reason = "interaction", options = {}) {
  const mode = options.mode === "timeout" ? "timeout" : "frame";
  runtime.scheduledRenderReason = reason;

  if (runtime.scheduledRenderFrame) {
    window.cancelAnimationFrame(runtime.scheduledRenderFrame);
    runtime.scheduledRenderFrame = 0;
  }

  if (runtime.scheduledRenderTimeout) {
    window.clearTimeout(runtime.scheduledRenderTimeout);
    runtime.scheduledRenderTimeout = 0;
  }

  if (mode === "timeout") {
    runtime.scheduledRenderTimeout = window.setTimeout(() => {
      runtime.scheduledRenderTimeout = 0;
      flushScheduledRender();
    }, 0);
    return;
  }

  runtime.scheduledRenderFrame = window.requestAnimationFrame(() => {
    runtime.scheduledRenderFrame = 0;
    flushScheduledRender();
  });
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

function isKnownBrokenImageUrl(url) {
  const host = url.hostname.replace(/^www\./, "");
  const path = `${url.pathname} ${url.search}`.toLowerCase();
  return (
    host === "imgbb.com" ||
    host.endsWith(".imgbb.com") ||
    path.includes("image-not-found") ||
    path.includes("image_not_found") ||
    path.includes("not-found") ||
    path.includes("placeholder") ||
    path.includes("default-image")
  );
}

function normalizeArticleImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "null" || raw === "undefined" || raw.startsWith("data:")) {
    return "";
  }

  try {
    const url = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol) || isKnownBrokenImageUrl(url)) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

function isDmvWrapperFeed(feed) {
  return isDmvSource(feed);
}

function getArticleImageSrc(article) {
  const thumbnail = normalizeArticleImageUrl(article.thumbnail);
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

function getAnalyticsFeedsForScope(feeds, articleCounts) {
  const analyticsFeeds = feeds.filter(isAnalyticsFeed);
  if (state.analyticsScope === "active") {
    return analyticsFeeds.filter((feed) => feed.isActive !== false && (articleCounts.get(feed.id) || 0) > 0);
  }

  return analyticsFeeds;
}

function getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, filter = state.analyticsQualityFilter) {
  switch (filter) {
    case "high":
      return feeds.filter((feed) => (articleCounts.get(feed.id) || 0) > 0 && (qualityStats.get(feed.id)?.qualityScore || 0) >= 0.75);
    case "inactive":
      return feeds.filter((feed) => (articleCounts.get(feed.id) || 0) > 0 && (recentCounts.get(feed.id) || 0) === 0);
    case "zero":
      return feeds.filter((feed) => (articleCounts.get(feed.id) || 0) === 0);
    default:
      return feeds;
  }
}

function getAnalyticsQualityFilterCounts(feeds, articleCounts, recentCounts, qualityStats) {
  return {
    all: feeds.length,
    high: getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, "high").length,
    inactive: getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, "inactive").length,
    zero: getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, "zero").length,
  };
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

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function isArticleNoiseForFeedQuality(article, feed) {
  const feedRule = getTopicKeywordRule(feed?.topic) || getTopicKeywordRule(article?.topic);
  if (feedRule) {
    return isKeywordRuleFalsePositive(article, feedRule);
  }

  return (
    isPassportFalsePositive(article) ||
    isDriverLicenseMusicFalsePositive(article) ||
    isCoinGamingFalsePositive(article)
  );
}

function getFeedQualityExclusionReason(article, feed) {
  if (isPassportFalsePositive(article)) {
    return "carFalsePositive";
  }
  if (isDriverLicenseMusicFalsePositive(article)) {
    return "musicFalsePositive";
  }
  if (isCoinGamingFalsePositive(article)) {
    return "gamingFalsePositive";
  }

  const feedRule = getTopicKeywordRule(feed?.topic) || getTopicKeywordRule(article?.topic);
  if (feedRule && isKeywordRuleFalsePositive(article, feedRule)) {
    return "keywordNoise";
  }

  return "";
}

function articleMatchesCurrentViewFilters(article) {
  if (state.filters.tag && !getArticleFilterTags(article).includes(normalizeFilterTag(state.filters.tag))) {
    return false;
  }

  if (state.filters.signalCategory && !getArticleSignalCategories(article).includes(state.filters.signalCategory)) {
    return false;
  }

  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (state.filters.date && toDateInputValue(article.pubDate) !== state.filters.date) {
    return false;
  }

  if (state.filters.search && !getArticleSearchText(article).includes(state.filters.search.toLowerCase())) {
    return false;
  }

  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];
  if (exactArticleIds.length && !exactArticleIds.includes(article.id)) {
    return false;
  }

  const activeFeedId = getActiveArticleFeedId();
  if (activeFeedId && article.feedId !== activeFeedId) {
    return false;
  }

  return true;
}

function getFeedQualityStats(feeds, articles) {
  const stats = new Map(
    feeds
      .filter(isAnalyticsFeed)
      .map((feed) => [
        feed.id,
        {
          feed,
          totalArticles: 0,
          totalFetched: 0,
          relevantArticles: 0,
          shownArticles: 0,
          filteredArticles: 0,
          filteredOut: 0,
          filterReasons: {
            keywordNoise: 0,
            carFalsePositive: 0,
            musicFalsePositive: 0,
            gamingFalsePositive: 0,
          },
          relevanceRatio: 0,
          normalizedActivity: 0,
          viewMatchedArticles: 0,
          viewMatchScore: 0,
          qualityScore: 0,
          qualityTone: "low",
        },
      ])
  );

  articles.forEach((article) => {
    const feedStats = stats.get(article.feedId);
    if (!feedStats) {
      return;
    }

    feedStats.totalArticles += 1;
    feedStats.totalFetched += 1;
    const exclusionReason = getFeedQualityExclusionReason(article, feedStats.feed);
    if (exclusionReason) {
      feedStats.filteredArticles += 1;
      feedStats.filteredOut += 1;
      feedStats.filterReasons[exclusionReason] = (feedStats.filterReasons[exclusionReason] || 0) + 1;
    } else {
      feedStats.relevantArticles += 1;
      feedStats.shownArticles += 1;
      if (articleMatchesCurrentViewFilters(article)) {
        feedStats.viewMatchedArticles += 1;
      }
    }
  });

  const maxArticles = Math.max(1, ...Array.from(stats.values()).map((item) => item.totalArticles));

  stats.forEach((feedStats) => {
    feedStats.relevanceRatio = feedStats.totalFetched
      ? feedStats.shownArticles / feedStats.totalFetched
      : 0;
    feedStats.normalizedActivity = clampNumber(feedStats.totalArticles / maxArticles, 0, 1);
    feedStats.qualityScore = feedStats.relevanceRatio;
    feedStats.viewMatchScore = feedStats.shownArticles
      ? feedStats.viewMatchedArticles / feedStats.shownArticles
      : 0;
    feedStats.filteredRatio = feedStats.totalFetched ? feedStats.filteredOut / feedStats.totalFetched : 0;
    feedStats.dominantNoiseCount = Math.max(
      feedStats.filterReasons.carFalsePositive || 0,
      feedStats.filterReasons.musicFalsePositive || 0,
      feedStats.filterReasons.gamingFalsePositive || 0
    );
    feedStats.isNoisyFeed =
      feedStats.filteredRatio > 0.15 ||
      (feedStats.totalFetched > 0 && feedStats.dominantNoiseCount / feedStats.totalFetched > 0.15);
    feedStats.qualityTone =
      feedStats.qualityScore >= 0.75 ? "high" : feedStats.qualityScore >= 0.4 ? "medium" : "low";
  });

  return stats;
}

function getCombinedFeedRankings(feeds, totalCounts, todayCounts, recentCounts, qualityStats, limit = 50) {
  return feeds
    .filter(isAnalyticsFeed)
    .map((feed) => {
      const feedId = feed.id;
      const quality = qualityStats.get(feedId) || {};
      return {
        feedId,
        total: totalCounts.get(feedId) || 0,
        today: todayCounts.get(feedId) || 0,
        recent: recentCounts.get(feedId) || 0,
        name: feed.name || getFeedName(feedId),
        topic: feed.topic || getFeedTopic(feedId),
        isActive: feed.isActive !== false,
        isInactive: feed.isInactive === true || feed.isActive === false,
        totalFetched: quality.totalFetched || 0,
        shownArticles: quality.shownArticles || 0,
        filteredOut: quality.filteredOut || 0,
        filteredRatio: quality.filteredRatio || 0,
        dominantNoiseCount: quality.dominantNoiseCount || 0,
        isNoisyFeed: quality.isNoisyFeed === true,
        filterReasons: quality.filterReasons || {},
        relevantArticles: quality.relevantArticles || 0,
        filteredArticles: quality.filteredArticles || 0,
        relevanceRatio: quality.relevanceRatio || 0,
        normalizedActivity: quality.normalizedActivity || 0,
        viewMatchedArticles: quality.viewMatchedArticles || 0,
        viewMatchScore: quality.viewMatchScore || 0,
        qualityScore: quality.qualityScore || 0,
        qualityTone: quality.qualityTone || "low",
      };
    })
    .sort(
      (left, right) =>
        right.qualityScore - left.qualityScore ||
        right.normalizedActivity - left.normalizedActivity ||
        right.today - left.today ||
        right.recent - left.recent ||
        right.total - left.total ||
        left.name.localeCompare(right.name)
    )
    .slice(0, limit);
}

function getFeedInsightRows(feeds, totalCounts, todayCounts, recentCounts, qualityStats) {
  return getCombinedFeedRankings(feeds, totalCounts, todayCounts, recentCounts, qualityStats, 100);
}

function getNewlyActiveFeedInsights(rows, excludedFeedIds = new Set(), limit = 5) {
  return rows
    .filter((row) => !excludedFeedIds.has(row.feedId) && row.today > 0)
    .sort((left, right) => right.today - left.today || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function getFeedInsights(rows) {
  const getReviewSignal = (row) => {
    const filteredPercent = Math.round((row.filteredRatio || 0) * 100);
    const primaryReason = getPrimaryFeedQualityReason(row.filterReasons);

    if (row.isInactive) {
      return {
        label: "Inactive too long",
        priority: "high",
        reason: "No recent activity detected.",
      };
    }
    if (row.total === 0) {
      return {
        label: "Zero article feed",
        priority: "high",
        reason: "Zero articles since import.",
      };
    }
    if (row.qualityScore < 0.95) {
      return {
        label: "Review",
        priority: "medium",
        reason: `${Math.round((row.qualityScore || 0) * 100)}% clean`,
      };
    }
    if (row.filteredRatio > 0.1) {
      return {
        label: "Noisy",
        priority: "medium",
        reason: primaryReason ? `${filteredPercent}% filtered, mostly ${primaryReason}` : `${filteredPercent}% filtered`,
      };
    }
    if (row.filteredRatio > 0.03) {
      return {
        label: "Noisy",
        priority: "low",
        reason: primaryReason ? `${filteredPercent}% filtered, mostly ${primaryReason}` : "minor noise detected",
      };
    }
    if (row.isActive && row.total > 0 && row.total < 5) {
      return {
        label: "Low value",
        priority: "low",
        reason: "Low useful output so far.",
      };
    }
    return null;
  };

  const getReviewPriorityRank = (priority) => {
    if (priority === "high") {
      return 0;
    }
    if (priority === "medium") {
      return 1;
    }
    return 2;
  };

  const getAttentionReason = (row) => {
    return getReviewSignal(row)?.label || "";
  };
  const needsAttention = rows
    .map((row) => ({ ...row, attentionReason: getAttentionReason(row) }))
    .filter((row) => row.attentionReason)
    .sort((left, right) => {
      const priority = (row) =>
        row.isInactive ? 0 : row.total === 0 ? 1 : row.qualityScore < 0.9 ? 2 : 3;
      return priority(left) - priority(right) || right.qualityScore - left.qualityScore || left.name.localeCompare(right.name);
    })
    .slice(0, 5);
  const reviewCandidates = rows
    .map((row) => {
      const reviewSignal = getReviewSignal(row);
      return reviewSignal
        ? {
            ...row,
            reviewLabel: reviewSignal.label,
            reviewPriority: reviewSignal.priority,
            reviewReason: reviewSignal.reason,
          }
        : null;
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        getReviewPriorityRank(left.reviewPriority) - getReviewPriorityRank(right.reviewPriority) ||
        right.filteredRatio - left.filteredRatio ||
        left.name.localeCompare(right.name)
    )
    .slice(0, 5);
  const needsAttentionIds = new Set(needsAttention.map((row) => row.feedId));
  const isBestPerformer = (row) => row.qualityScore >= 0.98 && row.today > 0 && row.total >= 20;
  const bestPerformers = rows
    .filter((row) => !needsAttentionIds.has(row.feedId) && isBestPerformer(row))
    .sort((left, right) => right.qualityScore - left.qualityScore || right.today - left.today || left.name.localeCompare(right.name))
    .slice(0, 5);
  const bestPerformerIds = new Set(bestPerformers.map((row) => row.feedId));
  const goodFeeds = rows
    .filter(
      (row) =>
        !needsAttentionIds.has(row.feedId) &&
        !bestPerformerIds.has(row.feedId) &&
        row.qualityScore >= 0.9 &&
        row.today === 0 &&
        !row.isInactive
    )
    .sort((left, right) => right.total - left.total || right.qualityScore - left.qualityScore || left.name.localeCompare(right.name))
    .slice(0, 5);

  return {
    bestPerformers,
    goodFeeds,
    needsAttention,
    reviewCandidates,
    newlyActive: getNewlyActiveFeedInsights(rows, new Set(bestPerformers.map((row) => row.feedId))),
  };
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

function formatFeedQualityReasons(reasons = {}) {
  const labels = {
    keywordNoise: "keyword noise",
    carFalsePositive: "car-related",
    musicFalsePositive: "music-related",
    gamingFalsePositive: "gaming-related",
  };
  const parts = Object.entries(labels)
    .map(([key, label]) => [label, reasons[key] || 0])
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}`);

  return parts.length ? parts.join(", ") : "no filtered articles";
}

function getPrimaryFeedQualityReason(reasons = {}) {
  const entries = Object.entries(reasons).filter(([, count]) => count > 0);
  if (!entries.length) {
    return "";
  }
  const [reasonKey, count] = entries.sort((left, right) => right[1] - left[1])[0];
  const labels = {
    keywordNoise: "keyword noise",
    carFalsePositive: "car false positives",
    musicFalsePositive: "music false positives",
    gamingFalsePositive: "gaming false positives",
  };
  return `${count} ${labels[reasonKey] || "filtered"}`;
}

function getFeedInsightLabel(item, section) {
  const qualityPercent = Math.round((item.qualityScore || 0) * 100);
  if (section === "best") {
    return `Best - ${qualityPercent}% clean`;
  }
  if (section === "good") {
    return `Quiet - ${qualityPercent}% clean`;
  }
  if (section === "new") {
    return `+${item.today} today`;
  }
  if (section === "attention" && item.attentionReason) {
    return item.attentionReason;
  }
  if (section === "review" && item.reviewLabel) {
    return item.reviewLabel;
  }
  if (item.total === 0) {
    return "Low volume";
  }
  if (item.recent === 0) {
    return "No recent activity";
  }
  if (item.qualityScore >= 0.4 && item.qualityScore < 0.75) {
    return `Review - ${qualityPercent}% clean`;
  }
  if (item.qualityScore >= 0.75 && !item.filteredOut) {
    return "Low activity";
  }
  if (item.qualityScore < 0.4) {
    return `Low quality · ${qualityPercent}% clean`;
  }
  return `${item.filteredOut} filtered · review`;
}

function renderFeedInsightList(items, section, emptyText) {
  if (!items.length) {
    return `<p class="analytics-empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ol class="analytics-list analytics-insight-list">
      ${items
        .map((item) => {
          const feedId = String(item.feedId || "");
          const clickableAttrs = feedId
            ? `class="analytics-clickable" data-analytics-feed-id="${escapeHtml(feedId)}" role="button" tabindex="0" title="Click to filter this feed"`
            : "";
          const todayClickableAttrs = feedId
            ? `class="analytics-clickable" data-analytics-feed-id="${escapeHtml(feedId)}" data-analytics-today-only="true" role="button" tabindex="0" title="Click to filter this feed from today"`
            : "";
          const qualityPercent = Math.round((item.qualityScore || 0) * 100);
          const filteredPercent = Math.max(0, 100 - qualityPercent);
          const qualityBreakdown = `${item.totalFetched} fetched, ${item.shownArticles} shown, ${item.filteredOut} filtered. Reasons: ${formatFeedQualityReasons(item.filterReasons)}`;
          const label = getFeedInsightLabel(item, section);
          return `
            <li>
              <span ${clickableAttrs}>
                ${escapeHtml(item.name)}
                <small class="analytics-row-detail">${escapeHtml(label)}</small>
                ${
                  item.filteredOut
                    ? `<small class="analytics-row-detail">${escapeHtml(getPrimaryFeedQualityReason(item.filterReasons))}</small>`
                    : ""
                }
                ${item.isNoisyFeed ? `<small class="analytics-row-detail is-warning">Noisy feed</small>` : ""}
                ${section === "review" && item.reviewReason ? `<small class="analytics-row-detail">${escapeHtml(item.reviewReason)}</small>` : ""}
              </span>
              <div class="analytics-count-pair">
                ${
                  section === "review" && item.reviewPriority
                    ? `<strong class="analytics-review-priority is-${escapeHtml(item.reviewPriority)}">${escapeHtml(item.reviewPriority)}</strong>`
                    : ""
                }
                <strong class="analytics-quality is-${item.qualityTone}" title="${escapeHtml(qualityBreakdown)}">
                  ${qualityPercent}% clean
                </strong>
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

function renderFeedInsights(insights) {
  const sections = [
    ["Best performers", "best", insights.bestPerformers, renderFeedInsightList(insights.bestPerformers, "best", "")],
    [
      "Good feeds",
      "good",
      insights.goodFeeds,
      renderFeedInsightList(insights.goodFeeds, "good", "All high-quality feeds are currently active"),
    ],
    ["Needs attention", "attention", insights.needsAttention, renderFeedInsightList(insights.needsAttention, "attention", "")],
    [
      "Review candidates",
      "review",
      insights.reviewCandidates,
      renderFeedInsightList(insights.reviewCandidates, "review", "No feeds need review right now"),
    ],
  ].filter(([, sectionKey, sectionItems, content]) => {
    return (sectionKey === "good" || sectionKey === "review" || sectionItems.length > 0) && content;
  });

  if (!sections.length) {
    return `<p class="analytics-empty">No feed insights available for this scope.</p>`;
  }

  return `
    <div class="feed-insights-grid">
      ${sections
        .map(
          ([title, sectionKey, , content]) => `
            <section class="feed-insight-section is-${sectionKey}">
              <span class="feed-insight-title">${title}</span>
              ${content}
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAnalyticsQualityTabs(activeFilter, counts = {}) {
  const tabs = [
    ["all", "All"],
    ["high", "High quality"],
    ["inactive", "Inactive"],
    ["zero", "Zero articles"],
  ];

  return `
    <div class="analytics-quality-tabs" aria-label="Feed ranking quick filters">
      ${tabs
        .map(([value, label]) => {
          const isActive = activeFilter === value;
          return `
            <button class="${isActive ? "is-active" : ""}" type="button" data-analytics-quality-filter="${value}" aria-pressed="${isActive}">
              <span>${label}</span>
              <strong>${counts[value] || 0}</strong>
            </button>
          `;
        })
        .join("")}
    </div>
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
  contextLine = "",
  totalLine = "",
  type = "info",
  topic = "",
  todayOnly = false,
  articleIds = [],
  priorityLevel = "low",
  isDmvAlert = false,
  isSystemMessage = false,
  delta = 0,
  baselineAverage = 0,
  interpretation = "",
}) {
  const exactArticleIds = Array.from(new Set((articleIds || []).filter(Boolean))).sort();
  if (isSystemMessage) {
    runtime.dashboardAlerts = runtime.dashboardAlerts.filter(
      (alert) => !(alert.isSystemMessage && alert.title === title && alert.detail === detail)
    );
  }
  runtime.dashboardAlertId += 1;
  runtime.dashboardAlerts.unshift({
    id: String(runtime.dashboardAlertId),
    title,
    detail,
    contextLine,
    totalLine,
    type,
    topic,
    todayOnly,
    articleIds: exactArticleIds,
    priorityLevel,
    isDmvAlert,
    isSystemMessage,
    delta,
    baselineAverage,
    interpretation,
    createdAt: new Date(),
  });
  runtime.dashboardAlerts = runtime.dashboardAlerts.slice(0, DASHBOARD_ALERT_LIMIT);
}

function dismissDashboardAlert(alertId) {
  runtime.dashboardAlerts = runtime.dashboardAlerts.filter((alert) => alert.id !== alertId);
  renderSummary();
}

function renderActivityLog() {
  const activityItems = runtime.activityLog;
  if (!activityItems.length) {
    return `<p class="analytics-empty">No recent activity yet.</p>`;
  }

  return `
    <div class="activity-log-actions">
      <button type="button" data-clear-activity-log="true">Clear activity</button>
    </div>
    <ol class="dashboard-alert-list activity-log-list">
      ${activityItems
        .map((item) => {
          const isClickable =
            (Array.isArray(item.articleIds) && item.articleIds.length > 0) || Boolean(item.feedId);
          const relativeTime = formatRelativeTime(item.createdAt);
          return `
            <li
              class="dashboard-alert activity-log-item is-${item.tone || "info"} priority-${item.priorityLevel || "low"}${isClickable ? " analytics-clickable" : ""}"
              ${isClickable ? `data-activity-id="${escapeHtml(item.id)}" role="button" tabindex="0" title="Click to view related items"` : ""}
            >
              <div>
                <strong>
                  <span class="dashboard-alert-priority is-${escapeHtml(item.priorityLevel || "low")}">${escapeHtml(item.priorityLevel || "low")}</span>
                  ${escapeHtml(item.title)}
                </strong>
                ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}
                ${item.recommendation ? `<small class="activity-log-recommendation">Next: ${escapeHtml(item.recommendation)}</small>` : ""}
                ${relativeTime ? `<small class="activity-log-meta">${escapeHtml(relativeTime)}</small>` : ""}
              </div>
              <button type="button" data-dismiss-activity-item="${item.id}" aria-label="Dismiss activity item">Dismiss</button>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderDashboardAlerts() {
  const meaningfulAlerts = runtime.dashboardAlerts.filter((alert) => !alert.isSystemMessage);
  const latestSystemMessage = runtime.dashboardAlerts.find((alert) => alert.isSystemMessage);
  const systemMessage = !meaningfulAlerts.length && latestSystemMessage
    ? `<p class="analytics-empty">System: ${escapeHtml(latestSystemMessage.title)}</p>`
    : "";

  if (!meaningfulAlerts.length) {
    return systemMessage || `<p class="analytics-empty">No recent feed alerts this session.</p>`;
  }

  return `
    ${systemMessage}
    <ol class="dashboard-alert-list">
      ${meaningfulAlerts
        .map((alert) => {
          const isClickable = Array.isArray(alert.articleIds) && alert.articleIds.length > 0;
          return `
            <li
              class="dashboard-alert is-${alert.type} priority-${alert.priorityLevel || "low"}${isClickable ? " analytics-clickable" : ""}"
              ${isClickable ? `data-alert-id="${escapeHtml(alert.id)}" role="button" tabindex="0" title="Click to view exact matching articles"` : ""}
            >
              <div>
                <strong>
                  <span class="dashboard-alert-priority is-${escapeHtml(alert.priorityLevel || "low")}">${escapeHtml(getAlertPriorityLabel(alert.priorityLevel || "low"))}</span>
                  ${escapeHtml(alert.title)}
                </strong>
                ${alert.contextLine ? `<small>${escapeHtml(alert.contextLine)}</small>` : alert.detail ? `<small>${escapeHtml(alert.detail)}</small>` : ""}
                ${alert.totalLine ? `<small>${escapeHtml(alert.totalLine)}</small>` : ""}
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
  const hasFeedStats = snapshot.hasFeedStats === true;
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

function pruneActivityLogEntries(entries, now = Date.now()) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      const createdAt = Number(new Date(entry?.createdAt).getTime());
      return entry?.key && Number.isFinite(createdAt) && now - createdAt <= ACTIVITY_LOG_TTL_MS;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, ACTIVITY_LOG_LIMIT);
}

function loadStoredActivityLog() {
  try {
    return pruneActivityLogEntries(JSON.parse(window.localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function saveActivityLog(entries) {
  const nextEntries = pruneActivityLogEntries(entries);
  runtime.activityLog = nextEntries;
  try {
    window.localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(nextEntries));
  } catch {
    // Activity history is a convenience layer; the dashboard still works without storage access.
  }
}

function buildActivityRecommendation(activity) {
  const title = String(activity?.title || "").toLowerCase();
  const detail = String(activity?.detail || "").toLowerCase();

  if (title.includes("initial load")) {
    return "Review source history; likely backfill";
  }
  if (title.includes("active again") || title.includes("started producing")) {
    return "Check new articles";
  }
  if (title.includes("noisy") || detail.includes("filtered")) {
    return "Consider adding exclusion keywords";
  }
  if (activity?.priorityLevel === "high" && title.includes("article")) {
    return "Review latest articles";
  }
  if ((activity?.tone || activity?.type) === "error") {
    return "Check feed health and recent source changes";
  }
  return "";
}

function buildActivityKey(activity) {
  const articleIds = Array.isArray(activity?.articleIds) ? activity.articleIds.join(",") : "";
  return [
    activity?.type || "status",
    activity?.title || "",
    activity?.detail || "",
    activity?.feedId || "",
    activity?.priorityLevel || "low",
    articleIds,
  ]
    .join("|")
    .toLowerCase();
}

function createActivityEntry(activity) {
  runtime.activityLogId += 1;
  const articleIds = Array.from(new Set((activity.articleIds || []).filter(Boolean))).sort();
  const priority = activity.priority || activity.priorityLevel || "low";
  const createdAt = activity.createdAt || new Date().toISOString();
  return {
    id: String(runtime.activityLogId),
    key: activity.key || buildActivityKey(activity),
    title: activity.title || "",
    detail: activity.detail || "",
    recommendation: activity.recommendation || buildActivityRecommendation(activity),
    priority,
    priorityLevel: priority,
    type: activity.type || "status",
    tone: activity.tone || activity.visualTone || "info",
    topic: activity.topic || "",
    todayOnly: Boolean(activity.todayOnly),
    articleIds,
    feedId: activity.feedId || "",
    timestamp: createdAt,
    createdAt,
  };
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function persistActivityEntries(entries) {
  const nextEntries = (Array.isArray(entries) ? entries : []).map(createActivityEntry);
  if (!nextEntries.length) {
    saveActivityLog(runtime.activityLog);
    return;
  }

  const existing = loadStoredActivityLog();
  const seenKeys = new Set(existing.map((entry) => entry.key));
  const merged = [...existing];

  nextEntries.forEach((entry) => {
    if (seenKeys.has(entry.key)) {
      return;
    }
    merged.unshift(entry);
    seenKeys.add(entry.key);
  });

  saveActivityLog(merged);
}

function dismissActivityItem(activityId) {
  saveActivityLog(runtime.activityLog.filter((item) => item.id !== activityId));
  renderSummary();
}

function clearActivityLog() {
  saveActivityLog([]);
  renderSummary();
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

function getAlertPriorityRank(priorityLevel) {
  if (priorityLevel === "high") {
    return 1;
  }
  if (priorityLevel === "medium") {
    return 2;
  }
  return 3;
}

function getAlertCandidateRank(candidate) {
  const dmvBoost = candidate.isDmvAlert ? 0.5 : 0;
  const summaryPenalty = candidate.dedupeScope === "global-new-articles" ? 1 : 0;
  return getAlertPriorityRank(candidate.alert.priorityLevel) + summaryPenalty - dmvBoost;
}

function getVolumeAlertPriority(delta) {
  if (delta > 25) {
    return "high";
  }
  if (delta > 5) {
    return "medium";
  }
  return "low";
}

function getAlertPriorityLabel(priorityLevel) {
  if (priorityLevel === "high") {
    return "Spike";
  }
  if (priorityLevel === "medium") {
    return "Elevated";
  }
  return "Normal";
}

function getFeedBaselineAverage(stats) {
  const recent = Number(stats?.recent) || 0;
  if (recent <= 0) {
    return 0;
  }
  return recent / 30;
}

function formatBaselineAverage(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}/day`;
}

function getAlertInterpretation(delta, baselineAverage, priorityLevel, isInitialLoadSpike = false) {
  if (isInitialLoadSpike) {
    return "Initial load spike detected";
  }
  if (!Number.isFinite(delta) || delta <= 0) {
    return "Normal activity";
  }
  if (priorityLevel === "high" || (baselineAverage > 0 && delta >= baselineAverage * 3)) {
    return "Spike detected";
  }
  if (baselineAverage > 0 && delta > baselineAverage) {
    return "Above normal activity";
  }
  return "Normal activity";
}

function getAlertArticleIdKey(alert) {
  const articleIds = Array.isArray(alert.articleIds) ? alert.articleIds : [];
  return articleIds.slice().sort().join("|");
}

function alertArticleIdsOverlap(leftAlert, rightAlert) {
  const leftIds = Array.isArray(leftAlert.articleIds) ? leftAlert.articleIds : [];
  const rightIds = new Set(Array.isArray(rightAlert.articleIds) ? rightAlert.articleIds : []);
  return leftIds.some((articleId) => rightIds.has(articleId));
}

function dedupeAlertCandidates(candidates) {
  const selected = [];

  candidates
    .slice()
    .sort((left, right) => getAlertCandidateRank(left) - getAlertCandidateRank(right) || right.score - left.score)
    .forEach((candidate) => {
      const articleIdKey = getAlertArticleIdKey(candidate.alert);
      if (articleIdKey && selected.some((item) => getAlertArticleIdKey(item.alert) === articleIdKey)) {
        return;
      }

      if (
        candidate.dedupeScope === "global-new-articles" &&
        selected.some((item) => getAlertArticleIdKey(item.alert) && alertArticleIdsOverlap(item.alert, candidate.alert))
      ) {
        return;
      }

      selected.push(candidate);
    });

  return selected;
}

function getSnapshotFeedStats(snapshot, feedId) {
  const snapshotArticles = Array.isArray(snapshot?.articles) ? snapshot.articles : [];
  const articlesHaveFeedIds = snapshotArticles.some((article) => article.feedId);
  if (articlesHaveFeedIds) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const feedArticles = snapshotArticles.filter((article) => article.feedId === feedId);
    return {
      total: feedArticles.length,
      today: feedArticles.filter((article) => toDate(article.pubDate) >= todayStart).length,
      source: "articles",
    };
  }

  if (snapshot?.hasFeedStats === true && snapshot?.feedStats?.[feedId]) {
    return {
      total: Number(snapshot.feedStats[feedId].total) || 0,
      today: Number(snapshot.feedStats[feedId].today) || 0,
      source: "feedStats",
    };
  }

  const activityStats = snapshot?.feedActivity?.get?.(feedId);
  if (activityStats) {
    return {
      total: Number(activityStats.total) || 0,
      today: 0,
      source: "feedActivity",
    };
  }

  return null;
}

function generateAlerts(previous, current) {
  intelligenceLog("[alerts][snapshot-compare]", { previous, current });
  const candidates = [];
  const feedDiffs = [];
  const queueAlert = (priorityLevel, alert, score = 0, options = {}) => {
    const articleIds = Array.from(new Set((alert.articleIds || []).filter(Boolean))).sort();
    const isDmvAlert = Boolean(options.isDmvAlert);
    const isSystemMessage = Boolean(options.isSystemMessage);
    candidates.push({
      score,
      dedupeScope: options.dedupeScope || "",
      isDmvAlert,
      alert: {
        ...alert,
        articleIds,
        priorityLevel,
        isDmvAlert,
        isSystemMessage,
      },
    });
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
    const globalPriority = getVolumeAlertPriority(newArticleCount);
    queueAlert(globalPriority, {
      title: `All feeds: +${newArticleCount} article${newArticleCount === 1 ? "" : "s"}`,
      contextLine: `${getAlertInterpretation(newArticleCount, 0, globalPriority)} since the previous snapshot.`,
      totalLine: `${current.totalArticles} total articles`,
      detail: "Total article count increased since the previous snapshot.",
      type: "info",
      articleIds: newArticleIds,
      delta: newArticleCount,
      baselineAverage: 0,
      interpretation: getAlertInterpretation(newArticleCount, 0, globalPriority),
    }, newArticleCount, { dedupeScope: "global-new-articles" });
  }

  const previousFeedsById = new Map((previous.feeds || []).map((feed) => [feed.id, feed]));

  (current.feeds || []).forEach((feed) => {
    const previousFeed = previousFeedsById.get(feed.id);
    const previousStats = getSnapshotFeedStats(previous, feed.id);
    const currentStats = getSnapshotFeedStats(current, feed.id);
    if (!previousFeed || !currentStats) {
      return;
    }

    const previousTotal = previousStats ? Number(previousStats.total) || 0 : null;
    const currentTotal = Number(currentStats.total) || 0;
    const totalDiff = previousTotal === null ? 0 : currentTotal - previousTotal;
    const previousToday = previousStats ? Number(previousStats.today) || 0 : null;
    const currentToday = Number(currentStats.today) || 0;
    const todayDiff = previousToday === null ? 0 : currentToday - previousToday;
    const enteredError = previousFeed.lastStatus !== "error" && feed.lastStatus === "error";
    const alertScore = currentToday * 3 + currentTotal * 0.1;
    const canCompareFeedStats = previousTotal !== null;
    const isInitialLoadSpike = canCompareFeedStats && previousTotal < 100 && totalDiff > 100;
    const feedNewArticleIds = newArticleIdsByFeed.get(feed.id) || [];
    const liveFeed = current.feedsById?.get(feed.id) || feed;
    const isDmvFeed = isDmvSource(liveFeed);
    const totalDiffPriority = getVolumeAlertPriority(totalDiff);
    const todayDiffPriority = getVolumeAlertPriority(todayDiff);
    const statusAlertPriority = "medium";
    const baselineAverage = getFeedBaselineAverage(current.feedActivity.get(feed.id));
    const baselineLabel = formatBaselineAverage(baselineAverage);
    const totalInterpretation = getAlertInterpretation(totalDiff, baselineAverage, totalDiffPriority, isInitialLoadSpike);
    const todayInterpretation = getAlertInterpretation(todayDiff, baselineAverage, todayDiffPriority, false);
    const totalContextLine = baselineLabel
      ? `${totalInterpretation} (avg: ${baselineLabel})`
      : totalInterpretation;
    const todayContextLine = baselineLabel
      ? `${todayInterpretation} (avg: ${baselineLabel})`
      : todayInterpretation;
    const totalLine = `${currentTotal} total article${currentTotal === 1 ? "" : "s"}`;
    const todayTotalLine = `${currentToday} article${currentToday === 1 ? "" : "s"} today`;

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
        previousSource: previousStats?.source || "",
        currentSource: currentStats?.source || "",
        score: alertScore,
        previousStatus: previousFeed.lastStatus,
        currentStatus: feed.lastStatus,
      });
    }

    if (enteredError) {
      queueAlert("high", {
        title: `${feed.name} entered error state`,
        detail: "The feed reported an error in the latest snapshot.",
        type: "error",
        topic: feed.topic || "",
        todayOnly: false,
      }, alertScore, { isDmvAlert: isDmvFeed });
    }

    if (canCompareFeedStats && previousTotal === 0 && currentTotal > 0 && totalDiff > 0) {
      queueAlert(statusAlertPriority, {
        title: `${feed.name}: +${totalDiff} article${totalDiff === 1 ? "" : "s"}`,
        contextLine: baselineLabel
          ? `${totalContextLine}; started producing articles`
          : "Started producing articles",
        totalLine,
        detail: `${totalDiff} new article${totalDiff === 1 ? "" : "s"} since the previous snapshot.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: false,
        articleIds: feedNewArticleIds,
        delta: totalDiff,
        baselineAverage,
        interpretation: totalInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    } else if (canCompareFeedStats && totalDiff > 0) {
      queueAlert(totalDiffPriority, {
        title: `${feed.name}: +${totalDiff} article${totalDiff === 1 ? "" : "s"}${isInitialLoadSpike ? " (initial load)" : ""}`,
        contextLine: totalContextLine,
        totalLine,
        detail: `${currentTotal} total article${currentTotal === 1 ? "" : "s"} for this feed.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: false,
        articleIds: feedNewArticleIds,
        delta: totalDiff,
        baselineAverage,
        interpretation: totalInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    }

    if (canCompareFeedStats && previousToday === 0 && currentToday > 0 && todayDiff > 0) {
      queueAlert(statusAlertPriority, {
        title: `${feed.name}: +${todayDiff} article${todayDiff === 1 ? "" : "s"}`,
        contextLine: baselineLabel
          ? `${todayContextLine}; active again today`
          : "Active again today",
        totalLine: todayTotalLine,
        detail: `+${todayDiff} new article${todayDiff === 1 ? "" : "s"} today.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: true,
        articleIds: feedNewArticleIds,
        delta: todayDiff,
        baselineAverage,
        interpretation: todayInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    } else if (canCompareFeedStats && todayDiff > 0) {
      queueAlert(todayDiffPriority, {
        title: `${feed.name}: +${todayDiff} article${todayDiff === 1 ? "" : "s"}`,
        contextLine: todayContextLine,
        totalLine: todayTotalLine,
        detail: `${currentToday} article${currentToday === 1 ? "" : "s"} today.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: true,
        articleIds: feedNewArticleIds,
        delta: todayDiff,
        baselineAverage,
        interpretation: todayInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    } else if (canCompareFeedStats && previousToday > 0 && currentToday === 0) {
      queueAlert("medium", {
        title: `${feed.name} stopped producing`,
        detail: "No articles today in the latest snapshot.",
        type: "warning",
        topic: feed.topic || "",
        todayOnly: true,
      }, alertScore, { isDmvAlert: isDmvFeed });
    }
  });

  intelligenceLog("ALERT DIFF", {
    totalDiff: newArticleCount,
    feedDiffs,
  });

  current.feedActivity.forEach((stats, feedId) => {
    const previousStats = previous.feedActivity.get(feedId);
    if (!previousStats) {
      return;
    }

    const feedName = stats.feed.name || "Untitled feed";
    const liveFeed = current.feedsById?.get(feedId) || stats.feed;
    const isDmvFeed = isDmvSource(liveFeed);
    const isDmvRssFeed = isDmvFeed && liveFeed.dmvMode === "rss";
    const wasDmvRssFeed = previousStats.isDmvRssFeed || (isDmvSource(previousStats.feed) && previousStats.feed.dmvMode === "rss");

    if (stats.status === "dead" && previousStats.status !== "dead") {
      queueAlert("high", {
        title: `${feedName} is now dead`,
        detail: "No imported articles are available for this feed.",
        type: "error",
        topic: stats.feed.topic || "",
        todayOnly: false,
      }, 0, { isDmvAlert: isDmvFeed });
    } else if (stats.status === "inactive" && previousStats.status !== "inactive") {
      queueAlert("medium", {
        title: `${feedName} is now inactive`,
        detail: "No articles in the last 30 days.",
        type: "warning",
        topic: stats.feed.topic || "",
        todayOnly: false,
      }, 0, { isDmvAlert: isDmvFeed });
    }

    if ((isDmvRssFeed || wasDmvRssFeed) && stats.status === "inactive" && previousStats.status !== "inactive") {
      queueAlert("medium", {
        title: `${feedName} DMV activity stopped`,
        detail: "No DMV RSS articles in the last 30 days.",
        type: "warning",
        topic: stats.feed.topic || "",
        todayOnly: false,
      }, 0, { isDmvAlert: true });
    }
  });

  if (!candidates.length) {
    queueAlert("low", {
      title: "Sources refreshed — no significant changes detected",
      detail: "Article counts and feed status are unchanged since the previous snapshot.",
      type: "info",
    }, 0, { dedupeScope: "system-no-change", isSystemMessage: true });
  }

  const selectedAlerts = [];
  dedupeAlertCandidates(candidates)
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
  if (!SHOW_RECENT_ALERTS && !SHOW_ACTIVITY_LOG) {
    runtime.dashboardAlerts = [];
    runtime.previousSnapshotStats = createSnapshotStats(feeds, articles);
    saveAlertSnapshot(runtime.previousSnapshotStats);
    return;
  }

  const previous = loadStoredAlertSnapshot();
  const current = createSnapshotStats(feeds, articles);

  generateAlerts(previous, current);
  runtime.previousSnapshotStats = current;
  saveAlertSnapshot(current);
}

function buildReviewActivityEntries() {
  const reviewCandidates = getDashboardAnalytics().feedInsights.reviewCandidates || [];

  return reviewCandidates.map((item) => ({
    key: `review|${item.feedId}|${item.reviewLabel}|${item.reviewPriority}|${item.reviewReason}`.toLowerCase(),
    title: `${item.name} — ${item.reviewLabel}`,
    detail: item.reviewReason || "",
    recommendation:
      item.reviewLabel === "Noisy" ? "Consider adding exclusion keywords" : "Review feed quality and recent output",
    priorityLevel: item.reviewPriority || "low",
    type: "recommendation",
    tone: item.reviewPriority === "high" ? "error" : item.reviewPriority === "medium" ? "warning" : "info",
    feedId: item.feedId,
    topic: item.topic || "",
    createdAt: new Date().toISOString(),
  }));
}

function syncActivityLog() {
  if (!SHOW_ACTIVITY_LOG) {
    runtime.activityLog = [];
    return;
  }

  const alertActivityEntries = runtime.dashboardAlerts
    .filter((alert) => !alert.isSystemMessage)
    .map((alert) => ({
      key: `alert|${getAlertDedupeKey(alert)}`,
      title: alert.title,
      detail: alert.detail,
      priorityLevel: alert.priorityLevel || "low",
      type:
        alert.title.includes("active again") || alert.title.includes("started producing")
          ? "status"
          : "alert",
      tone: alert.type || "info",
      topic: alert.topic || "",
      todayOnly: alert.todayOnly === true,
      articleIds: Array.isArray(alert.articleIds) ? alert.articleIds : [],
      createdAt: new Date().toISOString(),
    }));

  persistActivityEntries([...alertActivityEntries, ...buildReviewActivityEntries()]);
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
  const qualityStats = getFeedQualityStats(state.feeds, realArticles);
  const analyticsFeeds = state.feeds.filter(isAnalyticsFeed);
  const scopedAnalyticsFeeds = getAnalyticsFeedsForScope(state.feeds, articleCounts);
  const rankingFeeds = getAnalyticsFeedsForQualityFilter(
    scopedAnalyticsFeeds,
    articleCounts,
    recentCounts,
    qualityStats
  );
  const feedInsightRows = getFeedInsightRows(scopedAnalyticsFeeds, articleCounts, todayCounts, recentCounts, qualityStats);
  const qualityFilterCounts = getAnalyticsQualityFilterCounts(
    scopedAnalyticsFeeds,
    articleCounts,
    recentCounts,
    qualityStats
  );
  const includedFeedCount = scopedAnalyticsFeeds.length;
  const zeroArticleFeeds = scopedAnalyticsFeeds.filter((feed) => (articleCounts.get(feed.id) || 0) === 0).length;
  const highQualityFeeds = scopedAnalyticsFeeds.filter((feed) => {
    const quality = qualityStats.get(feed.id);
    return (articleCounts.get(feed.id) || 0) > 0 && (quality?.qualityScore || 0) >= 0.75;
  }).length;
  const qualityTotal = scopedAnalyticsFeeds.reduce(
    (sum, feed) => sum + (qualityStats.get(feed.id)?.qualityScore || 0),
    0
  );
  const averageQualityScore = includedFeedCount ? Math.round((qualityTotal / includedFeedCount) * 100) : 0;
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
  const feedInsights = getFeedInsights(feedInsightRows);
  const hasHighPriorityReviewSignal = feedInsights.reviewCandidates.some((feed) => feed.reviewPriority === "high");
  const systemHealthMessage =
    averageQualityScore > 95 && inactiveFeeds === 0 && deadFeeds === 0 && !hasHighPriorityReviewSignal
      ? "All feeds are performing well"
      : "";

  return {
    feedInsights,
    systemHealthMessage,
    averageArticlesPerFeed: (realArticles.length / feedCount).toFixed(1),
    averageArticlesTodayPerFeed: (todayArticles.length / feedCount).toFixed(1),
    analyticsScope: state.analyticsScope,
    analyticsQualityFilter: state.analyticsQualityFilter,
    qualityFilterCounts,
    rankingFeedCount: rankingFeeds.length,
    analyticsScopeLabel:
      state.analyticsScope === "active"
        ? "Active RSS feeds with article history"
        : "All imported RSS feeds",
    analyticsScopeNote:
      state.analyticsScope === "active"
        ? "Excludes link-only/catalog-only sources, inactive feeds, and zero-article feeds."
        : "Includes active, inactive, and zero-article imported RSS feeds; excludes link-only/catalog-only sources.",
    totalAnalyticsFeeds: analyticsFeeds.length,
    includedFeedCount,
    zeroArticleFeeds,
    highQualityFeeds,
    averageQualityScore,
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
  if (!SHOW_FEED_INSIGHTS && !SHOW_RECENT_ALERTS && !SHOW_ACTIVITY_LOG) {
    return null;
  }

  const analytics = getDashboardAnalytics();
  const analyticsPanels = [];

  if (SHOW_FEED_INSIGHTS) {
    analyticsPanels.push(`
      <div class="analytics-panel analytics-panel-wide analytics-panel-ranking">
        <span class="analytics-label">Feed insights</span>
        <p class="analytics-panel-note">${escapeHtml(analytics.analyticsScopeLabel)}</p>
        <p class="analytics-panel-note">Signals combine quality, recent activity, and article history.</p>
        ${analytics.systemHealthMessage ? `<p class="analytics-empty">${escapeHtml(analytics.systemHealthMessage)}</p>` : ""}
        ${renderFeedInsights(analytics.feedInsights)}
      </div>
    `);
  }

  if (SHOW_RECENT_ALERTS) {
    analyticsPanels.push(`
      <div class="analytics-panel analytics-panel-wide analytics-panel-alerts">
        <span class="analytics-label">Recent alerts</span>
        ${renderDashboardAlerts()}
      </div>
    `);
  }

  if (SHOW_ACTIVITY_LOG) {
    analyticsPanels.push(`
      <div class="analytics-panel analytics-panel-wide analytics-panel-activity">
        <span class="analytics-label">Activity log</span>
        <p class="analytics-panel-note">Recent meaningful events and recommended next steps from the last 24 hours.</p>
        ${renderActivityLog()}
      </div>
    `);
  }

  const card = document.createElement("article");
  card.className = "summary-card analytics-card";
  card.innerHTML = `
    <div class="analytics-card-head">
      <span class="summary-label">Feed analytics</span>
      <strong class="summary-value">${analytics.averageArticlesPerFeed}</strong>
      <span class="analytics-note">articles per feed</span>
      <div class="analytics-scope-tabs" aria-label="Feed analytics scope">
        <button class="${analytics.analyticsScope === "all" ? "is-active" : ""}" type="button" data-analytics-scope="all" aria-pressed="${analytics.analyticsScope === "all"}">
          All RSS feeds
        </button>
        <button class="${analytics.analyticsScope === "active" ? "is-active" : ""}" type="button" data-analytics-scope="active" aria-pressed="${analytics.analyticsScope === "active"}">
          Active feeds only
        </button>
      </div>
      <span class="analytics-scope-note">${escapeHtml(analytics.analyticsScopeNote)}</span>
    </div>
    <div class="analytics-grid">
      ${analyticsPanels.join("")}
      <div class="analytics-panel">
        <span class="analytics-label">Analytics scope</span>
        <p>${analytics.includedFeedCount} included of ${analytics.totalAnalyticsFeeds} RSS feeds, ${analytics.zeroArticleFeeds} zero-article, ${analytics.highQualityFeeds} high quality, ${analytics.averageQualityScore}% avg quality</p>
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

  const analyticsCard = renderAnalyticsCard();
  if (analyticsCard) {
    fragment.appendChild(analyticsCard);
  }
  elements.summaryGrid.appendChild(fragment);
}

function applyTodayArticleFilter() {
  const today = toDateInputValue(new Date());
  const nextDate = state.filters.date === today ? "" : today;
  clearExactArticleFilter();
  state.filters.date = nextDate;
  elements.dateFilter.value = nextDate;
  renderSummary();
  scheduleRenderArticles("today-filter");
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
  state.filters.search = "";
  state.filters.topic = "";
  state.filters.tag = "";
  state.filters.date = "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  elements.searchFilter.value = "";
  elements.topicFilter.value = state.filters.topic;
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
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

function applyActivityItemFilter(activityItem) {
  if (!activityItem) {
    return;
  }

  if (Array.isArray(activityItem.articleIds) && activityItem.articleIds.length) {
    applyAlertArticleFilter(activityItem);
    return;
  }

  if (activityItem.feedId) {
    applyAnalyticsFeedFilter({
      feedId: activityItem.feedId,
      todayOnly: activityItem.todayOnly === true,
    });
  }
}

function applyAnalyticsFilter({ topic, todayOnly = false }) {
  const nextTopic = String(topic || "").trim();
  if (!nextTopic) {
    return;
  }

  clearExactArticleFilter();
  state.filters.topic = nextTopic;
  state.filters.tag = "";
  state.filters.date = todayOnly ? toDateInputValue(new Date()) : "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  elements.topicFilter.value = nextTopic;
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
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

function getUsDmvCatalogEntryForFeed(feed) {
  if (!feed) {
    return null;
  }

  return getUsDmvCatalogEntries().find((entry) => getFeedForCatalogEntry(entry)?.id === feed.id) || null;
}

function applyAnalyticsFeedFilter({ feedId, todayOnly = false }) {
  const selectedFeed = state.feeds.find((feed) => feed.id === feedId);
  if (!selectedFeed) {
    return;
  }

  clearExactArticleFilter();
  state.filters.search = "";
  state.filters.topic = "";
  state.filters.tag = "";
  state.filters.date = todayOnly ? toDateInputValue(new Date()) : "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  const feedCountry = getFeedCountry(selectedFeed);
  const isDmvLikeFeed =
    isDmvWrapperFeed(selectedFeed) || Boolean(selectedFeed.dmvAbbr) || feedCountry === "us" || feedCountry === "canada";
  const usDmvEntry = isDmvLikeFeed ? getUsDmvCatalogEntryForFeed(selectedFeed) : null;
  const canadaDmvEntry = isDmvLikeFeed ? getCanadaCatalogEntryForFeed(selectedFeed) : null;

  if (usDmvEntry?.abbr) {
    state.filters.dmvFeedId = usDmvEntry.abbr;
  } else if (canadaDmvEntry?.feedPath) {
    state.filters.canadaDmvFeedPath = canadaDmvEntry.feedPath;
  } else {
    state.filters.feedId = selectedFeed.id;
  }

  elements.searchFilter.value = "";
  elements.topicFilter.value = "";
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
  elements.dateFilter.value = state.filters.date;
  elements.feedFilter.value = state.filters.feedId;
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = state.filters.dmvFeedId;
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = state.filters.canadaDmvFeedPath;
  }

  renderDashboard();
}

function getTodaySummaryCardFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest('[data-action="filter-today"]');
}

function getAnalyticsFeedTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-feed-id]");
}

function getAnalyticsFilterTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-topic]");
}

function getDashboardAlertTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-alert-id]");
}

function getActivityLogTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-activity-id]");
}

function getAnalyticsScopeTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-scope]");
}

function getAnalyticsQualityFilterTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-quality-filter]");
}

function getSelectedOptionText(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function normalizeFilterTag(tag) {
  const normalized = String(tag || "").trim().toLowerCase().replace(/\s+/g, " ");
  return TAG_ALIASES[normalized] || normalized;
}

function normalizeTagList(tags) {
  return Array.from(new Set((Array.isArray(tags) ? tags : []).map(normalizeFilterTag).filter(Boolean)));
}

function normalizeKeyword(keyword) {
  return String(keyword || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeKeywordList(keywords, fallback = []) {
  const normalized = Array.from(
    new Set((Array.isArray(keywords) ? keywords : []).map(normalizeKeyword).filter(Boolean))
  );
  if (normalized.length) {
    return normalized;
  }
  return Array.from(new Set((Array.isArray(fallback) ? fallback : []).map(normalizeKeyword).filter(Boolean)));
}

function parseKeywordInput(value, fallback = []) {
  return normalizeKeywordList(String(value || "").split(","), fallback);
}

function updateKeywordFilterInputs() {
  if (elements.includeKeywordsInput) {
    elements.includeKeywordsInput.value = state.keywordFilters.include.join(", ");
  }
  if (elements.excludeKeywordsInput) {
    elements.excludeKeywordsInput.value = state.keywordFilters.exclude.join(", ");
  }
}

function saveKeywordFilters() {
  window.localStorage.setItem(KEYWORD_FILTER_STORAGE_KEY, JSON.stringify(state.keywordFilters));
}

function setKeywordFilters({ include = state.keywordFilters.include, exclude = state.keywordFilters.exclude }, persist = true) {
  state.keywordFilters.include = normalizeKeywordList(include, DEFAULT_KEYWORD_INCLUDES);
  state.keywordFilters.exclude = normalizeKeywordList(exclude, DEFAULT_KEYWORD_EXCLUDES);
  if (persist) {
    saveKeywordFilters();
  }
  updateKeywordFilterInputs();
}

function loadKeywordFilters() {
  const storedFilters = window.localStorage.getItem(KEYWORD_FILTER_STORAGE_KEY);
  if (!storedFilters) {
    setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES, exclude: DEFAULT_KEYWORD_EXCLUDES }, false);
    return;
  }

  try {
    const parsedFilters = JSON.parse(storedFilters);
    setKeywordFilters(
      {
        include: parsedFilters?.include,
        exclude: parsedFilters?.exclude,
      },
      false
    );
  } catch (error) {
    console.warn("Unable to load keyword filters; using defaults.", error);
    setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES, exclude: DEFAULT_KEYWORD_EXCLUDES }, false);
  }
}

function resetKeywordFilters() {
  window.localStorage.removeItem(KEYWORD_FILTER_STORAGE_KEY);
  setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES, exclude: DEFAULT_KEYWORD_EXCLUDES }, false);
}

function isNoiseKeywordsExpanded() {
  return window.localStorage.getItem(NOISE_KEYWORDS_EXPANDED_STORAGE_KEY) === "true";
}

function syncNoiseKeywordVisibility() {
  if (!elements.keywordContent || !elements.keywordToggle) {
    return;
  }

  elements.keywordContent.hidden = !state.noiseKeywordsExpanded;
  elements.keywordToggle.setAttribute("aria-expanded", String(state.noiseKeywordsExpanded));
  elements.keywordToggle.textContent = state.noiseKeywordsExpanded ? "Hide ▴" : "Manage ▾";
}

function applyKeywordInputs() {
  setKeywordFilters({
    include: parseKeywordInput(elements.includeKeywordsInput?.value, DEFAULT_KEYWORD_INCLUDES),
    exclude: parseKeywordInput(elements.excludeKeywordsInput?.value, DEFAULT_KEYWORD_EXCLUDES),
  });
  scheduleRenderArticles("keyword-inputs");
}

function keywordListsMatch(left, right) {
  const normalizedLeft = normalizeKeywordList(left);
  const normalizedRight = normalizeKeywordList(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((keyword, index) => keyword === normalizedRight[index])
  );
}

function hasCustomIncludeKeywords() {
  return !keywordListsMatch(state.keywordFilters.include, DEFAULT_KEYWORD_INCLUDES);
}

function hasCustomExcludeKeywords() {
  return !keywordListsMatch(state.keywordFilters.exclude, DEFAULT_KEYWORD_EXCLUDES);
}

function getActiveTags() {
  if (!activeTagsLoaded) {
    activeTags = normalizeTagList(DEFAULT_TAGS);
    activeTagSet = new Set(activeTags);
    activeTagsLoaded = true;
  }
  return activeTags;
}

function getActiveTagSet() {
  getActiveTags();
  return activeTagSet;
}

function saveActiveTags(tags) {
  window.localStorage.setItem(TAG_LIST_STORAGE_KEY, JSON.stringify(tags));
}

function setActiveTags(tags, { persist = true } = {}) {
  activeTags = normalizeTagList(tags);
  activeTagSet = new Set(activeTags);
  activeTagsLoaded = true;
  if (persist) {
    saveActiveTags(activeTags);
  }
}

function loadActiveTags() {
  const storedTags = window.localStorage.getItem(TAG_LIST_STORAGE_KEY);
  if (!storedTags) {
    setActiveTags(DEFAULT_TAGS, { persist: false });
    return;
  }

  try {
    const parsedTags = JSON.parse(storedTags);
    if (!Array.isArray(parsedTags)) {
      setActiveTags(DEFAULT_TAGS, { persist: false });
      return;
    }

    setActiveTags(parsedTags, { persist: false });
  } catch (error) {
    console.warn("Unable to load saved tag list; using defaults.", error);
    setActiveTags(DEFAULT_TAGS, { persist: false });
  }
}

function resetActiveTags() {
  window.localStorage.removeItem(TAG_LIST_STORAGE_KEY);
  setActiveTags(DEFAULT_TAGS, { persist: false });
}

function getArticleTags(article) {
  return Array.from(
    new Set(
      []
        .concat(Array.isArray(article.tags) ? article.tags : [])
        .concat(Array.isArray(article.keywords) ? article.keywords : [])
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
    )
  );
}

function getArticleFilterTags(article) {
  return Array.from(
    new Set(
      getArticleTags(article)
        .map(normalizeFilterTag)
        .filter((tag) => getActiveTagSet().has(tag))
    )
  );
}

function getArticleSearchText(article) {
  return [
    article.title,
    article.source,
    article.topic,
    getFeedName(article.feedId),
    getArticleTags(article).join(" "),
    getArticleFilterTags(article).join(" "),
    article.summary,
    article.summaryShort,
    article.contentSnippet,
  ]
    .join(" ")
    .toLowerCase();
}

function getArticleKeywordText(article) {
  return [
    article.title,
    article.description,
    article.summary,
    article.summaryShort,
    article.contentSnippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getArticleSignalText(article) {
  return getCachedArticleValue(article, "articleSignalText", () =>
    [
      article.title,
      article.description,
      article.summary,
      article.summaryShort,
      article.contentSnippet,
      article.source,
      article.topic,
      getArticleTags(article).join(" "),
      getArticleFilterTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function getArticleTopicClassifierText(article) {
  return getCachedArticleValue(article, "articleTopicClassifierText", () =>
    [
      article?.title,
      article?.description,
      article?.summary,
      article?.summaryShort,
      article?.contentSnippet,
      article?.source,
      article?.topic,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function getArticleTopicType(article) {
  if (article?.topicType) {
    return String(article.topicType);
  }

  const text = getArticleTopicClassifierText(article);
  if (!text) {
    return "noise";
  }

  const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

  if (hasAny(ARTICLE_TOPIC_TYPE_NOISE_KEYWORDS)) {
    return "noise";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_BANKNOTE_KEYWORDS)) {
    return "banknote";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_DRIVER_LICENSE_KEYWORDS)) {
    return "dmv_driver_license";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_DIGITAL_IDENTITY_KEYWORDS)) {
    return "digital_identity";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_IDENTITY_DOCUMENT_KEYWORDS)) {
    return "identity_document";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_TRAVEL_PASSPORT_KEYWORDS)) {
    return "travel_passport";
  }

  return "noise";
}

function getPassportEventType(article) {
  return getCachedArticleValue(article, "passportEventType", () => {
    const text = getArticleTopicClassifierText(article);
    if (!text) {
      return "passport_noise";
    }

    const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

    if (isPassportNoiseArticle(article) || hasAny(PASSPORT_EVENT_TYPE_RULES.passport_noise)) {
      return "passport_noise";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_ranking)) {
      return "passport_ranking";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.ees_border_control)) {
      return "ees_border_control";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_fraud)) {
      return "passport_fraud";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_processing)) {
      return "passport_processing";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_regulation)) {
      return "passport_regulation";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_design)) {
      return "passport_design";
    }

    if (
      [
        "passport",
        "passports",
        "biometric passport",
        "e-passport",
        "epassport",
        "state department passport",
      ].some((keyword) => textMatchesKeyword(text, keyword))
    ) {
      return isRealTravelDocumentArticle(article) ? "travel_passport_other" : "passport_noise";
    }

    return "passport_noise";
  });
}

function isPassportNoiseArticle(article) {
  return getCachedArticleValue(article, "passportNoiseArticle", () => {
    const text = getArticleTopicClassifierText(article);
    if (!text) {
      return true;
    }

    return normalizeKeywordList(PASSPORT_HARD_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  });
}

function isHardPassportNoise(article) {
  return getCachedArticleValue(article, "hardPassportNoise", () => {
    const text = [
      article?.title,
      article?.description,
      article?.summary,
      article?.source,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!text) {
      return false;
    }

    return normalizeKeywordList(PASSPORT_HARD_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  });
}

function getGovernmentDocumentConfidence(article) {
  return getCachedArticleValue(article, "governmentDocumentConfidence", () => {
    const text = [
      article?.title,
      article?.description,
      article?.summary,
      article?.source,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!text) {
      return 0;
    }

    let score = 0;
    GOVERNMENT_DOCUMENT_POSITIVE_SIGNALS.forEach(([keyword, value]) => {
      if (textMatchesKeyword(text, keyword)) {
        score += value;
      }
    });
    GOVERNMENT_DOCUMENT_NEGATIVE_SIGNALS.forEach(([keyword, value]) => {
      if (textMatchesKeyword(text, keyword)) {
        score += value;
      }
    });

    return score;
  });
}

function getIdentityDocumentContextText(article) {
  return getCachedArticleValue(article, "identityDocumentContextText", () =>
    [
      article?.title,
      article?.description,
      article?.summary,
      article?.source,
      article?.topic,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function isPassportOrIdentityTopicArticle(article) {
  return getCachedArticleValue(article, "isPassportOrIdentityTopicArticle", () => {
    const topicText = [
      article?.title,
      article?.topic,
      article?.topicType,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return [
      article?.topicType === "travel_passport",
      article?.topicType === "identity_document",
      article?.topicType === "digital_identity",
      textMatchesKeyword(topicText, "passport"),
      textMatchesKeyword(topicText, "passports"),
      textMatchesKeyword(topicText, "identity document"),
      textMatchesKeyword(topicText, "identity documents"),
      textMatchesKeyword(topicText, "travel document"),
    ].some(Boolean);
  });
}

function getPrimaryPassportSubject(article) {
  return getCachedArticleValue(article, "primaryPassportSubject", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const descriptionText = String(article?.description || article?.summary || "").toLowerCase();
    const firstSentenceText = String(descriptionText.split(/(?<=[.!?])\s+/)[0] || descriptionText).toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const tagsText = getArticleTags(article).join(" ").toLowerCase();
    const bodyText = [descriptionText, tagsText].filter(Boolean).join(" ");

    const weights = {
      title: 4,
      firstSentence: 2,
      body: 1,
      source: 2,
    };

    const scores = Object.fromEntries(
      Object.keys(PRIMARY_PASSPORT_SUBJECT_RULES).map((subject) => [subject, 0])
    );

    Object.entries(PRIMARY_PASSPORT_SUBJECT_RULES).forEach(([subject, keywords]) => {
      normalizeKeywordList(keywords).forEach((keyword) => {
        if (textMatchesKeyword(titleText, keyword)) {
          scores[subject] += weights.title;
        }
        if (textMatchesKeyword(firstSentenceText, keyword)) {
          scores[subject] += weights.firstSentence;
        }
        if (textMatchesKeyword(bodyText, keyword)) {
          scores[subject] += weights.body;
        }
        if (textMatchesKeyword(sourceText, keyword)) {
          scores[subject] += weights.source;
        }
      });
    });

    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_POSITIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        scores.identity_infrastructure += 2;
        scores.passport_regulation += 1;
      }
    });
    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_NEGATIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        scores.unrelated += 3;
      }
    });

    const sortedSubjects = Object.entries(scores).sort((left, right) => right[1] - left[1]);
    const [primarySubject, primaryScore] = sortedSubjects[0] || ["unrelated", 0];
    const unrelatedScore = scores.unrelated || 0;

    if (!primaryScore || primarySubject === "unrelated" || unrelatedScore >= primaryScore) {
      return "unrelated";
    }

    return primarySubject;
  });
}

function getIdentityContextSignals(article) {
  return getCachedArticleValue(article, "identityContextSignals", () => {
    const text = getIdentityDocumentContextText(article);
    const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

    return {
      government: hasAny(IDENTITY_CONTEXT_KEYWORDS.government),
      border: hasAny(IDENTITY_CONTEXT_KEYWORDS.border),
      immigration: hasAny(IDENTITY_CONTEXT_KEYWORDS.immigration),
      fraud: hasAny(IDENTITY_CONTEXT_KEYWORDS.fraud),
      security: hasAny(IDENTITY_CONTEXT_KEYWORDS.security),
      issuance: hasAny(IDENTITY_CONTEXT_KEYWORDS.issuance),
      infrastructure: hasAny(IDENTITY_CONTEXT_KEYWORDS.infrastructure),
      travelRule: hasAny(IDENTITY_CONTEXT_KEYWORDS.travelRule),
      unrelatedLifestyle: hasAny(IDENTITY_CONTEXT_KEYWORDS.unrelatedLifestyle),
      sports: hasAny(IDENTITY_CONTEXT_KEYWORDS.sports),
      pets: hasAny(IDENTITY_CONTEXT_KEYWORDS.pets),
      entertainment: hasAny(IDENTITY_CONTEXT_KEYWORDS.entertainment),
      education: hasAny(IDENTITY_CONTEXT_KEYWORDS.education),
      genericTravel: hasAny(IDENTITY_CONTEXT_KEYWORDS.genericTravel),
    };
  });
}

function getIdentityDocumentRelevance(article) {
  return getCachedArticleValue(article, "identityDocumentRelevance", () => {
    const text = getIdentityDocumentContextText(article);

    if (!text) {
      return 0;
    }

    const context = getIdentityContextSignals(article);
    let score = 0;
    normalizeKeywordList(IDENTITY_DOCUMENT_HIGH_RELEVANCE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(text, keyword)) {
        score += 5;
      }
    });
    normalizeKeywordList(IDENTITY_DOCUMENT_MEDIUM_RELEVANCE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(text, keyword)) {
        score += 2;
      }
    });
    normalizeKeywordList(IDENTITY_DOCUMENT_NEGATIVE_RELEVANCE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(text, keyword)) {
        score -= 8;
      }
    });
    if (context.government) {
      score += 6;
    }
    if (context.border) {
      score += 6;
    }
    if (context.immigration) {
      score += 6;
    }
    if (context.fraud) {
      score += 6;
    }
    if (context.security) {
      score += 5;
    }
    if (context.issuance) {
      score += 5;
    }
    if (context.infrastructure) {
      score += 5;
    }
    if (context.travelRule) {
      score += 4;
    }
    if (context.unrelatedLifestyle) {
      score -= 10;
    }
    if (context.sports) {
      score -= 10;
    }
    if (context.pets) {
      score -= 10;
    }
    if (context.entertainment) {
      score -= 8;
    }
    if (context.education) {
      score -= 8;
    }
    if (context.genericTravel) {
      score -= 8;
    }

    return score;
  });
}

function getHighConfidencePassportAssessment(article) {
  return getCachedArticleValue(article, "highConfidencePassportAssessment", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const subtitleText = String(article?.summary || "").toLowerCase();
    const descriptionText = String(article?.description || "").toLowerCase();
    const firstSentenceText = String((article?.description || article?.summary || "").split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const combinedText = getIdentityDocumentContextText(article);
    const primarySubject = getPrimaryPassportSubject(article);
    const context = getIdentityContextSignals(article);
    let score = getIdentityDocumentRelevance(article);

    normalizeKeywordList(HIGH_CONFIDENCE_PASSPORT_POSITIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(titleText, keyword)) {
        score += 6;
      }
      if (textMatchesKeyword(subtitleText, keyword)) {
        score += 4;
      }
      if (textMatchesKeyword(firstSentenceText, keyword)) {
        score += 3;
      }
      if (textMatchesKeyword(descriptionText, keyword)) {
        score += 1;
      }
    });

    normalizeKeywordList(HIGH_CONFIDENCE_PASSPORT_NEGATIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(titleText, keyword)) {
        score -= 8;
      }
      if (textMatchesKeyword(subtitleText, keyword)) {
        score -= 6;
      }
      if (textMatchesKeyword(firstSentenceText, keyword)) {
        score -= 5;
      }
      if (textMatchesKeyword(descriptionText, keyword)) {
        score -= 2;
      }
    });

    if (context.government || context.border || context.immigration || context.fraud || context.security || context.infrastructure) {
      score += 5;
    }
    if (primarySubject !== "unrelated") {
      score += 6;
    } else {
      score -= 12;
    }

    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_POSITIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        score += 4;
      }
    });
    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_NEGATIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        score -= 5;
      }
    });

    const hasCentralSignal = normalizeKeywordList(HIGH_CONFIDENCE_PASSPORT_POSITIVE_SIGNALS).some((keyword) =>
      textMatchesKeyword(titleText, keyword)
      || textMatchesKeyword(subtitleText, keyword)
      || textMatchesKeyword(firstSentenceText, keyword)
      || textMatchesKeyword(sourceText, keyword)
    ) || (
      primarySubject !== "unrelated"
      && [
        "passport",
        "passports",
        "travel document",
        "identity card",
        "digital id",
        "eid",
        "immigration",
        "visa",
        "border",
      ].some((keyword) => textMatchesKeyword(titleText, keyword) || textMatchesKeyword(combinedText, keyword))
    );

    let rejectedReason = "";
    if (!hasCentralSignal) {
      rejectedReason = "no central identity signal";
    } else if (primarySubject === "unrelated") {
      rejectedReason = "primary subject unrelated";
    } else if (score < HIGH_CONFIDENCE_PASSPORT_THRESHOLD) {
      rejectedReason = "below high-confidence threshold";
    }

    return {
      score,
      primarySubject,
      kept: hasCentralSignal && primarySubject !== "unrelated" && score >= HIGH_CONFIDENCE_PASSPORT_THRESHOLD,
      rejectedReason,
    };
  });
}

function isHighConfidencePassportIntelligence(article) {
  return getHighConfidencePassportAssessment(article).kept;
}

function getKeesingIdentityRelevance(article) {
  return getCachedArticleValue(article, "keesingIdentityRelevance", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const subtitleText = String(article?.summary || "").toLowerCase();
    const descriptionText = String(article?.description || "").toLowerCase();
    const firstSentenceText = String((article?.description || article?.summary || "").split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const combinedText = getIdentityDocumentContextText(article);
    const primarySubject = getPrimaryPassportSubject(article);
    const context = getIdentityContextSignals(article);

    let score = 0;
    const applyWeightedSignals = (keywords, weights) => {
      normalizeKeywordList(keywords).forEach((keyword) => {
        if (textMatchesKeyword(titleText, keyword)) {
          score += weights.title;
        }
        if (textMatchesKeyword(subtitleText, keyword)) {
          score += weights.subtitle;
        }
        if (textMatchesKeyword(firstSentenceText, keyword)) {
          score += weights.firstSentence;
        }
        if (textMatchesKeyword(descriptionText, keyword)) {
          score += weights.description;
        }
        if (textMatchesKeyword(sourceText, keyword)) {
          score += weights.source;
        }
      });
    };

    Object.values(KEESING_POSITIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: 6,
        subtitle: 4,
        firstSentence: 3,
        description: 1,
        source: 3,
      });
    });
    Object.values(KEESING_NEGATIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: -8,
        subtitle: -6,
        firstSentence: -5,
        description: -2,
        source: -4,
      });
    });
    normalizeKeywordList(KEESING_HARD_KEEP_SIGNALS).forEach((keyword) => {
      if (
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
        || textMatchesKeyword(sourceText, keyword)
      ) {
        score += 10;
      }
    });

    const hasRequiredComponent = normalizeKeywordList(KEESING_REQUIRED_COMPONENT_SIGNALS).some((keyword) =>
      textMatchesKeyword(titleText, keyword)
      || textMatchesKeyword(subtitleText, keyword)
      || textMatchesKeyword(firstSentenceText, keyword)
      || textMatchesKeyword(combinedText, keyword)
      || textMatchesKeyword(sourceText, keyword)
    );

    if (primarySubject !== "unrelated") {
      score += 6;
    } else {
      score -= 10;
    }

    if (
      context.government
      || context.border
      || context.immigration
      || context.fraud
      || context.security
      || context.issuance
      || context.infrastructure
      || context.travelRule
      || getGovernmentDocumentConfidence(article) >= 3
    ) {
      score += 4;
    }

    if (!hasRequiredComponent) {
      score -= 12;
    }

    return {
      score,
      primarySubject,
      hasRequiredComponent,
    };
  });
}

function isBanknoteTopicArticle(article) {
  return getCachedArticleValue(article, "isBanknoteTopicArticle", () => {
    const topicText = [
      article?.title,
      article?.topic,
      article?.topicType,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return [
      article?.topicType === "banknote",
      textMatchesKeyword(topicText, "banknote"),
      textMatchesKeyword(topicText, "banknotes"),
      textMatchesKeyword(topicText, "currency note"),
      textMatchesKeyword(topicText, "paper money"),
    ].some(Boolean);
  });
}

function getBanknoteIntelligenceRelevance(article) {
  return getCachedArticleValue(article, "banknoteIntelligenceRelevance", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const subtitleText = String(article?.summary || "").toLowerCase();
    const descriptionText = String(article?.description || "").toLowerCase();
    const firstSentenceText = String((article?.description || article?.summary || "").split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const combinedText = getArticleSignalText(article);
    const eventType = getBanknoteEventType(article);

    let score = 0;
    const applyWeightedSignals = (keywords, weights) => {
      normalizeKeywordList(keywords).forEach((keyword) => {
        if (textMatchesKeyword(titleText, keyword)) {
          score += weights.title;
        }
        if (textMatchesKeyword(subtitleText, keyword)) {
          score += weights.subtitle;
        }
        if (textMatchesKeyword(firstSentenceText, keyword)) {
          score += weights.firstSentence;
        }
        if (textMatchesKeyword(descriptionText, keyword)) {
          score += weights.description;
        }
        if (textMatchesKeyword(sourceText, keyword)) {
          score += weights.source;
        }
      });
    };

    Object.values(BANKNOTE_INTELLIGENCE_POSITIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: 6,
        subtitle: 4,
        firstSentence: 3,
        description: 1,
        source: 3,
      });
    });
    Object.values(BANKNOTE_INTELLIGENCE_NEGATIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: -8,
        subtitle: -6,
        firstSentence: -5,
        description: -2,
        source: -4,
      });
    });
    normalizeKeywordList(BANKNOTE_INTELLIGENCE_HARD_KEEP_SIGNALS).forEach((keyword) => {
      if (
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
        || textMatchesKeyword(sourceText, keyword)
      ) {
        score += 10;
      }
    });
    normalizeKeywordList(BANKNOTE_INTELLIGENCE_HARD_REJECT_SIGNALS).forEach((keyword) => {
      if (
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
        || textMatchesKeyword(sourceText, keyword)
      ) {
        score -= 12;
      }
    });

    const hasRequiredComponent = normalizeKeywordList(BANKNOTE_REQUIRED_COMPONENT_SIGNALS).some((keyword) =>
      textMatchesKeyword(titleText, keyword)
      || textMatchesKeyword(subtitleText, keyword)
      || textMatchesKeyword(firstSentenceText, keyword)
      || textMatchesKeyword(combinedText, keyword)
      || textMatchesKeyword(sourceText, keyword)
    );

    const isSignatureOnly = (
      eventType === "banknote_signature_change"
      || normalizeKeywordList(BANKNOTE_SIGNATURE_ONLY_SIGNALS).some((keyword) =>
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
      )
      || BANKNOTE_LOW_PRIORITY_CODE_PATTERN.test(combinedText)
    );

    if (eventType === "banknote_withdrawal" || eventType === "counterfeit_banknotes") {
      score += 10;
    } else if (eventType === "banknote_new_design" || eventType === "banknote_new_series" || eventType === "polymer_transition") {
      score += 8;
    } else if (eventType === "banknote_auction_noise") {
      score -= 14;
    } else if (eventType === "commemorative_note") {
      score -= 4;
    }

    if (isSignatureOnly) {
      score -= 10;
    }

    if (!hasRequiredComponent) {
      score -= 12;
    }

    let rejectedReason = "";
    if (!hasRequiredComponent) {
      rejectedReason = "missing central-bank/document component";
    } else if (eventType === "banknote_auction_noise") {
      rejectedReason = "collector or auction noise";
    } else if (isSignatureOnly && score < BANKNOTE_RELEVANCE_THRESHOLD) {
      rejectedReason = "signature/date-only update";
    } else if (score < BANKNOTE_RELEVANCE_THRESHOLD) {
      rejectedReason = "below banknote relevance threshold";
    }

    return {
      score,
      eventType,
      hasRequiredComponent,
      kept: hasRequiredComponent && score >= BANKNOTE_RELEVANCE_THRESHOLD,
      rejectedReason,
    };
  });
}

function isPrimaryPassportIntelligence(article) {
  const titleText = String(article?.title || "").toLowerCase();
  const combinedText = getIdentityDocumentContextText(article);
  const primarySubject = getPrimaryPassportSubject(article);
  const hasCentralIdentityTopic = [
    "passport",
    "passports",
    "travel document",
    "identity",
    "visa",
    "immigration",
    "border",
    "etias",
    "ees",
    "digital id",
    "eid",
    "icao",
  ].some((keyword) => textMatchesKeyword(titleText, keyword) || textMatchesKeyword(combinedText, keyword));

  if (!hasCentralIdentityTopic) {
    return false;
  }

  return primarySubject !== "unrelated";
}

function shouldRejectPassportArticle(article) {
  if (!isPassportOrIdentityTopicArticle(article)) {
    return false;
  }

  if (!isHighConfidencePassportIntelligence(article)) {
    return true;
  }

  const keesingAssessment = getKeesingIdentityRelevance(article);
  if (!keesingAssessment.hasRequiredComponent) {
    return true;
  }
  if (keesingAssessment.primarySubject === "unrelated") {
    return true;
  }
  if (keesingAssessment.score < KEESING_RELEVANCE_THRESHOLD) {
    return true;
  }

  const context = getIdentityContextSignals(article);
  const hasStrongPositiveContext = context.government
    || context.border
    || context.immigration
    || context.fraud
    || context.security
    || context.issuance
    || context.infrastructure
    || context.travelRule;

  if (hasStrongPositiveContext) {
    return false;
  }

  const negativeContextCount = [
    context.unrelatedLifestyle,
    context.sports,
    context.pets,
    context.entertainment,
    context.education,
    context.genericTravel,
  ].filter(Boolean).length;

  return negativeContextCount > 0 && getIdentityDocumentRelevance(article) < IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD;
}

function isLowRelevancePassportArticle(article) {
  const topicText = [
    article?.topic,
    article?.topicType,
    getArticleTags(article).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasPassportTopic = article?.topicType === "travel_passport"
    || textMatchesKeyword(topicText, "passport")
    || textMatchesKeyword(topicText, "passports");

  if (!hasPassportTopic) {
    return false;
  }

  return shouldRejectPassportArticle(article)
    || getIdentityDocumentRelevance(article) < IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD;
}

function isRealTravelDocumentArticle(article) {
  return getCachedArticleValue(article, "realTravelDocumentArticle", () => {
    const text = getArticleTopicClassifierText(article);
    if (!text) {
      return false;
    }

    if (isPassportNoiseArticle(article) || isHardPassportNoise(article) || shouldRejectPassportArticle(article)) {
      return false;
    }

    return normalizeKeywordList(REAL_TRAVEL_DOCUMENT_POSITIVE_SIGNALS).some((keyword) => textMatchesKeyword(text, keyword))
      || getGovernmentDocumentConfidence(article) >= 3;
  });
}

function normalizeLoadedArticle(article) {
  const topicType = getArticleTopicType(article);
  const normalizedArticle = {
    ...article,
    topicType,
    eventType: getArticleEventTypeForTopic(article, topicType),
  };
  primeArticleIntelligence(normalizedArticle);
  return normalizedArticle;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function intelligenceDebug(...args) {
  if (DEBUG_INTELLIGENCE) {
    console.debug(...args);
  }
}

function intelligenceLog(...args) {
  if (DEBUG_INTELLIGENCE) {
    console.log(...args);
  }
}

function intelligenceTime(label) {
  if (DEBUG_INTELLIGENCE) {
    console.time(label);
  }
}

function intelligenceTimeEnd(label) {
  if (DEBUG_INTELLIGENCE) {
    console.timeEnd(label);
  }
}

function getArticleStableCacheKey(article) {
  return String(
    article?.id
      || article?.url
      || `${article?.title || "untitled"}|${article?.pubDate || ""}|${article?.feedId || ""}`
  );
}

function getCachedArticleValue(article, cacheKey, computeValue) {
  const articleKey = getArticleStableCacheKey(article);
  let articleCache = runtime.articleComputationCache.get(articleKey);
  if (!articleCache) {
    articleCache = new Map();
    runtime.articleComputationCache.set(articleKey, articleCache);
  }

  if (articleCache.has(cacheKey)) {
    return articleCache.get(cacheKey);
  }

  const value = computeValue();
  articleCache.set(cacheKey, value);
  return value;
}

function getCachedArticlePairValue(leftArticle, rightArticle, cacheKey, computeValue) {
  const leftKey = getArticleStableCacheKey(leftArticle);
  const rightKey = getArticleStableCacheKey(rightArticle);
  const pairKey = [leftKey, rightKey].sort().join("::");
  let pairCache = runtime.articlePairComputationCache.get(pairKey);
  if (!pairCache) {
    pairCache = new Map();
    runtime.articlePairComputationCache.set(pairKey, pairCache);
  }

  if (pairCache.has(cacheKey)) {
    return pairCache.get(cacheKey);
  }

  const value = computeValue();
  pairCache.set(cacheKey, value);
  return value;
}

function primeArticleIntelligence(article) {
  if (!article || article._intelligence) {
    return article?._intelligence || null;
  }

  try {
    const intelligence = {
      cacheKey: getArticleStableCacheKey(article),
      topicType: getArticleTopicType(article),
      eventType: String(article?.eventType || ""),
      detectedEventEntity: getDetectedEventEntity(article),
      eventFingerprint: extractEventFingerprint(article),
      identityDocumentRelevance: getIdentityDocumentRelevance(article),
      highConfidencePassportAssessment: getHighConfidencePassportAssessment(article),
      keesingIdentityRelevance: getKeesingIdentityRelevance(article),
      banknoteIntelligenceRelevance: getBanknoteIntelligenceRelevance(article),
      governmentDocumentConfidence: getGovernmentDocumentConfidence(article),
      passportNoiseArticle: isPassportNoiseArticle(article),
      realTravelDocumentArticle: isRealTravelDocumentArticle(article),
    };

    article._intelligence = intelligence;
    return intelligence;
  } catch (error) {
    article._intelligence = {
      cacheKey: getArticleStableCacheKey(article),
      bootstrapError: error instanceof Error ? error.message : String(error),
    };
    intelligenceDebug("[intelligence-prime-failed]", {
      title: article?.title || "Untitled article",
      message: article._intelligence.bootstrapError,
    });
    return article._intelligence;
  }
}

function textMatchesKeyword(text, keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  const escapedKeyword = escapeRegExp(normalizedKeyword);
  const pattern = /^[a-z0-9\s-]+$/i.test(normalizedKeyword)
    ? new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, "i")
    : new RegExp(escapedKeyword, "i");
  return pattern.test(text);
}

function getTopicKeywordRuleKey(value) {
  const normalizedValue = normalizeFilterTag(value);
  return TOPIC_KEYWORD_RULE_ALIASES[normalizedValue] || normalizedValue;
}

function getTopicKeywordRule(value) {
  return TOPIC_KEYWORD_RULES[getTopicKeywordRuleKey(value)] || null;
}

function getActiveTopicKeywordRule() {
  return getTopicKeywordRule(state.filters.tag) || getTopicKeywordRule(state.filters.topic);
}

function getSignalCategoryById(signalCategoryId) {
  return SIGNAL_CATEGORY_BY_ID.get(String(signalCategoryId || "").trim()) || null;
}

function countMatchedKeywords(text, keywords = []) {
  return normalizeKeywordList(keywords).filter((keyword) => textMatchesKeyword(text, keyword)).length;
}

function hasSignalCoreObject(text) {
  return normalizeKeywordList(SIGNAL_CORE_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasSignalNoiseContext(text) {
  return normalizeKeywordList(SIGNAL_NOISE_CONTEXT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function isRelevantSignalText(text) {
  const hasNoiseKeyword = normalizeKeywordList(SIGNAL_RELEVANCE_NOISE_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (hasNoiseKeyword) {
    return false;
  }

  const hasIdObject = normalizeKeywordList(ID_SIGNAL_OBJECT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (hasIdObject) {
    const hasIdNoise = normalizeKeywordList(ID_SIGNAL_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
    if (hasIdNoise) {
      return false;
    }

    return isAllowedIdentityIntent(text);
  }

  if (hasBanknoteSignalObject(text) && (hasBanknoteHighPrioritySignal(text) || hasBanknoteLowPrioritySignal(text))) {
    return true;
  }

  const hasStrictIncludeKeyword = normalizeKeywordList(SIGNAL_STRICT_INCLUDE_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (hasStrictIncludeKeyword) {
    return true;
  }

  const hasReleaseVariantKeyword = normalizeKeywordList(SIGNAL_RELEASE_VARIANT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (!hasReleaseVariantKeyword) {
    return false;
  }

  return normalizeKeywordList(SIGNAL_RELEASE_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function isWeakIdentityIntent(text) {
  return normalizeKeywordList(ID_SIGNAL_WEAK_INTENT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isValidIdentityContext(text) {
  return normalizeKeywordList(ID_SIGNAL_VALID_CONTEXT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isNoiseContext(text) {
  return normalizeKeywordList(ID_SIGNAL_NOISE_CONTEXT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isIdentitySystemEvent(text) {
  return normalizeKeywordList(ID_SIGNAL_SYSTEM_EVENT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isNonSystemIdentityNoise(text) {
  return normalizeKeywordList(ID_SIGNAL_NON_SYSTEM_NOISE_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function hasIdentitySystemImpact(text) {
  return normalizeKeywordList(ID_SIGNAL_SYSTEM_IMPACT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isNonImpactIdentityContent(text) {
  return normalizeKeywordList(ID_SIGNAL_NON_IMPACT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isStrongIdentityIntent(text) {
  return normalizeKeywordList(ID_SIGNAL_HIGH_INTENT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasIdentityOverrideSignal(text) {
  return normalizeKeywordList(ID_SIGNAL_OVERRIDE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function isAllowedIdentityIntent(text) {
  if (isWeakIdentityIntent(text) && !hasIdentityOverrideSignal(text)) {
    return false;
  }

  return isStrongIdentityIntent(text);
}

function hasBanknoteSignalObject(text) {
  return normalizeKeywordList(BANKNOTE_SIGNAL_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasBanknoteHighPrioritySignal(text) {
  return normalizeKeywordList(BANKNOTE_HIGH_PRIORITY_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasBanknoteLowPrioritySignal(text) {
  return normalizeKeywordList(BANKNOTE_LOW_PRIORITY_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword))
    || BANKNOTE_LOW_PRIORITY_CODE_PATTERN.test(text);
}

function getBanknoteSignalMatches(text) {
  if (!hasBanknoteSignalObject(text)) {
    return [];
  }

  const matches = [];
  const pushMatch = (id, confidence) => {
    const existing = matches.find((match) => match.id === id);
    if (!existing) {
      matches.push({ id, confidence });
      return;
    }

    if (existing.confidence !== "high" && confidence === "high") {
      existing.confidence = "high";
    }
  };
  const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

  const hasHighPriorityBanknoteSignal = hasBanknoteHighPrioritySignal(text);
  const hasLowPriorityBanknoteSignal = hasBanknoteLowPrioritySignal(text);

  if (hasAny(["law", "regulation", "regulations", "legislation", "mandate", "policy", "directive"])) {
    pushMatch("regulations", "high");
  }

  if (hasAny([
    "withdraw",
    "withdrawn",
    "withdrawal",
    "demonetised",
    "demonetized",
    "demonetisation",
    "demonetization",
    "out of circulation",
    "cease legal tender",
    "no longer legal tender",
    "legal tender until",
    "exchange deadline",
  ])) {
    pushMatch("regulations", "high");
  }

  if (hasAny(["banknote series", "new series", "new banknote family"])) {
    pushMatch("new-releases", "high");
  }

  if (hasAny(["redesigned", "redesign", "new design", "new banknote design"])) {
    pushMatch("design-changes", "high");
  }

  if (hasAny([
    "security feature",
    "security features",
    "hologram",
    "windowed thread",
    "security thread",
    "polymer",
    "upgraded banknote",
    "enhanced security",
    "counterfeit prevention",
    "anti-counterfeit",
  ])) {
    pushMatch("security-features", "high");
  }

  if (!hasHighPriorityBanknoteSignal && hasLowPriorityBanknoteSignal) {
    pushMatch("new-releases", "low");
  }

  return matches;
}

function getIdDocumentSignalMatches(text) {
  const hasIdObject = normalizeKeywordList(ID_SIGNAL_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  if (!hasIdObject) {
    return [];
  }

  if (isNoiseContext(text)) {
    return [];
  }

  if (!isValidIdentityContext(text)) {
    return [];
  }

  if (isNonImpactIdentityContent(text)) {
    return [];
  }

  if (!hasIdentitySystemImpact(text)) {
    return [];
  }

  if (isNonSystemIdentityNoise(text)) {
    return [];
  }

  if (!isIdentitySystemEvent(text)) {
    return [];
  }

  const hasIdNoise = normalizeKeywordList(ID_SIGNAL_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  if (hasIdNoise) {
    return [];
  }

  if (!isAllowedIdentityIntent(text)) {
    return [];
  }

  const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));
  const matches = [];
  const pushMatch = (id, confidence) => {
    if (!matches.some((match) => match.id === id)) {
      matches.push({ id, confidence });
    }
  };

  if (hasAny(ID_SIGNAL_REGULATION_KEYWORDS)) {
    pushMatch("regulations", "high");
  }

  if (hasAny(ID_SIGNAL_SECURITY_STRONG_KEYWORDS)) {
    pushMatch("security-features", "high");
  }

  if (hasAny(ID_SIGNAL_TECHNOLOGY_STRONG_KEYWORDS)) {
    pushMatch("technology", "high");
  }

  if (hasAny(ID_SIGNAL_DESIGN_STRONG_KEYWORDS)) {
    pushMatch("design-changes", "high");
  } else if (hasAny(ID_SIGNAL_DESIGN_WEAK_KEYWORDS)) {
    pushMatch("design-changes", "low");
  }

  if (hasAny(ID_SIGNAL_RELEASE_STRONG_KEYWORDS)) {
    pushMatch("new-releases", "high");
  } else if (hasAny(ID_SIGNAL_RELEASE_SUPPORT_KEYWORDS)) {
    pushMatch("new-releases", "low");
  }

  return matches;
}

function getSignalConfidenceLabel(confidence) {
  if (confidence === "high") {
    return "high";
  }

  if (confidence === "low") {
    return "low";
  }

  return "";
}

function getPrimaryArticleSignalLabel(primarySignalCategory) {
  if (!primarySignalCategory) {
    return "";
  }

  const confidenceLabel = getSignalConfidenceLabel(primarySignalCategory.confidence);
  return confidenceLabel
    ? `${primarySignalCategory.badgeLabel || primarySignalCategory.label} (${confidenceLabel})`
    : primarySignalCategory.badgeLabel || primarySignalCategory.label;
}

function getArticleSignalMatches(article) {
  return getCachedArticleValue(article, "articleSignalMatches", () => {
    const haystack = getArticleSignalText(article);
    if (!haystack) {
      return [];
    }

    if (!isRelevantSignalText(haystack)) {
      return [];
    }

    if (!hasSignalCoreObject(haystack) || hasSignalNoiseContext(haystack)) {
      return [];
    }

    const designChangeCategory = getSignalCategoryById("design-changes");
    const hasDesignChangeSignal = Boolean(
      designChangeCategory && countMatchedKeywords(haystack, designChangeCategory.strong) >= 1
    );
    const idDocumentMatches = getIdDocumentSignalMatches(haystack);
    const banknoteMatches = getBanknoteSignalMatches(haystack);

    return idDocumentMatches.concat(banknoteMatches, SIGNAL_CATEGORIES.flatMap((category) => {
      if (
        idDocumentMatches.some((match) => match.id === category.id) ||
        banknoteMatches.some((match) => match.id === category.id)
      ) {
        return [];
      }

      const strongMatches = countMatchedKeywords(haystack, category.strong);
      const weakMatches = countMatchedKeywords(haystack, category.weak);
      const excludeKeywords = normalizeKeywordList(category.exclude);
      const requiredObjects = normalizeKeywordList(category.requiredObjects);
      const categoryNoise = normalizeKeywordList(category.noise);
      const hasExcludeMatch = excludeKeywords.some((keyword) => textMatchesKeyword(haystack, keyword));
      if (hasExcludeMatch) {
        return [];
      }

      if (category.id === "new-releases") {
        const hasRequiredObjectMatch = requiredObjects.some((keyword) => textMatchesKeyword(haystack, keyword));
        const hasCategoryNoise = categoryNoise.some((keyword) => textMatchesKeyword(haystack, keyword));
        const hasReleaseVariantKeyword = normalizeKeywordList(SIGNAL_RELEASE_VARIANT_KEYWORDS).some((keyword) =>
          textMatchesKeyword(haystack, keyword)
        );
        const hasReleaseObjectKeyword = normalizeKeywordList(SIGNAL_RELEASE_OBJECT_KEYWORDS).some((keyword) =>
          textMatchesKeyword(haystack, keyword)
        );
        if (!hasRequiredObjectMatch || hasCategoryNoise || hasDesignChangeSignal) {
          if (!(hasReleaseVariantKeyword && hasReleaseObjectKeyword) || hasCategoryNoise || hasDesignChangeSignal) {
            return [];
          }
        }

        if (strongMatches >= 1 || (hasReleaseVariantKeyword && hasReleaseObjectKeyword)) {
          return [{
            id: category.id,
            confidence: "high",
          }];
        }

        return [];
      }

      if (strongMatches >= 1) {
        return [{
          id: category.id,
          confidence: "high",
        }];
      }

      if (weakMatches >= 1) {
        return [{
          id: category.id,
          confidence: "low",
        }];
      }

      return [];
    }));
  });
}

function getArticleSignalCategories(article) {
  return getCachedArticleValue(article, "articleSignalCategories", () =>
    getArticleSignalMatches(article).map((match) => match.id)
  );
}

function isUiRelevantIntelligenceArticle(article) {
  const signalMatches = getArticleSignalMatches(article);
  if (signalMatches.length) {
    return true;
  }

  return isRelevantSignalText(getArticleSignalText(article));
}

function getPrimaryArticleSignalCategory(article) {
  const [primarySignalMatch] = getArticleSignalMatches(article);
  if (!primarySignalMatch) {
    return null;
  }

  const category = getSignalCategoryById(primarySignalMatch.id);
  if (!category) {
    return null;
  }

  return {
    ...category,
    confidence: primarySignalMatch.confidence,
  };
}

function isKeywordRuleFalsePositive(article, rule) {
  if (!rule) {
    return false;
  }

  const haystack = getArticleKeywordText(article);
  const hasExclusion = normalizeKeywordList(rule.exclude).some((keyword) => textMatchesKeyword(haystack, keyword));
  if (!hasExclusion) {
    return false;
  }

  return !normalizeKeywordList(rule.include).some((keyword) => textMatchesKeyword(haystack, keyword));
}

function isPassportFalsePositive(article) {
  const haystack = getArticleKeywordText(article);
  if (!textMatchesKeyword(haystack, "passport") && !textMatchesKeyword(haystack, "passports")) {
    return false;
  }

  const hasExclusion = state.keywordFilters.exclude.some((keyword) => textMatchesKeyword(haystack, keyword));
  if (!hasExclusion) {
    return false;
  }

  return !state.keywordFilters.include.some((keyword) => textMatchesKeyword(haystack, keyword));
}

function isDriverLicenseMusicFalsePositive(article) {
  const haystack = getArticleKeywordText(article);
  const hasDriverLicenseTerm = DRIVER_LICENSE_FALSE_POSITIVE_TERMS.some((keyword) =>
    textMatchesKeyword(haystack, keyword)
  );
  if (!hasDriverLicenseTerm) {
    return false;
  }

  return MUSIC_FALSE_POSITIVE_KEYWORDS.some((keyword) => textMatchesKeyword(haystack, keyword));
}

function isCoinGamingFalsePositive(article) {
  const haystack = getArticleKeywordText(article);
  const hasCoinTerm = COIN_FALSE_POSITIVE_TERMS.some((keyword) => textMatchesKeyword(haystack, keyword));
  if (!hasCoinTerm) {
    return false;
  }

  const hasGamingContext = GAMING_COIN_FALSE_POSITIVE_KEYWORDS.some((keyword) =>
    textMatchesKeyword(haystack, keyword)
  );
  if (!hasGamingContext) {
    return false;
  }

  return !COIN_CONTEXT_KEYWORDS.some((keyword) => textMatchesKeyword(haystack, keyword));
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
  setFieldActive(elements.tagFilter, Boolean(state.filters.tag));
  setFieldActive(elements.signalFilter, Boolean(state.filters.signalCategory));
  setFieldActive(elements.includeKeywordsInput, hasCustomIncludeKeywords());
  setFieldActive(elements.excludeKeywordsInput, hasCustomExcludeKeywords());
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
  if (state.filters.tag) {
    addActiveFilterChip(fragment, "Tag", state.filters.tag, "tag");
  }
  if (state.filters.signalCategory) {
    addActiveFilterChip(
      fragment,
      "Signal",
      getSignalCategoryById(state.filters.signalCategory)?.label || state.filters.signalCategory,
      "signal-category"
    );
  }
  if (hasCustomIncludeKeywords()) {
    addActiveFilterChip(fragment, "Include keywords", `${state.keywordFilters.include.length} terms`, "include-keywords");
  }
  if (hasCustomExcludeKeywords()) {
    addActiveFilterChip(fragment, "Exclude keywords", `${state.keywordFilters.exclude.length} terms`, "exclude-keywords");
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
  } else if (filterKey === "tag") {
    state.filters.tag = "";
    elements.tagFilter.value = "";
  } else if (filterKey === "signal-category") {
    state.filters.signalCategory = "";
    if (elements.signalFilter) {
      elements.signalFilter.value = "";
    }
  } else if (filterKey === "include-keywords") {
    setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES });
  } else if (filterKey === "exclude-keywords") {
    setKeywordFilters({ exclude: DEFAULT_KEYWORD_EXCLUDES });
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
  const realArticles = state.articles.filter((article) => !isOfficialFallbackArticle(article));
  const tagCounts = state.articles.reduce((counts, article) => {
    getArticleFilterTags(article).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
    return counts;
  }, new Map());
  const signalCounts = realArticles.reduce((counts, article) => {
    getArticleSignalCategories(article).forEach((signalCategoryId) => {
      counts.set(signalCategoryId, (counts.get(signalCategoryId) || 0) + 1);
    });
    return counts;
  }, new Map());
  const tags = getActiveTags().filter(
    (tag) => TAG_FILTER_MIN_COUNT <= 0 || (tagCounts.get(tag) || 0) >= TAG_FILTER_MIN_COUNT
  );
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

  state.filters.tag = normalizeFilterTag(state.filters.tag);
  if (state.filters.tag && !tags.includes(state.filters.tag)) {
    state.filters.tag = "";
  }
  if (state.filters.signalCategory && !SIGNAL_CATEGORY_BY_ID.has(state.filters.signalCategory)) {
    state.filters.signalCategory = "";
  }

  if (elements.tagFilter) {
    elements.tagFilter.innerHTML = [`<option value="">All tags</option>`]
      .concat(tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`))
      .join("");
    elements.tagFilter.value = state.filters.tag;
  }

  if (elements.signalFilter) {
    elements.signalFilter.innerHTML = [`<option value="">All signals</option>`]
      .concat(
        SIGNAL_CATEGORIES.map((category) => {
          const count = signalCounts.get(category.id) || 0;
          return `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)} (${count})</option>`;
        })
      )
      .join("");
    elements.signalFilter.value = state.filters.signalCategory;
  }

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

function refreshTagControls() {
  const selectedTag = normalizeFilterTag(state.filters.tag);
  if (selectedTag && !getActiveTagSet().has(selectedTag)) {
    state.filters.tag = "";
  }
  renderFeedOptions();
  renderTagManager();
  scheduleRenderArticles("tag-controls");
}

function addTagFromInput() {
  if (!elements.tagAddInput) {
    return;
  }

  const tag = normalizeFilterTag(elements.tagAddInput.value);
  if (!tag) {
    elements.tagAddInput.value = "";
    return;
  }

  if (!getActiveTagSet().has(tag)) {
    setActiveTags([...getActiveTags(), tag]);
  }

  elements.tagAddInput.value = "";
  refreshTagControls();
}

function removeActiveTag(tag) {
  const normalizedTag = normalizeFilterTag(tag);
  if (!normalizedTag) {
    return;
  }

  setActiveTags(getActiveTags().filter((item) => item !== normalizedTag));
  refreshTagControls();
}

function syncTagManagerVisibility() {
  if (!elements.tagManagerContent || !elements.tagManagerToggle) {
    return;
  }

  elements.tagManagerContent.hidden = !state.tagManagerExpanded;
  elements.tagManagerToggle.setAttribute("aria-expanded", String(state.tagManagerExpanded));
  elements.tagManagerToggle.textContent = state.tagManagerExpanded ? "Hide ▴" : "Manage ▾";
}

function renderTagManager() {
  if (!elements.tagManagerList) {
    return;
  }

  elements.tagManagerList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  getActiveTags().forEach((tag) => {
    const tagItem = document.createElement("span");
    const label = document.createElement("span");
    const removeButton = document.createElement("button");

    tagItem.className = "tag-manager-item";
    label.textContent = tag;
    removeButton.type = "button";
    removeButton.className = "tag-manager-remove";
    removeButton.dataset.removeTag = tag;
    removeButton.textContent = "remove";
    removeButton.title = "Click once, then confirm to remove";
    removeButton.setAttribute("aria-label", `Prepare to remove ${tag}`);

    tagItem.append(label, removeButton);
    fragment.appendChild(tagItem);
  });

  elements.tagManagerList.appendChild(fragment);
  syncTagManagerVisibility();
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

  intelligenceLog("Panel collapsed:", collapsed, {
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
  state.filters.tag = "";
  state.filters.signalCategory = "";
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
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
  if (elements.signalFilter) {
    elements.signalFilter.value = "";
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

function articleMatchesFilters(article, options = {}) {
  if (isOfficialFallbackArticle(article)) {
    return false;
  }

  const ignoreFeedId = Boolean(options.ignoreFeedId);

  const activeKeywordRule = getActiveTopicKeywordRule();
  if (activeKeywordRule && isKeywordRuleFalsePositive(article, activeKeywordRule)) {
    return false;
  }

  if (
    !activeKeywordRule &&
    (isPassportFalsePositive(article) ||
      isDriverLicenseMusicFalsePositive(article) ||
      isCoinGamingFalsePositive(article))
  ) {
    return false;
  }

  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];
  if (exactArticleIds.length) {
    return exactArticleIds.includes(article.id);
  }

  if (state.filters.signalCategory && !getArticleSignalCategories(article).includes(state.filters.signalCategory)) {
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

  if (state.filters.tag && !getArticleFilterTags(article).includes(normalizeFilterTag(state.filters.tag))) {
    return false;
  }

  if (state.filters.canadaDmvFeedPath) {
    const selectedCanadaFeed = getSelectedCanadaFeed();
    if (!selectedCanadaFeed || article.feedId !== selectedCanadaFeed.id) {
      return false;
    }
  }

  if (!ignoreFeedId && getActiveArticleFeedId() && !articleMatchesSelectedFeed(article, getActiveArticleFeedId())) {
    return false;
  }

  if (!ignoreFeedId && !getActiveArticleFeedId() && state.filters.canadaDmvAll && !isCanadianDmvAbbr(
    state.feeds.find((feed) => feed.id === article.feedId)?.dmvAbbr
  )) {
    return false;
  }

  if (!ignoreFeedId && !getActiveArticleFeedId() && state.dashboardMode === "usa" && !isDmvFeedId(article.feedId)) {
    return false;
  }

  if (state.filters.date && toDateInputValue(article.pubDate) !== state.filters.date) {
    return false;
  }

  if (state.filters.search) {
    const haystack = getArticleSearchText(article);

    if (!haystack.includes(state.filters.search.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function getVisibleArticles(options = {}) {
  intelligenceTime("getVisibleArticles");
  const visibleArticles = state.articles
    .filter((article) => {
      const rejectedAsNoise = isHardPassportNoise(article);
      if (rejectedAsNoise) {
        intelligenceDebug("[passport-filter]", {
          title: article?.title || "Untitled article",
          confidence: getGovernmentDocumentConfidence(article),
          rejectedAsNoise,
        });
      }

      return !rejectedAsNoise;
    })
    .filter((article) => {
      try {
        const intelligence = article?._intelligence || primeArticleIntelligence(article) || {};
        const relevance = intelligence.identityDocumentRelevance ?? getIdentityDocumentRelevance(article);
        const highConfidenceAssessment = intelligence.highConfidencePassportAssessment ?? getHighConfidencePassportAssessment(article);
        const keesingAssessment = intelligence.keesingIdentityRelevance ?? getKeesingIdentityRelevance(article);
        const banknoteAssessment = intelligence.banknoteIntelligenceRelevance ?? getBanknoteIntelligenceRelevance(article);
        const rejected = shouldRejectPassportArticle(article)
          || isLowRelevancePassportArticle(article)
          || (isBanknoteTopicArticle(article) && !banknoteAssessment.kept);
        const primarySubject = highConfidenceAssessment.primarySubject;
        const hasPassportKeyword = isPassportOrIdentityTopicArticle(article);
        const hasBanknoteKeyword = isBanknoteTopicArticle(article);

        if (hasPassportKeyword) {
          const context = getIdentityContextSignals(article);
          const rejectedReason = rejected
            ? (!keesingAssessment.hasRequiredComponent ? "missing document/system component"
              : keesingAssessment.primarySubject === "unrelated" ? "keesing subject unrelated"
              : keesingAssessment.score < KEESING_RELEVANCE_THRESHOLD ? "below keesing threshold"
              : highConfidenceAssessment.rejectedReason || (primarySubject === "unrelated" ? "primary subject unrelated"
                : context.sports ? "sports"
                : context.pets ? "pets"
                : context.education ? "education"
                : context.unrelatedLifestyle ? "lifestyle"
                : context.entertainment ? "entertainment"
                : context.genericTravel ? "generic travel"
                : "low relevance"))
            : "";
          intelligenceDebug("[passport-context-filter]", {
            title: article?.title || "Untitled article",
            kept: !rejected,
            rejectedReason,
            score: relevance,
          });
          intelligenceDebug("[passport-relevance]", {
            title: article?.title || "Untitled article",
            score: highConfidenceAssessment.score,
            kept: !rejected,
            rejectedReason,
          });
          intelligenceDebug("[keesing-relevance]", {
            title: article?.title || "Untitled article",
            score: keesingAssessment.score,
            kept: !rejected,
            rejectedReason,
          });
          intelligenceDebug("[primary-passport-subject]", {
            title: article?.title || "Untitled article",
            primarySubject,
            kept: !rejected,
            rejectedReason,
          });
        }

        if (hasBanknoteKeyword) {
          const rejectedReason = !banknoteAssessment.kept ? banknoteAssessment.rejectedReason : "";
          intelligenceDebug("[banknote-relevance]", {
            title: article?.title || "Untitled article",
            score: banknoteAssessment.score,
            kept: banknoteAssessment.kept,
            rejectedReason,
          });
        }

        return !rejected;
      } catch (error) {
        console.warn("[passport-relevance-failsafe]", {
          title: article?.title || "Untitled article",
          message: error instanceof Error ? error.message : String(error),
        });
        return true;
      }
    })
    .filter(isUiRelevantIntelligenceArticle)
    .filter((article) => articleMatchesFilters(article, options))
    .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime());
  intelligenceTimeEnd("getVisibleArticles");
  return visibleArticles;
}

function getArticleCountLabel(count) {
  return `${count} article${count === 1 ? "" : "s"}`;
}

const ARTICLE_FINGERPRINT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "will",
  "with",
]);
const GROUPING_GENERIC_TOPIC_WORDS = new Set([
  "banknote",
  "banknotes",
  "note",
  "notes",
  "polymer",
  "passport",
  "passports",
  "id",
  "identity",
  "document",
  "documents",
  "digital",
  "biometric",
  "driver",
  "license",
  "licence",
  "release",
  "released",
  "update",
  "news",
  "new",
  "rollout",
  "system",
  "regulation",
  "regulations",
  "policy",
  "policies",
  "rule",
  "rules",
  "passport",
  "passports",
  "processing",
  "services",
  "office",
  "delay",
  "delays",
  "ranking",
  "index",
  "border",
  "control",
  "checks",
  "verification",
  "issuance",
  "renewal",
  "commemorative",
  "anniversary",
  "counterfeit",
  "security",
  "features",
  "design",
  "redesign",
]);
const GROUPING_EVENT_ENTITY_KEYWORDS = [
  ["armenia", ["armenia", "armenian"]],
  ["nigeria", ["nigeria", "nigerian"]],
  ["south-africa", ["south africa", "south african"]],
  ["ecowas", ["ecowas"]],
  ["pakistan", ["pakistan", "pakistani"]],
  ["kazakhstan", ["kazakhstan", "kazakh"]],
  ["rbi", ["rbi", "reserve bank of india"]],
  ["norges-bank", ["norges bank"]],
  ["state-department", ["state department"]],
  ["uk", ["united kingdom", "uk", "britain", "british"]],
  ["us", ["united states", "usa", "us", "american"]],
  ["canada", ["canada", "canadian"]],
  ["guatemala", ["guatemala", "quetzal"]],
  ["bangladesh", ["bangladesh", "bangladeshi", "taka"]],
];
const EVENT_FINGERPRINT_AGENCY_KEYWORDS = [
  ["state-department", ["state department"]],
  ["icao", ["icao"]],
  ["rbi", ["rbi", "reserve bank of india"]],
  ["norges-bank", ["norges bank"]],
  ["ministry-of-interior", ["ministry of interior"]],
  ["immigration-agency", ["immigration", "immigration agency"]],
  ["border-authority", ["border authority", "border control", "customs"]],
];
const EVENT_FINGERPRINT_SYSTEM_KEYWORDS = [
  ["ees", ["ees", "entry exit system", "entry/exit system"]],
  ["etias", ["etias"]],
  ["passport-revocation", ["passport revocation", "revocation", "child support"]],
  ["citizenship-law", ["citizenship law", "nationality law"]],
  ["biometric-checks", ["biometric checks", "biometric border checks"]],
  ["visa-waiver", ["visa waiver", "visa policy", "visa requirement"]],
  ["border-checks", ["border checks", "border control", "border crossing"]],
  ["passport-fraud", ["passport fraud", "forged passport", "fake passport"]],
  ["passport-issuance", ["passport issuance", "passport office", "passport renewal"]],
  ["digital-id", ["digital id", "eid", "identity system"]],
  ["icao", ["icao", "travel document security"]],
];
const EVENT_FINGERPRINT_ACTION_KEYWORDS = [
  ["rollout", ["rollout", "rolled out", "launched", "deployed", "implemented"]],
  ["suspension", ["suspension", "suspended"]],
  ["revocation", ["revocation", "revoked"]],
  ["fraud-warning", ["warning", "fraud warning", "warns against"]],
  ["court-ruling", ["court ruling", "court", "judge"]],
  ["law-update", ["law update", "regulation", "policy change", "directive"]],
  ["application-fees", ["application fee", "application fees", "passport fee"]],
  ["border-delays", ["border delays", "border queue", "queue"]],
  ["deportation", ["deportation", "deported"]],
  ["issuance", ["issuance", "issued", "passport issuance"]],
  ["renewal", ["renewal", "renewed", "passport renewal"]],
  ["counterfeiting", ["counterfeit", "forged passport", "fake passport"]],
];
const EVENT_FINGERPRINT_SUBJECT_KEYWORDS = [
  ["border-system", ["ees", "etias", "border control", "border checks", "entry exit system"]],
  ["citizenship-law", ["citizenship law", "nationality law"]],
  ["passport-fraud", ["passport fraud", "forged passport", "fake passport"]],
  ["immigration-enforcement", ["immigration enforcement", "deportation", "asylum"]],
  ["document-security", ["document security", "icao", "biometric"]],
  ["travel-advisory", ["travel advisory", "visa requirement", "entry requirements"]],
  ["airport-operations", ["airport", "border queue", "border delays"]],
];
const ARTICLE_TOPIC_TYPE_BANKNOTE_KEYWORDS = [
  "banknote",
  "banknotes",
  "currency note",
  "paper money",
  "legal tender",
  "central bank",
  "polymer note",
  "counterfeit note",
  "demonetization",
  "demonetisation",
  "withdrawn from circulation",
];
const ARTICLE_TOPIC_TYPE_IDENTITY_DOCUMENT_KEYWORDS = [
  "identity card",
  "id card",
  "national id",
  "biometric id",
  "identity document",
  "birth certificate",
  "residence permit",
];
const ARTICLE_TOPIC_TYPE_TRAVEL_PASSPORT_KEYWORDS = [
  "passport issuance",
  "passport renewal",
  "passport revocation",
  "passport services",
  "passport office",
  "state department passport",
  "biometric passport",
  "e-passport",
  "epassport",
];
const ARTICLE_TOPIC_TYPE_DIGITAL_IDENTITY_KEYWORDS = [
  "digital id",
  "eid",
  "electronic id",
  "mobile id",
  "identity verification",
];
const ARTICLE_TOPIC_TYPE_DRIVER_LICENSE_KEYWORDS = [
  "driver licence",
  "driver license",
  "drivers license",
  "driver's license",
  "dmv",
];
const ARTICLE_TOPIC_TYPE_NOISE_KEYWORDS = [
  "product passport",
  "digital product passport",
  "material passport",
  "pet passport",
  "farmers market passport",
  "skills passport",
  "talent passport",
  "road map passport",
  "roadmap passport",
  "stamp passport",
  "passport to freedom",
  "metaphorical passport",
  "shop listing",
  "auction",
  "ebay",
  "reddit collection",
  "tiktok collection",
  "favorite banknotes",
  "beautiful banknotes",
];
const PASSPORT_EVENT_TYPE_RULES = {
  passport_regulation: [
    "revoke",
    "revocation",
    "child support",
    "citizenship law",
    "passport rule",
    "passport law",
    "visa requirement",
    "immigration rule",
  ],
  passport_design: [
    "new passport design",
    "redesigned passport",
    "commemorative passport",
    "america250",
    "america 250",
    "portrait",
    "trump passport design",
    "passport book size",
  ],
  passport_fraud: [
    "fake passport",
    "false passport",
    "stolen identity",
    "passport fraud",
    "forged passport",
    "identity theft",
  ],
  passport_processing: [
    "passport services halted",
    "passport system failure",
    "passport renewal",
    "passport office",
    "processing delay",
    "appointment booking",
  ],
  passport_ranking: [
    "passport index",
    "passport ranking",
    "strongest passport",
    "weakest passport",
    "visa-free access",
  ],
  ees_border_control: [
    "ees",
    "entry/exit system",
    "eta",
    "etias",
    "biometric border checks",
    "passport stamps",
    "border delays",
  ],
  passport_noise: [
    "digital product passport",
    "product passport",
    "material passport",
    "pet passport",
    "farmers market passport",
    "skills passport",
    "talent passport",
    "cultural passport",
    "roadmap passport",
    "road map passport",
    "phone passport design",
    "foldable passport-style",
    "passport program",
    "passport scheme",
    "metaphorical passport",
  ],
};
const REAL_TRAVEL_DOCUMENT_POSITIVE_SIGNALS = [
  "visa",
  "citizenship",
  "immigration",
  "border",
  "customs",
  "etias",
  "ees",
  "passport office",
  "state department",
  "biometric checks",
  "travel document",
  "passport renewal",
  "entry requirements",
  "airport",
  "border crossing",
  "identity fraud",
  "nationality law",
  "passport revocation",
];
const PASSPORT_HARD_NOISE_KEYWORDS = [
  "digital product passport",
  "product passport",
  "material passport",
  "pet passport",
  "skills passport",
  "talent passport",
  "farmers market passport",
  "language passport",
  "passport-style foldable",
  "passport style foldable",
  "samsung passport-style",
  "cultural passport",
  "vaccine passport history",
  "metaphorical passport",
  "software passport",
  "health passport",
  "health passport systems",
  "product registry passport",
  "foldable",
  "samsung",
  "farmers market",
  "product registry",
  "supply chain",
  "coshh",
  "language initiative",
  "hospitality talent",
  "roadmap",
  "civic action",
  "hidden gems",
  "tmx",
  "product infrastructure",
  "material traceability",
  "passport program",
  "passport scheme",
  "phone passport",
  "tourism passport",
  "loyalty passport",
  "wellness passport",
  "event passport",
  "educational passport",
  "vaccine passport history",
  "power bank",
  "registry platform",
];
const GOVERNMENT_DOCUMENT_POSITIVE_SIGNALS = [
  ["passport office", 3],
  ["visa", 3],
  ["immigration", 3],
  ["citizenship", 3],
  ["border", 3],
  ["customs", 3],
  ["etias", 3],
  ["ees", 3],
  ["biometric checks", 3],
  ["travel document", 3],
  ["state department", 3],
  ["nationality law", 3],
  ["border crossing", 3],
  ["airport", 2],
  ["fraud", 2],
  ["revocation", 2],
  ["national id", 2],
  ["residence permit", 2],
];
const GOVERNMENT_DOCUMENT_NEGATIVE_SIGNALS = [
  ["product passport", -5],
  ["pet passport", -5],
  ["foldable", -5],
  ["supply chain", -5],
  ["hospitality", -5],
  ["market passport", -5],
  ["civic passport", -5],
  ["language passport", -5],
  ["wellness passport", -5],
  ["material passport", -5],
];
const IDENTITY_DOCUMENT_HIGH_RELEVANCE_SIGNALS = [
  "passport office",
  "border control",
  "immigration",
  "citizenship law",
  "visa",
  "etias",
  "ees",
  "biometric",
  "identity card",
  "residence permit",
  "travel document",
  "passport fraud",
  "forged passport",
  "counterfeiting",
  "document security",
  "border crossing",
  "customs",
  "state department",
  "icao",
  "ministry of interior",
  "passport issuance",
  "passport renewal",
  "passport revocation",
  "nationality law",
  "digital id",
  "eid",
  "kyc",
  "immigration enforcement",
];
const IDENTITY_DOCUMENT_MEDIUM_RELEVANCE_SIGNALS = [
  "airport",
  "travel restriction",
  "border queue",
  "entry exit system",
  "immigration policy",
  "deportation",
  "asylum",
  "visa waiver",
];
const IDENTITY_DOCUMENT_NEGATIVE_RELEVANCE_SIGNALS = [
  "celebrity",
  "influencer",
  "football",
  "soccer",
  "library",
  "tourism campaign",
  "fundraiser",
  "market",
  "event passport",
  "loyalty",
  "reward",
  "health campaign",
  "dna day",
  "hospitality",
  "entertainment",
  "reality tv",
  "wedding",
  "safari",
  "language passport",
  "mural passport",
  "civic passport",
];
const IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD = 3;
const IDENTITY_CONTEXT_KEYWORDS = {
  government: [
    "ministry",
    "government",
    "passport office",
    "state department",
    "citizenship",
    "nationality",
    "law",
    "regulation",
  ],
  border: [
    "border control",
    "border crossing",
    "customs",
    "airport border",
    "entry exit system",
    "ees",
    "etias",
    "biometric checks",
  ],
  immigration: [
    "immigration",
    "visa",
    "asylum",
    "deportation",
    "residency",
    "permit",
    "immigration enforcement",
  ],
  fraud: [
    "fraud",
    "passport fraud",
    "forged",
    "forged passport",
    "counterfeit",
    "revocation",
  ],
  security: [
    "icao",
    "biometric",
    "document security",
    "travel document",
    "identity",
    "digital id",
    "eid",
    "kyc",
  ],
  issuance: [
    "issuance",
    "passport issuance",
    "passport renewal",
    "passport revocation",
  ],
  infrastructure: [
    "identity system",
    "national id",
    "identity card",
    "residence permit",
    "digital id",
    "eid",
  ],
  travelRule: [
    "travel restriction",
    "visa policy",
    "entry requirements",
    "immigration policy",
    "visa waiver",
  ],
  unrelatedLifestyle: [
    "influencer",
    "celebrity",
    "wedding",
    "backpacker",
    "safari",
    "holiday advice",
    "vacation tips",
    "travel hacks",
    "tourist guide",
  ],
  sports: [
    "football",
    "soccer",
    "club",
    "player",
    "transfer",
    "coach",
    "match",
  ],
  pets: [
    "pet passport",
    "dog",
    "cat",
    "animal travel",
  ],
  entertainment: [
    "entertainment",
    "reality tv",
    "easter",
    "blog post",
    "generic health",
  ],
  education: [
    "study abroad",
    "university",
    "student exchange",
  ],
  genericTravel: [
    "travel lifestyle",
    "travel anecdote",
    "generic travel",
    "travel warning",
    "travel story",
  ],
};
const PRIMARY_PASSPORT_SUBJECT_RULES = {
  border_systems: [
    "ees",
    "etias",
    "entry exit system",
    "entry/exit system",
    "border control",
    "border checks",
    "biometric checks",
    "border crossing",
    "customs",
  ],
  immigration: [
    "immigration",
    "immigration enforcement",
    "asylum",
    "deportation",
    "entry requirements",
    "travel restriction",
  ],
  citizenship: [
    "citizenship",
    "citizenship law",
    "nationality law",
    "naturalization",
  ],
  passport_fraud: [
    "passport fraud",
    "forged passport",
    "fake passport",
    "false passport",
    "counterfeit",
    "identity theft",
  ],
  passport_issuance: [
    "passport office",
    "passport issuance",
    "passport renewal",
    "passport services",
    "appointment booking",
  ],
  passport_regulation: [
    "passport revocation",
    "visa policy",
    "visa",
    "law",
    "regulation",
    "state department",
    "revocation",
  ],
  identity_infrastructure: [
    "digital id",
    "eid",
    "identity card",
    "national id",
    "residence permit",
    "identity system",
    "travel document",
    "icao",
    "ministry of interior",
  ],
  visa_policy: [
    "visa policy",
    "visa waiver",
    "visa requirement",
    "visa rules",
  ],
  travel_document_security: [
    "document security",
    "biometric",
    "forged passport",
    "passport fraud",
    "travel document",
    "icao",
  ],
  unrelated: [
    "player",
    "football",
    "coach",
    "influencer",
    "wedding",
    "dna day",
    "healthcare",
    "language scheme",
    "fundraiser",
    "backpacker",
    "celebrity",
    "tourist tips",
    "workflow",
    "payroll",
    "software",
    "market",
    "scam empire",
    "shooting",
    "murder",
    "local politics",
    "study abroad",
    "university",
    "pet passport",
  ],
};
const PRIMARY_PASSPORT_SOURCE_POSITIVE_SIGNALS = [
  ".gov",
  "icao",
  "state department",
  "immigration",
  "border",
  "etias",
  "ees",
  "document security",
  "biometric",
  "identity",
];
const PRIMARY_PASSPORT_SOURCE_NEGATIVE_SIGNALS = [
  "celebrity",
  "gossip",
  "sports",
  "lifestyle",
  "workflow",
  "payroll",
  "software",
  "travel blog",
];
const HIGH_CONFIDENCE_PASSPORT_POSITIVE_SIGNALS = [
  "immigration",
  "border control",
  "etias",
  "ees",
  "visa",
  "citizenship",
  "nationality law",
  "passport office",
  "biometric",
  "identity card",
  "residence permit",
  "forged passport",
  "document fraud",
  "icao",
  "travel document",
  "issuance",
  "renewal",
  "revocation",
  "asylum",
  "customs",
  "border crossing",
  "state department",
  "ministry of interior",
  "digital id",
  "eid",
  "kyc",
];
const HIGH_CONFIDENCE_PASSPORT_NEGATIVE_SIGNALS = [
  "kidnapping",
  "murder",
  "celebrity",
  "influencer",
  "wedding",
  "safari",
  "reality tv",
  "scandal",
  "gossip",
  "football",
  "soccer",
  "basketball",
  "player",
  "coach",
  "transfer",
  "vacation",
  "tourist guide",
  "travel hacks",
  "holiday tips",
  "library funding",
  "local fundraiser",
  "school event",
  "easter message",
  "festival passport",
  "event passport",
  "death certificate",
  "generic legal drama",
  "family disputes",
  "court story",
];
const HIGH_CONFIDENCE_PASSPORT_THRESHOLD = 14;
const KEESING_POSITIVE_SIGNALS = {
  documentSecurity: [
    "forged passport",
    "counterfeit",
    "document fraud",
    "fake passport",
    "icao",
    "biometric verification",
    "eid",
    "digital id",
    "nfc verification",
    "border technology",
    "mrz",
    "identity verification",
  ],
  borderInfrastructure: [
    "etias",
    "ees",
    "border control",
    "biometric checks",
    "airport immigration",
    "customs systems",
    "entry exit system",
    "entry/exit system",
  ],
  issuanceRegulation: [
    "passport issuance",
    "renewal",
    "revocation",
    "nationality law",
    "citizenship law",
    "residence permit",
    "visa system",
    "visa systems",
    "passport office",
    "state department",
    "ministry of interior",
  ],
  identitySystems: [
    "national id",
    "digital identity",
    "kyc",
    "authentication",
    "government identity system",
    "government identity systems",
  ],
};
const KEESING_NEGATIVE_SIGNALS = {
  humanInterest: [
    "isis bride",
    "isis brides",
    "celebrity travel",
    "influencer",
    "wedding",
    "travel drama",
    "personal anecdote",
    "personal story",
  ],
  genericTravel: [
    "6 month passport rule",
    "six month passport rule",
    "holiday travel tips",
    "tourism advice",
    "travel hacks",
    "vacation planning",
    "travel tips",
    "tourist guide",
  ],
  genericCrime: [
    "shooting",
    "shootings",
    "kidnapping",
    "kidnappings",
    "terrorism",
    "military incident",
    "court case",
    "court story",
  ],
  genericPolitics: [
    "racial commentary",
    "geopolitical commentary",
    "activism",
    "activist",
  ],
};
const KEESING_HARD_KEEP_SIGNALS = [
  "forged passport",
  "fake documents",
  "border systems",
  "biometric border checks",
  "etias",
  "ees",
  "icao",
  "digital identity",
  "eid",
  "document fraud",
  "passport revocation",
  "nationality law",
  "citizenship law",
  "immigration systems",
  "visa systems",
  "airport biometric systems",
];
const KEESING_REQUIRED_COMPONENT_SIGNALS = [
  "issuance",
  "renewal",
  "revocation",
  "fraud",
  "document fraud",
  "forged passport",
  "fake passport",
  "counterfeit",
  "biometric",
  "biometric checks",
  "biometric verification",
  "border control",
  "border systems",
  "etias",
  "ees",
  "identity verification",
  "government identity system",
  "government identity systems",
  "passport office",
  "visa system",
  "visa systems",
  "digital identity",
  "eid",
  "icao",
];
const KEESING_RELEVANCE_THRESHOLD = 16;
const BANKNOTE_INTELLIGENCE_POSITIVE_SIGNALS = {
  centralBankActions: [
    "central bank",
    "withdrawn from circulation",
    "demonetisation",
    "demonetization",
    "legal tender withdrawal",
    "circulation changes",
    "issuance",
    "replacement series",
    "redesign",
    "new family",
    "new denomination",
    "polymer transition",
    "currency reform",
  ],
  securityCounterfeiting: [
    "counterfeit banknotes",
    "anti-counterfeit",
    "forged notes",
    "security feature",
    "hologram",
    "watermark",
    "polymer substrate",
    "uv features",
    "authentication",
    "cash security",
    "counterfeit alert",
  ],
  realDesignChanges: [
    "new portrait",
    "redesign",
    "new artwork",
    "substrate migration",
    "tactile features",
    "accessibility features",
    "anti-counterfeit redesign",
    "major redesign",
    "new banknote family",
  ],
  currencyInfrastructure: [
    "banknote printing",
    "currency production",
    "mint",
    "security printer",
    "de la rue",
    "giesecke+devrient",
    "giesecke devrient",
    "crane currency",
    "oberthur",
    "sicpa",
  ],
};
const BANKNOTE_INTELLIGENCE_NEGATIVE_SIGNALS = {
  collectorHobby: [
    "pcgs",
    "unc",
    "graded note",
    "auction",
    "collectible",
    "numismatic sales",
    "ebay",
    "rarity value",
    "serial number collecting",
    "pmg",
  ],
  socialCommunityNoise: [
    "reddit",
    "facebook repost",
    "youtube collector",
    "tiktok",
    "influencer video",
    "instagram collection",
  ],
  genericFinance: [
    "stock markets",
    "trade negotiations",
    "grain deals",
    "forex",
    "investment analysis",
    "economic commentary",
    "market trends",
  ],
  genericCrime: [
    "robbery cash seizure",
    "atm theft",
    "unrelated fraud",
    "scam story",
    "cash seizure",
  ],
  spam: [
    "linkedin",
    "market spam",
    "ai-generated market report",
    "app store",
    "currency printing market trends",
    "app listing",
  ],
};
const BANKNOTE_INTELLIGENCE_HARD_KEEP_SIGNALS = [
  "demonetisation",
  "demonetization",
  "legal tender withdrawal",
  "counterfeit alert",
  "central bank warning",
  "polymer migration",
  "major redesign",
  "anti-counterfeit technology",
  "circulation withdrawal",
  "currency reform",
  "security feature upgrade",
  "security feature upgrades",
  "new banknote family",
  "new banknote family launch",
  "new banknote family launches",
];
const BANKNOTE_INTELLIGENCE_HARD_REJECT_SIGNALS = [
  "collector listing",
  "grading post",
  "reddit collector",
  "hobby showcase",
  "generic finance news",
  "trade negotiations",
  "geopolitics",
  "market report",
  "app store",
  "app listing",
  "linkedin",
];
const BANKNOTE_REQUIRED_COMPONENT_SIGNALS = [
  "central bank",
  "withdrawn from circulation",
  "demonetisation",
  "demonetization",
  "legal tender withdrawal",
  "issuance",
  "replacement series",
  "redesign",
  "new family",
  "new denomination",
  "polymer transition",
  "counterfeit banknotes",
  "anti-counterfeit",
  "forged notes",
  "security feature",
  "hologram",
  "watermark",
  "polymer substrate",
  "authentication",
  "banknote printing",
  "currency production",
  "security printer",
  "de la rue",
  "giesecke+devrient",
  "crane currency",
  "oberthur",
  "sicpa",
];
const BANKNOTE_SIGNATURE_ONLY_SIGNALS = [
  "new sig/date",
  "new signature",
  "new date",
  "signature date",
  "confirmed",
  "prefix confirmed",
  "replacement batch confirmation",
];
const BANKNOTE_RELEVANCE_THRESHOLD = 14;
const BANKNOTE_EVENT_TYPE_RULES = {
  banknote_new_design: [
    "redesign",
    "redesigned",
    "new design",
    "design unveiled",
    "portrait change",
    "new banknote design",
  ],
  banknote_new_series: [
    "new series",
    "new banknote series",
    "new family",
    "new note family",
    "enter circulation",
    "enters circulation",
  ],
  banknote_signature_change: [
    "new sig/date",
    "new signature",
    "new date",
    "signature date",
    "confirmed",
  ],
  banknote_withdrawal: [
    "withdrawn",
    "withdrawal",
    "withdrawn from circulation",
    "out of circulation",
    "no longer legal tender",
    "legal tender until",
    "demonetized",
    "demonetised",
    "exchange deadline",
  ],
  counterfeit_banknotes: [
    "counterfeit",
    "fake banknote",
    "forged banknote",
    "fraud",
    "seizure",
    "fake notes",
    "counterfeit notes",
  ],
  commemorative_note: [
    "commemorative",
    "anniversary note",
    "centennial",
    "honouring",
    "honoring",
  ],
  polymer_transition: [
    "polymer",
    "plastic banknote",
    "substrate",
    "security feature",
    "windowed thread",
    "hologram",
  ],
  banknote_auction_noise: [
    "catalog",
    "shop",
    "for sale",
    "ebay",
    "pmg",
    "pcgs",
    "reddit",
    "tiktok",
    "instagram collection",
    "favorite banknotes",
    "beautiful banknotes",
  ],
};

function getArticleFingerprint(article) {
  const normalizedTitle = String(article?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalizedTitle
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !ARTICLE_FINGERPRINT_STOP_WORDS.has(token) && token.length > 2);

  return Array.from(new Set(tokens)).sort().join(" ");
}

function getArticleFingerprintTokens(article) {
  const fingerprint = getArticleFingerprint(article);
  return fingerprint ? fingerprint.split(/\s+/).filter(Boolean) : [];
}

function getArticleEntitySignature(article) {
  const haystack = getArticleSignalText(article);
  const entityKeywords = ["trump", "passport", "design", "id", "identity", "license", "licence", "visa"];
  return entityKeywords.filter((keyword) => textMatchesKeyword(haystack, keyword)).sort().join("|");
}

function getNormalizedGroupingText(article) {
  return getCachedArticleValue(article, "normalizedGroupingText", () =>
    [
      article?.title || "",
      article?.summary || "",
      article?.description || "",
      article?.source || "",
      article?.topic || "",
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
  );
}

function getDetectedEventEntity(article) {
  return getCachedArticleValue(article, "detectedEventEntity", () => {
    const feed = state.feeds.find((item) => item.id === article?.feedId);
    const feedCountry = normalizeCountry(article?.country || article?.region || getFeedCountry(feed));
    if (feedCountry) {
      return feedCountry;
    }

    const text = getNormalizedGroupingText(article);
    const matchedEntity = GROUPING_EVENT_ENTITY_KEYWORDS.find(([, keywords]) =>
      keywords.some((keyword) => textMatchesKeyword(text, keyword))
    );

    return matchedEntity ? matchedEntity[0] : "";
  });
}

function getMatchingFingerprintKeys(text, definitions) {
  return definitions
    .filter(([, keywords]) => keywords.some((keyword) => textMatchesKeyword(text, keyword)))
    .map(([key]) => key);
}

function getEventFingerprintTimeBucket(article) {
  const publishedAt = toDate(article?.pubDate);
  if (Number.isNaN(publishedAt.getTime())) {
    return "";
  }

  return publishedAt.toISOString().slice(0, 10);
}

function extractEventFingerprint(article) {
  return getCachedArticleValue(article, "eventFingerprint", () => {
    const text = getNormalizedGroupingText(article);
    const countries = Array.from(new Set([
      getDetectedEventEntity(article),
      ...getMatchingFingerprintKeys(text, GROUPING_EVENT_ENTITY_KEYWORDS),
    ].filter(Boolean)));
    const agencies = Array.from(new Set(getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_AGENCY_KEYWORDS)));
    const systems = Array.from(new Set(getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_SYSTEM_KEYWORDS)));
    const actionType = getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_ACTION_KEYWORDS)[0] || getDetailedArticleEventType(article) || "";
    const subjectType = getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_SUBJECT_KEYWORDS)[0]
      || (getPrimaryPassportSubject(article) !== "unrelated" ? getPrimaryPassportSubject(article) : getDetailedArticleEventType(article) || "");
    const timeBucket = getEventFingerprintTimeBucket(article);
    const keywords = getEventSpecificTerms(article, countries[0] || agencies[0] || "", 4);

    const fingerprint = {
      countries,
      agencies,
      systems,
      actionType,
      subjectType,
      timeBucket,
      keywords,
    };

    intelligenceDebug("[event-fingerprint]", {
      title: article?.title || "Untitled article",
      countries,
      systems,
      actionType,
      subjectType,
    });

    return fingerprint;
  });
}

function getFingerprintIntersection(leftValues, rightValues) {
  const rightSet = new Set(rightValues);
  return leftValues.filter((value) => rightSet.has(value));
}

function getEventFingerprintMatch(leftArticle, rightArticle) {
  return getCachedArticlePairValue(leftArticle, rightArticle, "eventFingerprintMatch", () => {
    const leftFingerprint = extractEventFingerprint(leftArticle);
    const rightFingerprint = extractEventFingerprint(rightArticle);
    let score = 0;

    const sharedCountries = getFingerprintIntersection(leftFingerprint.countries, rightFingerprint.countries);
    if (sharedCountries.length) {
      score += 4;
    } else if (leftFingerprint.countries.length && rightFingerprint.countries.length) {
      score -= 6;
    }

    const sharedAgencies = getFingerprintIntersection(leftFingerprint.agencies, rightFingerprint.agencies);
    if (sharedAgencies.length) {
      score += 3;
    }

    const sharedSystems = getFingerprintIntersection(leftFingerprint.systems, rightFingerprint.systems);
    if (sharedSystems.length) {
      score += 4;
    } else if (leftFingerprint.systems.length && rightFingerprint.systems.length) {
      score -= 5;
    }

    if (leftFingerprint.actionType && rightFingerprint.actionType) {
      score += leftFingerprint.actionType === rightFingerprint.actionType ? 3 : -4;
    }

    if (leftFingerprint.subjectType && rightFingerprint.subjectType) {
      score += leftFingerprint.subjectType === rightFingerprint.subjectType ? 3 : -4;
    }

    const sharedKeywords = getFingerprintIntersection(leftFingerprint.keywords, rightFingerprint.keywords);
    if (sharedKeywords.length) {
      score += 2;
    } else if (leftFingerprint.keywords.length && rightFingerprint.keywords.length) {
      score -= 2;
    }

    const leftDate = toDate(leftArticle?.pubDate);
    const rightDate = toDate(rightArticle?.pubDate);
    if (!Number.isNaN(leftDate.getTime()) && !Number.isNaN(rightDate.getTime())) {
      const dayDiff = Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff <= 14) {
        score += 2;
      } else if (dayDiff > 45) {
        score -= 2;
      }
    }

    const grouped = score >= 8;
    return {
      grouped,
      score,
      leftFingerprint,
      rightFingerprint,
    };
  });
}

function isSameEventFingerprint(leftArticle, rightArticle) {
  return getEventFingerprintMatch(leftArticle, rightArticle).grouped;
}

function getArticleEventType(article) {
  const text = getArticleSignalText(article);
  if (!text) {
    return "other";
  }

  if (["outage", "down", "unavailable", "service disruption", "service outage"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "service outage";
  }

  if (["tender", "procurement", "request for proposal", "rfp", "bid"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "tender/procurement";
  }

  if (["fraud", "counterfeit", "fake", "forged", "forgery", "scam"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "fraud/counterfeit";
  }

  if (["rollout", "rolled out", "launch", "launched", "deployed", "implemented"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "rollout";
  }

  if (["law", "regulation", "mandate", "policy", "directive", "compliance"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "regulation";
  }

  if (["security feature", "security features", "hologram", "watermark", "breach", "vulnerability"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "security";
  }

  if (["redesign", "redesigned", "new design", "new series", "new family", "portrait", "motif"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "design";
  }

  if (["digital id", "identity verification", "nfc", "chip", "platform", "verification system", "biometric system"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "technology";
  }

  if (["issued", "released", "unveiled", "introduced"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "release";
  }

  return "other";
}

function getEventSpecificTerms(article, entity = "", limit = 2) {
  const entityParts = new Set(String(entity || "").split(/[-\s]+/).filter(Boolean));
  const tokens = getNormalizedGroupingText(article)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 3)
    .filter((token) => !ARTICLE_FINGERPRINT_STOP_WORDS.has(token))
    .filter((token) => !GROUPING_GENERIC_TOPIC_WORDS.has(token))
    .filter((token) => !entityParts.has(token));

  return Array.from(new Set(tokens)).slice(0, limit);
}

function getDetailedArticleEventType(article) {
  return String(
    article?._intelligence?.eventType ||
      article?.eventType ||
      getArticleEventTypeForTopic(article, getArticleTopicType(article)) ||
      ""
  ).trim();
}

function getArticleGroupingTopicFamily(article) {
  const topicType = getArticleTopicType(article);
  switch (topicType) {
    case "banknote":
      return "banknote";
    case "travel_passport":
      return "travel_passport";
    case "identity_document":
    case "digital_identity":
    case "dmv_driver_license":
      return "identity_document";
    default:
      return "noise";
  }
}

function getBanknoteSignatureGroupingTerms(article, entity = "") {
  const text = getNormalizedGroupingText(article);
  const denominationMatch = text.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(peso|pesos|taka|rupee|rupees|dollar|dollars|euro|euros|quetzal|quetzales|dinar|dinars|leu|lei|naira|pound|pounds|rand)\b/i);
  const yearMatches = Array.from(new Set(text.match(/\b20\d{2}\b/g) || [])).slice(0, 2);
  const entityParts = String(entity || "").split(/[-\s]+/).filter(Boolean);

  const parts = [];
  if (denominationMatch) {
    parts.push(`${denominationMatch[1]}-${denominationMatch[2].toLowerCase()}`);
  }
  parts.push(...yearMatches);

  if (!parts.length) {
    parts.push(...getEventSpecificTerms(article, entityParts.join(" "), 2));
  }

  return Array.from(new Set(parts)).slice(0, 3);
}

function getBanknoteGroupingAnchors(article) {
  const text = getNormalizedGroupingText(article);
  const entity = getBanknoteEventCountry(article) || getDetectedEventEntity(article) || "";
  const denominationMatch = text.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(peso|pesos|taka|rupee|rupees|dollar|dollars|euro|euros|quetzal|quetzales|dinar|dinars|leu|lei|naira|pound|pounds|rand|lev|leva)\b/i);
  const yearMatches = Array.from(new Set(text.match(/\b20\d{2}\b/g) || [])).slice(0, 2);
  return {
    entity,
    denomination: denominationMatch ? `${denominationMatch[1]}-${String(denominationMatch[2]).toLowerCase()}` : "",
    yearFamily: yearMatches.join("-"),
    eventType: getDetailedArticleEventType(article),
  };
}

function getIdentityGroupingAnchors(article) {
  return {
    entity: getDetectedEventEntity(article) || "",
    eventType: getDetailedArticleEventType(article),
  };
}

function getConflictReason(leftArticle, rightArticle) {
  const leftTopicFamily = getArticleGroupingTopicFamily(leftArticle);
  const rightTopicFamily = getArticleGroupingTopicFamily(rightArticle);
  if (leftTopicFamily !== rightTopicFamily) {
    return "different topic family";
  }

  const leftEventType = getDetailedArticleEventType(leftArticle);
  const rightEventType = getDetailedArticleEventType(rightArticle);
  if (leftEventType !== rightEventType) {
    return "different event type";
  }

  if (leftTopicFamily === "travel_passport" || leftTopicFamily === "identity_document") {
    const leftIsRealTravelDocument = isRealTravelDocumentArticle(leftArticle);
    const rightIsRealTravelDocument = isRealTravelDocumentArticle(rightArticle);
    const leftRejectedBecauseNoise = isPassportNoiseArticle(leftArticle);
    const rightRejectedBecauseNoise = isPassportNoiseArticle(rightArticle);
    const leftConfidence = getGovernmentDocumentConfidence(leftArticle);
    const rightConfidence = getGovernmentDocumentConfidence(rightArticle);
    const leftLowRelevance = isLowRelevancePassportArticle(leftArticle);
    const rightLowRelevance = isLowRelevancePassportArticle(rightArticle);

    intelligenceDebug("[grouping validation]", {
      title: leftArticle?.title || "Untitled article",
      eventType: leftEventType,
      isRealTravelDocument: leftIsRealTravelDocument,
      rejectedBecauseNoise: leftRejectedBecauseNoise,
    });

    intelligenceDebug("[grouping validation]", {
      title: rightArticle?.title || "Untitled article",
      eventType: rightEventType,
      isRealTravelDocument: rightIsRealTravelDocument,
      rejectedBecauseNoise: rightRejectedBecauseNoise,
    });

    if (leftIsRealTravelDocument !== rightIsRealTravelDocument) {
      return "real vs noise passport domain mismatch";
    }

    if (Math.abs(leftConfidence - rightConfidence) > 6) {
      return "government-document confidence mismatch";
    }

    if (leftLowRelevance !== rightLowRelevance) {
      return "identity-document relevance mismatch";
    }

    if (
      leftEventType === "passport_noise" ||
      rightEventType === "passport_noise"
    ) {
      return "passport noise is isolated";
    }

    const leftAnchors = getIdentityGroupingAnchors(leftArticle);
    const rightAnchors = getIdentityGroupingAnchors(rightArticle);
    if (leftAnchors.entity && rightAnchors.entity && leftAnchors.entity !== rightAnchors.entity) {
      return "different passport entity";
    }
  }

  if (leftTopicFamily === "banknote") {
    if (
      leftEventType === "banknote_auction_noise" ||
      rightEventType === "banknote_auction_noise"
    ) {
      return "banknote auction noise is isolated";
    }

    const leftAnchors = getBanknoteGroupingAnchors(leftArticle);
    const rightAnchors = getBanknoteGroupingAnchors(rightArticle);

    if (leftAnchors.entity && rightAnchors.entity && leftAnchors.entity !== rightAnchors.entity) {
      return "different banknote entity";
    }

    if (leftEventType === "banknote_signature_change") {
      if (leftAnchors.denomination && rightAnchors.denomination && leftAnchors.denomination !== rightAnchors.denomination) {
        return "different signature-change denomination";
      }

      if (leftAnchors.yearFamily && rightAnchors.yearFamily && leftAnchors.yearFamily !== rightAnchors.yearFamily) {
        return "different signature-change year family";
      }
    }
  }

  const leftTerms = getEventSpecificTerms(leftArticle, getDetectedEventEntity(leftArticle), 3);
  const rightTerms = new Set(getEventSpecificTerms(rightArticle, getDetectedEventEntity(rightArticle), 3));
  const sharedTerms = leftTerms.filter((term) => rightTerms.has(term));
  if (!sharedTerms.length && leftTopicFamily !== "banknote") {
    return "no shared specific event terms";
  }

  const fingerprintMatch = getEventFingerprintMatch(leftArticle, rightArticle);
  intelligenceDebug("[group-score]", {
    titleA: leftArticle?.title || "Untitled article",
    titleB: rightArticle?.title || "Untitled article",
    score: fingerprintMatch.score,
    grouped: fingerprintMatch.grouped,
  });
  if (!fingerprintMatch.grouped) {
    return "event fingerprint mismatch";
  }

  return "";
}

function hasConflictingEventSignals(leftArticle, rightArticle) {
  return getCachedArticlePairValue(leftArticle, rightArticle, "conflictReason", () =>
    getConflictReason(leftArticle, rightArticle)
  );
}

function isIdentityLikeArticle(article) {
  const normalizedTopic = normalizeFilterTag(article?.topic || getFeedTopic(article?.feedId) || "");
  if (
    [
      "identity document",
      "passport",
      "driver license",
      "digital identity",
      "travel document",
      "document security",
      "border control",
      "verification",
    ].includes(normalizedTopic)
  ) {
    return true;
  }

  const text = getArticleSignalText(article);
  return [
    "passport",
    "identity document",
    "driver license",
    "digital id",
    "identity verification",
    "smart id",
  ].some((keyword) => textMatchesKeyword(text, keyword));
}

function getBanknoteEventType(article) {
  const text = getArticleSignalText(article);
  if (!text) {
    return "banknote_other";
  }

  if (
    [
      "catalog",
      "shop",
      "for sale",
      "ebay",
      "pmg",
      "pcgs",
      "reddit",
      "tiktok",
      "instagram collection",
      "favorite banknotes",
      "beautiful banknotes",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_auction_noise";
  }

  if (
    [
      "counterfeit",
      "fake banknote",
      "forged banknote",
      "fraud",
      "seizure",
      "fake notes",
      "counterfeit notes",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "counterfeit_banknotes";
  }

  if (
    [
      "new sig/date",
      "new signature",
      "new date",
      "signature date",
      "confirmed",
    ].some((keyword) => textMatchesKeyword(text, keyword)) || BANKNOTE_LOW_PRIORITY_CODE_PATTERN.test(text)
  ) {
    return "banknote_signature_change";
  }

  if (
    [
      "withdrawn",
      "withdrawal",
      "withdrawn from circulation",
      "demonetised",
      "demonetized",
      "out of circulation",
      "no longer legal tender",
      "legal tender until",
      "exchange deadline",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_withdrawal";
  }

  if (
    [
      "new banknote series",
      "new series",
      "new note family",
      "new family",
      "enter circulation",
      "enters circulation",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_new_series";
  }

  if (
    [
      "redesign",
      "redesigned",
      "new design",
      "design unveiled",
      "portrait change",
      "new banknote design",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_new_design";
  }

  if (
    [
      "commemorative",
      "anniversary note",
      "centennial",
      "honouring",
      "honoring",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "commemorative_note";
  }

  if (
    [
      "security feature",
      "polymer",
      "plastic banknote",
      "substrate",
      "windowed thread",
      "hologram",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "polymer_transition";
  }

  return "banknote_other";
}

function getArticleEventTypeForTopic(article, topicType = getArticleTopicType(article)) {
  switch (topicType) {
    case "banknote":
      return getBanknoteEventType(article);
    case "travel_passport":
      return getPassportEventType(article);
    case "identity_document":
    case "digital_identity":
    case "dmv_driver_license":
      return getArticleEventType(article);
    default:
      return "noise";
  }
}

function getBanknoteGroupingType(eventType) {
  switch (eventType) {
    case "banknote_signature_change":
    case "banknote_auction_noise":
      return "noise";
    case "banknote_withdrawal":
      return "regulation";
    case "banknote_new_design":
    case "banknote_new_series":
    case "commemorative_note":
      return "design";
    case "polymer_transition":
      return "security";
    case "counterfeit_banknotes":
      return "fraud/counterfeit";
    default:
      return "";
  }
}

function getBanknoteEventCountry(article) {
  const feed = state.feeds.find((item) => item.id === article?.feedId);
  const feedCountry = normalizeCountry(article?.country || article?.region || getFeedCountry(feed));
  if (feedCountry) {
    return feedCountry;
  }

  const text = getArticleSignalText(article);
  if (!text) {
    return "";
  }

  const countryKeywords = [
    ["uk", ["united kingdom", "uk", "britain", "british"]],
    ["us", ["united states", "usa", "us", "american"]],
    ["kazakhstan", ["kazakhstan", "kazakh"]],
    ["bangladesh", ["bangladesh", "bangladeshi", "taka"]],
    ["guatemala", ["guatemala", "quetzal"]],
    ["india", ["india", "indian", "rupee"]],
    ["pakistan", ["pakistan", "pakistani", "rupee"]],
    ["philippines", ["philippines", "philippine", "peso"]],
    ["romania", ["romania", "romanian", "leu"]],
    ["eurozone", ["eurozone", "euro area"]],
  ];

  const matchedCountry = countryKeywords.find(([, keywords]) =>
    keywords.some((keyword) => textMatchesKeyword(text, keyword))
  );

  return matchedCountry ? matchedCountry[0] : "";
}

function getIdentityEventKey(article) {
  return getCachedArticleValue(article, "identityEventKey", () => {
    const normalizedText = [
      article?.title || "",
      article?.summary || "",
      article?.description || "",
      article?.source || "",
    ]
      .join(" ")
      .toLowerCase();

    const hasTrumpPassportReleaseNoise = [
      "caitlyn",
      "jenner",
      "gender",
      "trans",
      "transgender",
      "immigration",
      "shutdown",
      "tsa",
      "study abroad",
      "cuba",
      "oil blockade",
      "population growth",
    ].some((keyword) => normalizedText.includes(keyword));

    const isTrumpPassportReleaseStory =
      normalizedText.includes("trump") &&
      (normalizedText.includes("passport") || normalizedText.includes("passports")) &&
      [
        "design",
        "release",
        "released",
        "unveiled",
        "state department",
        "america250",
        "america 250",
        "250th",
        "commemorative",
        "anniversary",
        "portrait",
        "face",
        "image",
        "signature",
        "patriot passport",
      ].some((keyword) => normalizedText.includes(keyword));

    if (isTrumpPassportReleaseStory && !hasTrumpPassportReleaseNoise) {
      return "identity_trump_passport_release";
    }

    const topicFamily = getArticleGroupingTopicFamily(article);
    const eventType = getDetailedArticleEventType(article);
    const detectedEntity = topicFamily === "banknote" ? getBanknoteEventCountry(article) : getDetectedEventEntity(article);

    if (topicFamily === "banknote") {
      if (!eventType || eventType === "banknote_other" || eventType === "banknote_auction_noise") {
        return getArticleFingerprint(article) || "";
      }

      const banknoteTerms = eventType === "banknote_signature_change"
        ? getBanknoteSignatureGroupingTerms(article, detectedEntity)
        : getEventSpecificTerms(article, detectedEntity, 2);

      if (!detectedEntity && !banknoteTerms.length) {
        return getArticleFingerprint(article) || "";
      }

      return `${topicFamily}-${eventType}-${detectedEntity || "generic"}-${banknoteTerms.join("-") || "generic"}`;
    }

    if (topicFamily === "identity_document" || topicFamily === "travel_passport") {
      if (
        !eventType ||
        eventType === "other" ||
        eventType === "travel_passport_other" ||
        eventType === "passport_noise" ||
        eventType === "noise"
      ) {
        return getArticleFingerprint(article) || "";
      }

      const identityTerms = getEventSpecificTerms(article, detectedEntity, 2);
      if (!detectedEntity && !identityTerms.length) {
        return getArticleFingerprint(article) || "";
      }

      return `${topicFamily}-${eventType}-${detectedEntity || "generic"}-${identityTerms.join("-") || "generic"}`;
    }

    const fingerprint = getArticleFingerprint(article);
    if (!fingerprint) {
      return "";
    }

    const fingerprintTokens = getArticleFingerprintTokens(article);
    const entitySignature = getArticleEntitySignature(article);
    const coreTokens = fingerprintTokens.slice(0, 6).join(" ");
    return entitySignature || coreTokens || fingerprint;
  });
}

function groupArticlesByEvent(articles) {
  intelligenceTime("groupArticlesByEvent");
  const grouped = {};

  articles.forEach((article, index) => {
    const eventKey = getIdentityEventKey(article);
    const key = eventKey || `single_${index}`;

    if (!grouped[key]) {
      grouped[key] = [];
    }

    const matchingGroup = grouped[key].find((group) => {
      const primary = group[0];
      const conflictReason = hasConflictingEventSignals(primary, article);
      if (conflictReason) {
        intelligenceDebug("[grouping conflict]", {
          leftTitle: primary?.title || "Untitled article",
          rightTitle: article?.title || "Untitled article",
          leftEventType: getDetailedArticleEventType(primary),
          rightEventType: getDetailedArticleEventType(article),
          reason: conflictReason,
        });
        return false;
      }

      return true;
    });

    if (matchingGroup) {
      matchingGroup.push(article);
      return;
    }

    grouped[key].push([article]);
  });

  const groupedArticles = Object.values(grouped).flatMap((bucket) => bucket).map((group) => {
    const primary = group[0];
    if (group.length > 1) {
      intelligenceLog("GROUPED EVENT", {
        title: primary?.title || "Untitled article",
        eventType: getDetailedArticleEventType(primary),
        groupedCount: group.length,
      });
    }

    return {
      ...primary,
      sources: group,
      sourceCount: group.length,
      groupedArticlesCount: Math.max(0, group.length - 1),
    };
  });
  intelligenceTimeEnd("groupArticlesByEvent");
  return groupedArticles;
}

function updateArticleFilterContext(articles) {
  if (!elements.articleFilterContext) {
    return;
  }

  const countLabel = getArticleCountLabel(articles.length);
  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];

  if (exactArticleIds.length) {
    const alertLabel = state.filters.alertLabel || `${exactArticleIds.length} selected articles`;
    elements.articleFilterContext.textContent = `Showing ${countLabel} from alert: ${alertLabel}`;
    elements.articleFilterContext.hidden = false;
    return;
  }

  const contextParts = [];
  if (state.filters.feedId) {
    contextParts.push(`feed: ${getSelectedOptionText(elements.feedFilter) || "Selected feed"}`);
  }
  if (state.filters.dmvFeedId) {
    contextParts.push(`USA feed: ${getSelectedOptionText(elements.dmvFeedFilter) || "Selected state"}`);
  } else if (state.dashboardMode === "usa") {
    contextParts.push("USA feeds");
  }
  if (state.filters.canadaDmvFeedPath) {
    contextParts.push(`Canada feed: ${getSelectedOptionText(elements.canadaDmvFilter) || "Selected province"}`);
  } else if (state.filters.canadaDmvAll) {
    contextParts.push("all Canada DMV");
  } else if (state.dashboardMode === "canada") {
    contextParts.push("Canada feeds");
  }
  if (state.filters.topic) {
    contextParts.push(`topic: ${state.filters.topic}`);
  }
  if (state.filters.tag) {
    contextParts.push(`tag: ${state.filters.tag}`);
  }
  if (state.filters.signalCategory) {
    contextParts.push(
      `signal: ${getSignalCategoryById(state.filters.signalCategory)?.label || state.filters.signalCategory}`
    );
  }
  if (state.filters.date) {
    contextParts.push(`date: ${state.filters.date}`);
  }
  if (state.filters.search) {
    contextParts.push(`search: ${state.filters.search}`);
  }

  elements.articleFilterContext.hidden = !contextParts.length;
  elements.articleFilterContext.textContent = contextParts.length
    ? `Showing ${countLabel} for ${contextParts.join(" + ")}`
    : "";
}

function getGroupedArticleStateKey(article) {
  return String(
    article?.id ||
      article?.canonicalLink ||
      article?.link ||
      article?.title ||
      `${article?.feedId || "feed"}-${article?.pubDate || "date"}`
  );
}

function getGroupedArticleSources(article) {
  if (!Array.isArray(article?.sources) || article.sources.length < 2) {
    return [];
  }

  const primaryKey = getGroupedArticleStateKey(article);
  return article.sources.filter((sourceArticle, index) => {
    if (!sourceArticle) {
      return false;
    }

    if (index === 0 && getGroupedArticleStateKey(sourceArticle) === primaryKey) {
      return false;
    }

    return true;
  });
}

function rerenderGroupedArticleCard(article) {
  const stateKey = getGroupedArticleStateKey(article);
  const selectorKey = window.CSS?.escape ? window.CSS.escape(stateKey) : stateKey.replace(/["\\]/g, "\\$&");
  const existingCard = elements.articlesGrid?.querySelector(`.article-card[data-article-state-key="${selectorKey}"]`);
  if (!existingCard) {
    return;
  }

  const nextNode = renderArticleCard(article);
  const nextCard = nextNode.firstElementChild || nextNode.firstChild;
  if (!nextCard) {
    return;
  }

  existingCard.replaceWith(nextCard);
}

function toggleGroupedArticleSources(article) {
  const groupedSources = getGroupedArticleSources(article);
  if (!groupedSources.length) {
    return;
  }

  const stateKey = getGroupedArticleStateKey(article);
  const selectorKey = window.CSS?.escape ? window.CSS.escape(stateKey) : stateKey.replace(/["\\]/g, "\\$&");
  const card = elements.articlesGrid?.querySelector(`.article-card[data-article-state-key="${selectorKey}"]`);
  if (!card) {
    return;
  }

  const sourcePanel = card.querySelector(".grouped-sources-inline");
  const toggleButton = card.querySelector(".article-duplicate-badge");
  if (!sourcePanel || !toggleButton) {
    return;
  }

  const isExpanded = !sourcePanel.hidden;
  const nextExpanded = !isExpanded;

  sourcePanel.hidden = !nextExpanded;
  card.classList.toggle("article-card--sources-expanded", nextExpanded);
  toggleButton.setAttribute("aria-expanded", String(nextExpanded));
  toggleButton.title = nextExpanded ? "Hide grouped sources" : "Show grouped sources";

  if (nextExpanded) {
    runtime.expandedGroupedSourceKeys.add(stateKey);
  } else {
    runtime.expandedGroupedSourceKeys.delete(stateKey);
    runtime.fullyExpandedGroupedSourceKeys.delete(stateKey);
  }

  intelligenceDebug("[source-toggle]", {
    key: stateKey,
    expanded: nextExpanded,
  });
}

function toggleGroupedArticleSourceList(article) {
  const groupedSources = getGroupedArticleSources(article);
  if (groupedSources.length <= 12) {
    return;
  }

  return;
}

function renderArticleCard(article) {
  const node = elements.articleCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".article-card");
  const link = node.querySelector(".article-link");
  const image = node.querySelector(".article-image");
  const topic = node.querySelector(".article-topic");
  const source = node.querySelector(".article-source");
  const date = node.querySelector(".article-date");
  const title = node.querySelector(".article-title");
  const feed = node.querySelector(".article-feed");
  const body = node.querySelector(".article-body");
  const meta = node.querySelector(".article-meta");
  const finalImageSrc = getArticleImageSrc(article);
  const primarySignalCategory = getPrimaryArticleSignalCategory(article);
  const groupedSources = getGroupedArticleSources(article);
  const articleStateKey = getGroupedArticleStateKey(article);
  const isGroupedSourcesExpanded = runtime.expandedGroupedSourceKeys.has(articleStateKey);

  card.dataset.articleStateKey = articleStateKey;

  if (card && isGroupedSourcesExpanded && groupedSources.length) {
    card.classList.add("article-card--sources-expanded");
  }

  link.href = article.canonicalLink || article.link;
  image.src = finalImageSrc || PLACEHOLDER_IMAGE;
  image.alt = article.title || "Article thumbnail";
  image.loading = "lazy";
  image.decoding = "async";
  image.onerror = () => {
    image.onerror = null;
    image.alt = "No image available";
    image.src = PLACEHOLDER_IMAGE;
  };

  topic.textContent = article.topic || "General";
  source.textContent = article.source || "Unknown source";
  date.textContent = formatDate(article.pubDate);
  title.textContent = article.title || "Untitled article";
  feed.textContent = getFeedName(article.feedId);

  if (meta && primarySignalCategory) {
    const signalBadge = document.createElement("span");
    signalBadge.className = "article-signal-badge";
    signalBadge.textContent = getPrimaryArticleSignalLabel(primarySignalCategory);
    meta.appendChild(signalBadge);
  }

  if (meta && Number(article?.sourceCount || 0) > 1) {
    const duplicateBadge = groupedSources.length ? document.createElement("button") : document.createElement("span");
    duplicateBadge.className = "article-duplicate-badge";
    duplicateBadge.textContent = `+ ${article.sourceCount} sources`;

    if (groupedSources.length) {
      duplicateBadge.type = "button";
      duplicateBadge.title = isGroupedSourcesExpanded ? "Hide grouped sources" : "Show grouped sources";
      duplicateBadge.setAttribute("aria-expanded", String(isGroupedSourcesExpanded));
      duplicateBadge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleGroupedArticleSources(article);
      });
    }

    meta.appendChild(duplicateBadge);
  }

  if (body && groupedSources.length) {
    const sourcePanel = document.createElement("div");
    sourcePanel.className = "grouped-sources-inline";
    sourcePanel.hidden = !isGroupedSourcesExpanded;
    const visibleGroupedSources = groupedSources;

    visibleGroupedSources.forEach((sourceArticle) => {
      const row = document.createElement("div");
      row.className = "grouped-source-item";

      const header = document.createElement("div");
      header.className = "grouped-source-meta";
      header.textContent = [sourceArticle.source || "Unknown source", formatDate(sourceArticle.pubDate)]
        .filter(Boolean)
        .join(" • ");

      const sourceTitle = document.createElement("div");
      sourceTitle.className = "grouped-source-title";
      sourceTitle.textContent = sourceArticle.title || "Untitled article";

      row.append(header, sourceTitle);

      const sourceLink = sourceArticle.canonicalLink || sourceArticle.link;
      if (sourceLink) {
        const openLink = document.createElement("a");
        openLink.className = "grouped-source-open";
        openLink.href = sourceLink;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.textContent = "Open";
        openLink.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        row.appendChild(openLink);
      }

      sourcePanel.appendChild(row);
    });

    body.appendChild(sourcePanel);
  }

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
  if (elements.paginationControls) {
    elements.paginationControls.hidden = true;
  }
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

function getPaginationContextKey() {
  return JSON.stringify({
    dashboardMode: state.dashboardMode,
    filters: state.filters,
    analyticsScope: state.analyticsScope,
    analyticsQualityFilter: state.analyticsQualityFilter,
  });
}

function ensurePaginationState() {
  if (!state.pagination || typeof state.pagination !== "object") {
    state.pagination = {
      page: 1,
      pageSize: ARTICLE_RENDER_PAGE_SIZE,
    };
  }

  const nextPage = Math.max(1, Number(state.pagination.page) || 1);
  const nextPageSize = Math.max(1, Number(state.pagination.pageSize) || ARTICLE_RENDER_PAGE_SIZE);
  state.pagination.page = nextPage;
  state.pagination.pageSize = nextPageSize;
  return state.pagination;
}

function syncPaginationContext() {
  ensurePaginationState();
  const nextContextKey = getPaginationContextKey();
  if (runtime.paginationContextKey !== nextContextKey) {
    runtime.paginationContextKey = nextContextKey;
    state.pagination.page = 1;
  }
}

function getPaginatedItems(items) {
  const paginationState = ensurePaginationState();
  const totalCount = Array.isArray(items) ? items.length : 0;
  const pageSize = Math.max(1, Number(paginationState.pageSize) || ARTICLE_RENDER_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, Number(paginationState.page) || 1), totalPages);
  state.pagination.page = currentPage;

  const startIndex = totalCount ? (currentPage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  return {
    items: Array.isArray(items) ? items.slice(startIndex, endIndex) : [],
    totalCount,
    pageSize,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
  };
}

function ensurePaginationControlsElement() {
  let container = document.getElementById("pagination-controls");
  if (!container && elements.articlesGrid?.parentElement) {
    container = document.createElement("div");
    container.id = "pagination-controls";
    container.className = "pagination-controls";
    elements.articlesGrid.insertAdjacentElement("afterend", container);
  }

  elements.paginationControls = container;
  return container;
}

function renderPaginationControls(pagination) {
  const container = ensurePaginationControlsElement();
  if (!container) {
    return;
  }

  const totalItems = Number(pagination?.totalCount) || 0;
  const page = Number(pagination?.currentPage) || 1;
  const totalPages = Number(pagination?.totalPages) || 1;
  const startDisplay = totalItems ? (Number(pagination?.startIndex) || 0) + 1 : 0;
  const endDisplay = Number(pagination?.endIndex) || 0;

  container.innerHTML = `
    <div class="pagination-summary">
      <span class="pagination-range">Showing ${startDisplay}-${endDisplay} of ${totalItems}</span>
      <span class="pagination-status">Page ${page} of ${totalPages}</span>
    </div>
    <div class="pagination-actions">
      <button class="ghost-button pagination-button" type="button" data-pagination-action="prev">Previous</button>
      <button class="ghost-button pagination-button" type="button" data-pagination-action="next">Next</button>
    </div>
  `;

  container.hidden = totalItems === 0;
  if (totalItems === 0) {
    return;
  }

  container.removeAttribute("hidden");
  elements.paginationRange = container.querySelector(".pagination-range");
  elements.paginationStatus = container.querySelector(".pagination-status");
  elements.paginationPrev = container.querySelector('[data-pagination-action="prev"]');
  elements.paginationNext = container.querySelector('[data-pagination-action="next"]');

  if (elements.paginationPrev) {
    elements.paginationPrev.disabled = page <= 1;
    elements.paginationPrev.onclick = () => {
      if (state.pagination.page <= 1) {
        return;
      }

      state.pagination.page -= 1;
      scheduleRenderArticles("pagination-prev");
    };
  }

  if (elements.paginationNext) {
    elements.paginationNext.disabled = page >= totalPages;
    elements.paginationNext.onclick = () => {
      if (state.pagination.page >= totalPages) {
        return;
      }

      state.pagination.page += 1;
      scheduleRenderArticles("pagination-next");
    };
  }

  console.warn("PAGINATION UI RENDERED", {
    page,
    totalPages,
    totalItems,
  });
}

function getSelectedFeedLabel() {
  return String(elements.feedFilter?.selectedOptions?.[0]?.textContent || "").trim();
}

function logFeedFilterDiagnostics(selectedFeedId, selectedFeedLabel, rawMatches, groupedMatches, renderedCount = 0) {
  if (!selectedFeedId) {
    return;
  }

  const firstTitles = rawMatches
    .slice(0, 10)
    .map((article) => article?.title || "Untitled article");

  console.info("[feed-filter-diagnostics]", {
    selectedFeedId,
    selectedFeedLabel,
    rawMatchesBeforeRelevance: rawMatches.length,
    matchesAfterRelevance: groupedMatches.length,
    renderedCount,
    firstMatchingTitles: firstTitles,
  });
}

function finalizeRenderDiagnostics(payload = {}) {
  const renderedCardCount = document.querySelectorAll(".article-card").length;
  const maxRenderedCards = 30;
  const branchName = payload.branchName || "default";
  const total = Number(payload.total) || 0;
  const page = Number(payload.page) || 1;
  const pageSize = Number(payload.pageSize) || 30;
  const totalPages = Number(payload.totalPages) || 1;

  console.warn("cards rendered", renderedCardCount);
  console.warn("pagination", {
    total,
    page,
    pageSize,
    rendered: renderedCardCount,
  });
  console.warn("pagination rendered", {
    page,
    totalPages,
    renderedCards: renderedCardCount,
  });

  if (renderedCardCount > maxRenderedCards) {
    console.error("HARD CAP FAILED", {
      branchName,
      renderedCardCount,
      maxRenderedCards,
    });
  }
}

function logRenderingPageArticlesOnly(groupedArticlesCount, pageArticles) {
  console.warn("RENDERING PAGE ARTICLES ONLY", {
    groupedArticlesCount,
    pageArticlesCount: Array.isArray(pageArticles) ? pageArticles.length : 0,
  });
}

function normalizeFeedMatchValue(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }

  return text
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFeedMatchDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const normalizedUrl = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();
    return hostname;
  } catch {
    return "";
  }
}

function addFeedMatchTokens(tokenSet, value) {
  const normalized = normalizeFeedMatchValue(value);
  if (!normalized) {
    return;
  }

  tokenSet.add(normalized);

  const domain = getFeedMatchDomain(value);
  if (domain) {
    tokenSet.add(domain);
    const hostParts = domain.split(".");
    if (hostParts.length > 2) {
      tokenSet.add(hostParts.slice(-2).join("."));
    }
  }
}

function getSelectedFeedMatchTokens(feedId) {
  const tokens = new Set();
  const selectedFeed = state.feeds.find((feed) => feed.id === feedId);

  [
    feedId,
    selectedFeed?.id,
    selectedFeed?.name,
    selectedFeed?.title,
    selectedFeed?.feedTitle,
    selectedFeed?.source,
    selectedFeed?.sourceName,
    selectedFeed?.rssUrl,
    selectedFeed?.officialUrl,
    selectedFeed?.url,
    selectedFeed?.siteUrl,
    selectedFeed?.homepage,
  ].forEach((value) => addFeedMatchTokens(tokens, value));

  const combined = Array.from(tokens).join(" ");
  if (combined.includes("banknotenews")) {
    ["banknotenews", "banknotenews.com", "owen linzmayer"].forEach((value) =>
      addFeedMatchTokens(tokens, value)
    );
  }

  if (combined.includes("notafilia")) {
    ["news.notafilia.pl", "notafilia.pl", "notafilia"].forEach((value) => addFeedMatchTokens(tokens, value));
  }

  return tokens;
}

function getArticleFeedMatchTokens(article) {
  const tokens = new Set();

  const addArticleTokens = (item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    [
      item.feedId,
      item.feed,
      item.source,
      item.sourceName,
      item.feedTitle,
      item.link,
      item.url,
      item.canonicalLink,
    ].forEach((value) => addFeedMatchTokens(tokens, value));

    const derivedFeed = item.feedId ? state.feeds.find((feed) => feed.id === item.feedId) : null;
    [
      derivedFeed?.id,
      derivedFeed?.name,
      derivedFeed?.title,
      derivedFeed?.feedTitle,
      derivedFeed?.source,
      derivedFeed?.sourceName,
      derivedFeed?.rssUrl,
      derivedFeed?.officialUrl,
      derivedFeed?.url,
      derivedFeed?.siteUrl,
      derivedFeed?.homepage,
    ].forEach((value) => addFeedMatchTokens(tokens, value));
  };

  addArticleTokens(article);
  if (Array.isArray(article?.sources)) {
    article.sources.forEach(addArticleTokens);
  }

  const combined = Array.from(tokens).join(" ");
  if (combined.includes("banknotenews")) {
    ["banknotenews", "banknotenews.com", "owen linzmayer"].forEach((value) =>
      addFeedMatchTokens(tokens, value)
    );
  }

  if (combined.includes("notafilia")) {
    ["news.notafilia.pl", "notafilia.pl", "notafilia"].forEach((value) => addFeedMatchTokens(tokens, value));
  }

  return tokens;
}

function articleMatchesSelectedFeed(article, feedId) {
  if (!feedId) {
    return true;
  }

  const selectedTokens = getSelectedFeedMatchTokens(feedId);
  const articleTokens = getArticleFeedMatchTokens(article);

  if (!selectedTokens.size || !articleTokens.size) {
    return article?.feedId === feedId;
  }

  return Array.from(selectedTokens).some((selectedToken) => {
    return Array.from(articleTokens).some((articleToken) => {
      if (!selectedToken || !articleToken) {
        return false;
      }

      return (
        selectedToken === articleToken ||
        articleToken.includes(selectedToken) ||
        selectedToken.includes(articleToken)
      );
    });
  });
}

function groupedArticleMatchesFeedFilter(article, feedId) {
  return articleMatchesSelectedFeed(article, feedId);
}

function renderArticlesFallback(error) {
  console.warn("[render-articles-fallback]", {
    message: error instanceof Error ? error.message : String(error),
  });

  ensurePaginationState();

  let fallbackAllArticles = [];
  try {
    const shouldIgnoreFeedIdForGrouping = Boolean(state.filters?.feedId) && !state.filters?.date;
    fallbackAllArticles = state.filters?.date
      ? state.articles.filter(articleMatchesFilters).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      : state.filters?.feedId
        ? (() => {
            const rawFeedMatches = state.articles
              .filter((article) => articleMatchesSelectedFeed(article, state.filters.feedId))
              .filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }))
              .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            return groupArticlesByEvent(rawFeedMatches);
          })()
        : (() => {
          const visibleArticles = getVisibleArticles({ ignoreFeedId: shouldIgnoreFeedIdForGrouping });
          const groupedArticles = groupArticlesByEvent(visibleArticles);
          return shouldIgnoreFeedIdForGrouping
            ? groupedArticles.filter((article) => groupedArticleMatchesFeedFilter(article, state.filters.feedId))
            : groupedArticles;
        })();
  } catch (innerError) {
    console.warn("[render-articles-fallback-inner]", {
      message: innerError instanceof Error ? innerError.message : String(innerError),
    });
    fallbackAllArticles = state.articles
      .filter((article) => {
        try {
          return articleMatchesFilters(article);
        } catch (_error) {
          return true;
        }
      })
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }

  const fallbackPagination = getPaginatedItems(fallbackAllArticles);
  const MAX_RENDERED_ARTICLES = 30;
  const fallbackPageArticles = Array.isArray(fallbackPagination.items) ? fallbackPagination.items : [];
  const articlesToRender = fallbackPageArticles.slice(0, MAX_RENDERED_ARTICLES);

  if (elements.resultsCount) {
    elements.resultsCount.textContent = `${fallbackPagination.totalCount} results`;
  }

  if (elements.articlesGrid) {
    elements.articlesGrid.classList.remove("is-grouped-feed-view");
    elements.articlesGrid.innerHTML = "";

    if (!articlesToRender.length) {
      elements.articlesGrid.innerHTML = `<div class="empty-state">No articles match the active filters.</div>`;
    } else {
      const fragment = document.createDocumentFragment();
      articlesToRender.forEach((article) => {
        fragment.appendChild(renderArticleCard(article));
      });
      elements.articlesGrid.appendChild(fragment);
    }
  }

  renderPaginationControls(fallbackPagination);

  const renderedCards = document.querySelectorAll(".article-card").length;
  console.warn("pagination", {
    total: fallbackAllArticles.length,
    page: fallbackPagination.currentPage,
    pageSize: fallbackPagination.pageSize,
    rendered: renderedCards,
  });
  console.warn("pagination rendered", {
    page: fallbackPagination.currentPage,
    totalPages: fallbackPagination.totalPages,
    renderedCards,
  });
  if (renderedCards > 30) {
    console.error("HARD CAP FAILED", renderedCards);
  }
}

function renderArticles() {
  intelligenceTime("renderArticles");
  try {
    intelligenceTime("renderArticles:filter-group");
    syncPaginationContext();
    let articles;
    const shouldIgnoreFeedIdForGrouping = Boolean(state.filters.feedId) && !state.filters.date;
    const totalRawArticles = Array.isArray(state.articles) ? state.articles.length : 0;
    let filteredRawArticles = [];
    let groupedArticlesCount = 0;
    const activeFeedId = state.filters.feedId || "";
    const activeFeedLabel = getSelectedFeedLabel();
    let feedDebugRawMatches = [];
    let feedDebugAfterRelevanceMatches = [];

    if (activeFeedId && !state.filters.date) {
      feedDebugRawMatches = state.articles
        .filter((article) => articleMatchesSelectedFeed(article, activeFeedId))
        .filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }))
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      feedDebugAfterRelevanceMatches = getVisibleArticles({ ignoreFeedId: true })
        .filter((article) => articleMatchesSelectedFeed(article, activeFeedId));
      filteredRawArticles = feedDebugRawMatches;
      const groupedArticles = groupArticlesByEvent(feedDebugRawMatches);
      groupedArticlesCount = groupedArticles.length;
      articles = groupedArticles;
    } else if (state.filters.date) {
      filteredRawArticles = state.articles
        .filter(articleMatchesFilters)
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      articles = filteredRawArticles;
      groupedArticlesCount = articles.length;
    } else {
      const visibleArticles = getVisibleArticles({ ignoreFeedId: shouldIgnoreFeedIdForGrouping });
      filteredRawArticles = visibleArticles;
      const groupedArticles = groupArticlesByEvent(visibleArticles);
      groupedArticlesCount = groupedArticles.length;
      articles = shouldIgnoreFeedIdForGrouping
        ? groupedArticles.filter((article) => groupedArticleMatchesFeedFilter(article, state.filters.feedId))
        : groupedArticles;
    }

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
    updateArticleFilterContext(articles);
    const articlePagination = getPaginatedItems(articles);
    const pageArticles = Array.isArray(articlePagination.items)
      ? articlePagination.items.slice(0, ARTICLE_RENDER_PAGE_SIZE)
      : [];
    const MAX_RENDERED_ARTICLES = 30;
    const articlesToRender = Array.isArray(pageArticles)
      ? pageArticles.slice(0, MAX_RENDERED_ARTICLES)
      : Array.isArray(articles)
        ? articles.slice(0, MAX_RENDERED_ARTICLES)
        : [];

    if (activeFeedId) {
      logFeedFilterDiagnostics(
        activeFeedId,
        activeFeedLabel,
        feedDebugRawMatches,
        feedDebugAfterRelevanceMatches,
        articlesToRender.length
      );
    }
    intelligenceTimeEnd("renderArticles:filter-group");

    const renderDiagnostics = {
      branchName: "feed-filter",
      total: articles.length,
      page: articlePagination.currentPage,
      pageSize: articlePagination.pageSize,
      totalPages: articlePagination.totalPages,
    };

    if (state.filters.feedId) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.remove("is-grouped-feed-view");
      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        elements.articlesGrid.innerHTML =
          `<div class="empty-state">No articles match the active filters.</div>`;
        renderPaginationControls(articlePagination);
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      const fragment = document.createDocumentFragment();
      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      articlesToRender.forEach((article) => {
        fragment.appendChild(renderArticleCard(article));
      });
      elements.articlesGrid.appendChild(fragment);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    if ((selectedUsDmvEntry || selectedCanadaEntry) && !state.filters.feedId) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.remove("is-grouped-feed-view");
      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        renderDmvEmptyState(
          isUsLinkOnlyEntry(selectedUsDmvEntry) || isCanadaLinkOnlyEntry(selectedCanadaEntry)
            ? "No RSS feed available for this DMV."
            : "No news available",
          selectedDmvOfficialUrl
        );
        renderPaginationControls(articlePagination);
        renderDiagnostics.branchName = "selected-dmv-empty";
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      const fragment = document.createDocumentFragment();
      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      articlesToRender.forEach((article) => {
        fragment.appendChild(renderArticleCard(article));
      });
      elements.articlesGrid.appendChild(fragment);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      renderDiagnostics.branchName = "selected-dmv";
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    if (state.dashboardMode === "usa" && !getActiveArticleFeedId()) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.add("is-grouped-feed-view");
      const dmvFeeds = getUsDmvFeeds();
      const articlesByFeedId = new Map();

      articlesToRender.forEach((article) => {
        const items = articlesByFeedId.get(article.feedId) || [];
        items.push(article);
        articlesByFeedId.set(article.feedId, items);
      });

      const visibleFeedIds = new Set(articlesToRender.map((article) => article.feedId).filter(Boolean));
      const visibleFeeds = dmvFeeds.filter((feed) => visibleFeedIds.has(feed.id));

      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        elements.articlesGrid.innerHTML =
          `<div class="empty-state">No articles match the active filters.</div>`;
        renderPaginationControls(articlePagination);
        renderDiagnostics.branchName = "usa-grouped-empty";
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      const fragment = document.createDocumentFragment();
      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      visibleFeeds.forEach((feed) => {
        const feedArticles = articlesByFeedId.get(feed.id) || [];
        const groupCards = feedArticles.length
          ? feedArticles.map((article) => renderArticleCard(article))
          : [renderDmvPlaceholderCard(feed)];
        fragment.appendChild(renderFeedGroup(feed.name || "Untitled feed", groupCards));
      });
      elements.articlesGrid.appendChild(fragment);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      renderDiagnostics.branchName = "usa-grouped";
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    if (state.dashboardMode === "canada" && !state.filters.canadaDmvFeedPath) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.add("is-grouped-feed-view");
      const canadaEntries = getCanadaDmvCatalogEntries();
      const articlesByFeedId = new Map();

      articlesToRender.forEach((article) => {
        const items = articlesByFeedId.get(article.feedId) || [];
        items.push(article);
        articlesByFeedId.set(article.feedId, items);
      });

      const visibleFeedIds = new Set(articlesToRender.map((article) => article.feedId).filter(Boolean));
      const visibleEntries = canadaEntries.filter((entry) => {
        const feed = getFeedForCatalogEntry(entry);
        return feed ? visibleFeedIds.has(feed.id) : false;
      });

      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        elements.articlesGrid.innerHTML =
          `<div class="empty-state">No imported news available for Canada DMV entries yet.</div>`;
        renderPaginationControls(articlePagination);
        renderDiagnostics.branchName = "canada-grouped-empty";
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      const fragment = document.createDocumentFragment();
      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      visibleEntries.forEach((entry) => {
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
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      renderDiagnostics.branchName = "canada-grouped";
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    intelligenceTime("renderArticles:dom-update");
    elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
    elements.articlesGrid.classList.remove("is-grouped-feed-view");
    elements.articlesGrid.innerHTML = "";

    if (!articlePagination.totalCount) {
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
      renderPaginationControls(articlePagination);
      renderDiagnostics.branchName = "default-empty";
      intelligenceTimeEnd("renderArticles:dom-update");
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    const fragment = document.createDocumentFragment();

    logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
    articlesToRender.forEach((article) => {
      fragment.appendChild(renderArticleCard(article));
    });

    elements.articlesGrid.appendChild(fragment);
    renderPaginationControls(articlePagination);
    intelligenceTimeEnd("renderArticles:dom-update");
    renderDiagnostics.branchName = state.filters.feedId ? "feed-filter" : "default";
    finalizeRenderDiagnostics(renderDiagnostics);
  } catch (error) {
    renderArticlesFallback(error);
  } finally {
    intelligenceTimeEnd("renderArticles");
  }
}

function renderDashboard() {
  renderSummary();
  renderFeedOptions();
  renderTagManager();
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
  runtime.articleComputationCache.clear();
  runtime.articlePairComputationCache.clear();
  state.feeds = feeds;
  const normalizedArticles = articles.map(normalizeLoadedArticle);

  state.articles = normalizedArticles;
  state.dmvCatalog = Array.isArray(dmvCatalog) ? dmvCatalog : [];
  restoreExactArticleFilterFromSession();
  syncDashboardAlerts(feeds, normalizedArticles);
  syncActivityLog();
  renderDashboard();
  syncNewArticleNotifications(normalizedArticles);
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
  const debouncedSearchRender = debounce((value) => {
    clearExactArticleFilter();
    state.filters.search = value;
    scheduleRenderArticles("search-filter", { mode: "frame" });
  }, 250);

  elements.searchFilter.addEventListener("input", (event) => {
    debouncedSearchRender(event.target.value.trim());
  });

  elements.topicFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.topic = event.target.value;
    scheduleRenderArticles("topic-filter", { mode: "frame" });
  });

  if (elements.tagFilter) {
    elements.tagFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.tag = normalizeFilterTag(event.target.value);
      scheduleRenderArticles("tag-filter", { mode: "frame" });
    });
  }

  if (elements.signalFilter) {
    elements.signalFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.signalCategory = String(event.target.value || "").trim();
      scheduleRenderArticles("signal-filter", { mode: "frame" });
    });
  }

  if (elements.tagAddButton) {
    elements.tagAddButton.addEventListener("click", addTagFromInput);
  }

  if (elements.tagAddInput) {
    elements.tagAddInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      addTagFromInput();
    });
  }

  if (elements.tagManagerToggle) {
    elements.tagManagerToggle.addEventListener("click", () => {
      state.tagManagerExpanded = !state.tagManagerExpanded;
      syncTagManagerVisibility();
    });
  }

  if (elements.tagResetButton) {
    elements.tagResetButton.addEventListener("click", () => {
      resetActiveTags();
      refreshTagControls();
    });
  }

  if (elements.tagManagerList) {
    elements.tagManagerList.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-remove-tag]") : null;
      if (!target) {
        return;
      }

      if (target.dataset.confirmRemove !== "true") {
        elements.tagManagerList.querySelectorAll("[data-confirm-remove='true']").forEach((button) => {
          button.dataset.confirmRemove = "false";
          button.textContent = "remove";
          button.setAttribute("aria-label", `Prepare to remove ${button.dataset.removeTag || "tag"}`);
        });
        target.dataset.confirmRemove = "true";
        target.textContent = "confirm";
        target.setAttribute("aria-label", `Confirm removing ${target.dataset.removeTag || "tag"}`);
        return;
      }

      removeActiveTag(target.dataset.removeTag || "");
    });
  }

  if (elements.keywordToggle) {
    elements.keywordToggle.addEventListener("click", () => {
      state.noiseKeywordsExpanded = !state.noiseKeywordsExpanded;
      window.localStorage.setItem(NOISE_KEYWORDS_EXPANDED_STORAGE_KEY, String(state.noiseKeywordsExpanded));
      syncNoiseKeywordVisibility();
    });
  }

  [elements.includeKeywordsInput, elements.excludeKeywordsInput].forEach((input) => {
    input?.addEventListener("change", applyKeywordInputs);
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      applyKeywordInputs();
    });
  });

  if (elements.keywordResetButton) {
    elements.keywordResetButton.addEventListener("click", () => {
      resetKeywordFilters();
      scheduleRenderArticles("keyword-reset", { mode: "frame" });
    });
  }

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
    scheduleRenderArticles("feed-filter", { mode: "frame" });
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
      scheduleRenderArticles("dmv-feed-filter", { mode: "frame" });
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
      scheduleRenderArticles("canada-dmv-filter", { mode: "frame" });
    });
  }

  elements.dateFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.date = event.target.value;
    renderSummary();
    scheduleRenderArticles("date-filter", { mode: "frame" });
  });

  elements.paginationPrev?.addEventListener("click", () => {
    if (state.pagination.page <= 1) {
      return;
    }

    state.pagination.page -= 1;
    scheduleRenderArticles("pagination-prev", { mode: "frame" });
  });

  elements.paginationNext?.addEventListener("click", () => {
    state.pagination.page += 1;
    scheduleRenderArticles("pagination-next", { mode: "frame" });
  });

  elements.summaryGrid.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const dismissButton = target?.closest("[data-dismiss-dashboard-alert]");
    if (dismissButton) {
      dismissDashboardAlert(dismissButton.dataset.dismissDashboardAlert || "");
      return;
    }

    const dismissActivityButton = target?.closest("[data-dismiss-activity-item]");
    if (dismissActivityButton) {
      dismissActivityItem(dismissActivityButton.dataset.dismissActivityItem || "");
      return;
    }

    const clearActivityButton = target?.closest("[data-clear-activity-log]");
    if (clearActivityButton) {
      clearActivityLog();
      return;
    }

    const analyticsScopeTarget = getAnalyticsScopeTargetFromEvent(event);
    if (analyticsScopeTarget) {
      state.analyticsScope = analyticsScopeTarget.dataset.analyticsScope === "active" ? "active" : "all";
      renderSummary();
      return;
    }

    const analyticsQualityFilterTarget = getAnalyticsQualityFilterTargetFromEvent(event);
    if (analyticsQualityFilterTarget) {
      const nextFilter = analyticsQualityFilterTarget.dataset.analyticsQualityFilter || "all";
      state.analyticsQualityFilter = ["high", "inactive", "zero"].includes(nextFilter) ? nextFilter : "all";
      renderSummary();
      return;
    }

    const dashboardAlertTarget = getDashboardAlertTargetFromEvent(event);
    if (dashboardAlertTarget) {
      const alert = runtime.dashboardAlerts.find((item) => item.id === dashboardAlertTarget.dataset.alertId);
      applyAlertArticleFilter(alert);
      return;
    }

    const activityTarget = getActivityLogTargetFromEvent(event);
    if (activityTarget) {
      const activityItem = runtime.activityLog.find((item) => item.id === activityTarget.dataset.activityId);
      applyActivityItemFilter(activityItem);
      return;
    }

    const analyticsFeedTarget = getAnalyticsFeedTargetFromEvent(event);
    if (analyticsFeedTarget) {
      applyAnalyticsFeedFilter({
        feedId: analyticsFeedTarget.dataset.analyticsFeedId || "",
        todayOnly: analyticsFeedTarget.dataset.analyticsTodayOnly === "true",
      });
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

    const activityTarget = getActivityLogTargetFromEvent(event);
    if (activityTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const activityItem = runtime.activityLog.find((item) => item.id === activityTarget.dataset.activityId);
      applyActivityItemFilter(activityItem);
      return;
    }

    const analyticsFeedTarget = getAnalyticsFeedTargetFromEvent(event);
    if (analyticsFeedTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      applyAnalyticsFeedFilter({
        feedId: analyticsFeedTarget.dataset.analyticsFeedId || "",
        todayOnly: analyticsFeedTarget.dataset.analyticsTodayOnly === "true",
      });
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
      tag: "",
      signalCategory: "",
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
    resetKeywordFilters();
    state.dashboardMode = "normal";

    elements.searchFilter.value = "";
    elements.topicFilter.value = "";
    if (elements.tagFilter) {
      elements.tagFilter.value = "";
    }
    if (elements.signalFilter) {
      elements.signalFilter.value = "";
    }
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
    scheduleRenderArticles("clear-filters", { mode: "frame" });
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
      scheduleRenderArticles("usa-dashboard-toggle", { mode: "frame" });
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
      scheduleRenderArticles("canada-dashboard-toggle", { mode: "frame" });
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
  console.info("APP_BUILD", APP_BUILD);
  loadTheme();
  loadActiveTags();
  loadKeywordFilters();
  runtime.activityLog = SHOW_ACTIVITY_LOG ? loadStoredActivityLog() : [];
  runtime.activityLogId = SHOW_ACTIVITY_LOG
    ? runtime.activityLog.reduce((maxId, entry) => Math.max(maxId, Number(entry.id) || 0), 0)
    : 0;
  state.noiseKeywordsExpanded = isNoiseKeywordsExpanded();
  state.feedPanelCollapsed = isFeedPanelCollapsed();
  resetDashboardState();
  syncFeedFormMode();
  bindEvents();
  renderSkeletons();
  syncNoiseKeywordVisibility();
  await loadSnapshot();
  syncNoiseKeywordVisibility();
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
