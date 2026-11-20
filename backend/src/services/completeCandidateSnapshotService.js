import { randomBytes } from "node:crypto";

export class CandidateSnapshotError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CandidateSnapshotError";
    this.code = code;
  }
}

function defaultSnapshotId() {
  return randomBytes(32).toString("base64url");
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function serveCompleteCandidateSnapshotRequest({
  store,
  scopeKey,
  candidateSnapshotId,
  page,
  limit,
  buildItems,
}) {
  if (!store || typeof store.create !== "function" || typeof store.readPage !== "function") {
    throw new TypeError("A candidate snapshot store is required.");
  }
  const snapshotId = String(candidateSnapshotId || "").trim();
  if (snapshotId) {
    const snapshotPage = store.readPage({ id: snapshotId, scopeKey, page, limit });
    const isFinalPage = snapshotPage.pagination.page >= snapshotPage.pagination.totalPages;
    if (isFinalPage) store.delete(snapshotId);
    return { ...snapshotPage, candidateSnapshotId: isFinalPage ? "" : snapshotId };
  }

  if (typeof buildItems !== "function") {
    throw new TypeError("A candidate snapshot builder is required for the first page.");
  }
  const items = await buildItems();
  const created = store.create({ scopeKey, items });
  const snapshotPage = store.readPage({ id: created.id, scopeKey, page, limit });
  const isFinalPage = snapshotPage.pagination.page >= snapshotPage.pagination.totalPages;
  if (isFinalPage) store.delete(created.id);
  return { ...snapshotPage, candidateSnapshotId: isFinalPage ? "" : created.id };
}

export function createCompleteCandidateSnapshotStore(options = {}) {
  const ttlMs = normalizePositiveInteger(options.ttlMs, 60_000);
  const maxSnapshots = normalizePositiveInteger(options.maxSnapshots, 16);
  const maxItems = normalizePositiveInteger(options.maxItems, 5_000);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const createId = typeof options.createId === "function" ? options.createId : defaultSnapshotId;
  const maxIdAttempts = Math.min(10, normalizePositiveInteger(options.maxIdAttempts, 3));
  const snapshots = new Map();

  function purgeExpired() {
    const currentTime = now();
    for (const [id, snapshot] of snapshots.entries()) {
      if (snapshot.expiresAt <= currentTime) snapshots.delete(id);
    }
  }

  function create({ scopeKey, items }) {
    purgeExpired();
    const normalizedScopeKey = String(scopeKey || "").trim();
    const normalizedItems = Array.isArray(items) ? items.slice() : [];
    if (!normalizedScopeKey) {
      throw new CandidateSnapshotError("CANDIDATE_SNAPSHOT_SCOPE_INVALID", "Candidate snapshot scope is required.");
    }
    if (normalizedItems.length > maxItems) {
      throw new CandidateSnapshotError(
        "CANDIDATE_SNAPSHOT_LIMIT",
        `Candidate snapshot exceeds the configured maximum of ${maxItems} items.`
      );
    }
    if (snapshots.size >= maxSnapshots) {
      throw new CandidateSnapshotError(
        "CANDIDATE_SNAPSHOT_CAPACITY",
        "Candidate snapshot capacity is temporarily exhausted."
      );
    }

    let id = "";
    for (let attempt = 0; attempt < maxIdAttempts; attempt += 1) {
      const candidateId = String(createId() || "").trim();
      if (candidateId && !snapshots.has(candidateId)) {
        id = candidateId;
        break;
      }
    }
    if (!id) {
      throw new CandidateSnapshotError(
        "CANDIDATE_SNAPSHOT_TOKEN_GENERATION_FAILED",
        "Candidate snapshot token generation failed."
      );
    }

    const expiresAt = now() + ttlMs;
    snapshots.set(id, {
      scopeKey: normalizedScopeKey,
      items: normalizedItems,
      expiresAt,
    });
    return { id, expiresAt };
  }

  function readPage({ id, scopeKey, page = 1, limit = 1 }) {
    purgeExpired();
    const snapshot = snapshots.get(String(id || "").trim());
    if (!snapshot) {
      throw new CandidateSnapshotError(
        "CANDIDATE_SNAPSHOT_UNAVAILABLE",
        "Candidate snapshot is unavailable or expired. Restart the query."
      );
    }
    if (snapshot.scopeKey !== String(scopeKey || "").trim()) {
      throw new CandidateSnapshotError(
        "CANDIDATE_SNAPSHOT_SCOPE_MISMATCH",
        "Candidate snapshot does not match this query scope."
      );
    }

    const normalizedLimit = normalizePositiveInteger(limit, 1);
    const total = snapshot.items.length;
    const totalPages = Math.max(1, Math.ceil(total / normalizedLimit));
    const normalizedPage = Math.min(totalPages, normalizePositiveInteger(page, 1));
    const offset = (normalizedPage - 1) * normalizedLimit;
    return {
      items: snapshot.items.slice(offset, offset + normalizedLimit),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages,
      },
      expiresAt: snapshot.expiresAt,
    };
  }

  function remove(id) {
    snapshots.delete(String(id || "").trim());
  }

  return Object.freeze({
    create,
    readPage,
    delete: remove,
    purgeExpired,
    size: () => {
      purgeExpired();
      return snapshots.size;
    },
  });
}
