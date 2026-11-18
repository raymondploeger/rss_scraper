# Complete-candidate snapshots

`completeCandidates=true` is used by active personal-profile retrieval paths that must evaluate policy against the entire retrieved candidate pool, rather than a bounded frontend snapshot.

## Protocol

1. The first paginated request has `completeCandidates=true` and no `candidateSnapshotId`.
2. The backend loads candidates once in bounded database batches, canonical-dedupes them, and stores the result in a process-local snapshot.
3. The response includes an opaque `candidateSnapshotId`.
4. Later pages send the same filters plus that ID. They read the existing snapshot and do not rebuild the database candidate set. The backend frees the snapshot after the final page; single-page results are freed immediately.

Snapshot IDs are 32 random bytes encoded as base64url. A snapshot is bound to a SHA-256 fingerprint of the normalized query scope; using it with different filters returns `409 CANDIDATE_SNAPSHOT_SCOPE_MISMATCH`.

## Bounds and failures

The backend has fixed, configurable bounds:

- `COMPLETE_CANDIDATE_SNAPSHOT_TTL_MS` (default: 60 seconds)
- `COMPLETE_CANDIDATE_SNAPSHOT_MAX_SNAPSHOTS` (default: 16)
- `COMPLETE_CANDIDATE_SNAPSHOT_MAX_ITEMS` (default: 2,000 deduped items)
- `COMPLETE_CANDIDATE_SNAPSHOT_MAX_CANDIDATES` (default: 5,000 raw candidates scanned)
- `COMPLETE_CANDIDATE_SNAPSHOT_BATCH_SIZE` (default: 200)

A bound is never converted into a partial successful result. The API returns a code instead:

| Code | HTTP | Meaning |
| --- | --- | --- |
| `CANDIDATE_SNAPSHOT_SOURCE_LIMIT` | 413 | More raw candidates matched than the configured scan bound. |
| `CANDIDATE_SNAPSHOT_LIMIT` | 413 | The deduped snapshot exceeds the configured item bound. |
| `CANDIDATE_SNAPSHOT_CAPACITY` | 503 | The process has reached its active snapshot capacity. |
| `CANDIDATE_SNAPSHOT_TOKEN_GENERATION_FAILED` | 503 | The process could not allocate a unique opaque token within its fixed attempt bound. |
| `CANDIDATE_SNAPSHOT_UNAVAILABLE` | 409 | Snapshot expired, was evicted, or was lost after a restart. |
| `CANDIDATE_SNAPSHOT_SCOPE_MISMATCH` | 409 | Token was reused with a different request scope. |

The client does not automatically retry a failed snapshot request, preventing retry loops and repeated full scans. A user-initiated refresh starts a fresh snapshot.

## Railway and multi-instance limitation

Snapshots are intentionally in-memory only: no Redis, database table, migration, or external state is required. Therefore they are unavailable after a Railway restart and are not shared between application instances. A load-balanced later-page request can receive `CANDIDATE_SNAPSHOT_UNAVAILABLE`; this is safe and explicit rather than returning another candidate set or silently omitting items. Scaling beyond a single instance requires shared snapshot storage and a separate architecture decision.

Default feeds, ordinary progressive search, Wishlist, and non-complete canonical-deduped requests do not use this protocol.
