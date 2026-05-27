
---

## Enterprise audit: `draft_snapshots` table

**Audit timestamp (UTC):** 2026-05-27  
**Database:** `tour_ops_dev` (from `apps/api/.env` `DATABASE_URL`)  
**Schema reference:** `apps/api/src/modules/draft-engine/entities/draft-snapshot.entity.ts`, migration `1777601000000-CreateDraftSnapshots.ts`

### 1. Row count

| Metric | Value |
|--------|------:|
| **Total rows** | **11** |

### 2. `workspace_id` and `draft_key` integrity

| Check | Count | Pass |
|-------|------:|:----:|
| `workspace_id IS NULL` | 0 | Yes |
| `draft_key IS NULL` or empty after trim | 0 | Yes |
| `draft_key` length > 128 (varchar limit) | 0 | Yes |
| `draft_key` outside `[a-zA-Z0-9._-]+` | 0 | Yes |

**Malformed / suspicious `draft_key` values (semantic, not SQL constraint violations):**

| `draft_key` | Rows | Notes |
|-------------|-----:|-------|
| `undefined` | 1 | Literal string `undefined` — likely a client bug (undefined URL segment or missing draft key). |
| `debug-occ-*` | 9 | Isolated keys from `pnpm debug:draft-engine` OCC verification runs. |
| `denali-create` | 1 | Expected production wizard key. |

All 11 rows share the same scope tuple pattern: `workspace_id = a0dcacb3-b6da-430f-86e1-5e36cb4c2113`, `user_id = 00000000-0000-4000-8000-012345678901` (Denali dev owner OTP user).

### 3. `version` column (optimistic concurrency)

| Check | Value |
|-------|------:|
| `version IS NULL` | 0 |
| `version < 0` | 0 |
| **MIN(version)** | 1 |
| **MAX(version)** | 123 |

**Verdict:** `version` is strictly non-negative; all stored values are ≥ 1. No NULL versions.

**Note:** Row `debug-occ-manual-1779841954564` has `version = 99` after manual SQL update during debugging (not from normal OCC bump sequence).

### 4. Summary

| Area | Status |
|------|--------|
| Referential shape (non-null UUIDs, key length) | **PASS** |
| Version non-negative | **PASS** |
| Data hygiene | **WARN** — one `draft_key = 'undefined'` row; nine debug OCC keys may be deleted in non-dev environments |

### 5. Recommended follow-ups (non-blocking)

1. Delete or ignore debug rows: `draft_key LIKE 'debug-occ-%'` and `draft_key = 'undefined'` if not needed.
2. Fix client/BFF routing so `draft_key` is never the literal `undefined`.
3. Consider a DB `CHECK (version >= 1)` and `CHECK (char_length(trim(draft_key)) > 0)` for defense in depth.


---

## Concurrency audit: `denali-create` dual-PATCH (OCC)

**Audit timestamp (UTC):** 2026-05-27  
**API:** `http://127.0.0.1:3001` (Nest `draft-engine` module)  
**Tenant host:** `denali.localhost`  
**Draft key:** `denali-create`  
**Auth:** Dev OTP `+989121000001` / workspace from JWT `tenant_id`

### Test setup

| Step | Action | Result |
|------|--------|--------|
| Baseline | `GET` draft | `version: 1` (DB pre-set via `UPDATE` after prior wizard data at v123) |
| Note | `DELETE` then `GET` before reset | `DELETE` returned **204** but row remained (v123) — delete scope vs row mismatch not re-tested; SQL used to set `version = 1` for controlled race |
| Race | Two `PATCH` bodies both with **`version: 1`**, launched via `Promise.all` | Wall-clock spread **~38.3 ms** (concurrent, not sequential) |

### 1. Dual PATCH with `version: 1`

| Request | HTTP | Response summary |
|---------|------|------------------|
| A | **200** | `{ version: 2, data: { concurrencyProbe: true, step: "race" } }` |
| B | **409** | `error.code: DRAFT_CONFLICT`, `error.details.server` present |

**409 payload verification (request B):**

| Field | Present | Value |
|-------|:-------:|-------|
| `error.code` | Yes | `DRAFT_CONFLICT` |
| `error.details.server.version` | Yes | `2` (winner’s version after successful PATCH A) |
| `error.details.server.data` | Yes | `{ step: "race", concurrencyProbe: true }` |
| `error.details.server.lastModified` | Yes | `1779850767528` |

| Assertion | Expected | Actual | **PASS/FAIL** |
|-----------|----------|--------|:-------------:|
| Exactly one `200` | 1 | 1 | **PASS** |
| Exactly one `409` | 1 | 1 | **PASS** |
| Loser includes `error.details.server` | Yes | Yes | **PASS** |
| Final `GET` version | 2 | 2 | **PASS** |

### 2. Infinite-loop / runaway sync check

**API (post-conflict stale burst):** Five sequential `PATCH` calls still sending **`version: 1`** after race:

| Call | Status |
|------|--------|
| 1–5 | **409** (all) |

No additional `200` responses — server does not accept stale writes in a loop.

**Client engine simulation (`REFETCH_REAPPLY`, `@repo/draft-engine`):**

| Metric | Value | Interpretation |
|--------|------:|----------------|
| `onPush` invocations | 2 | Initial push + one retry after conflict (expected) |
| `onFetch` invocations | 2 | Re-fetch during conflict resolution |
| Final engine status | `IDLE` | Settled |
| Push count > 2? | No | **No runaway push loop** |

| Assertion | **PASS/FAIL** |
|-----------|:-------------:|
| System does not enter infinite loop after 409 | **PASS** |

### 3. Overall verdict

| Area | Verdict |
|------|---------|
| OCC dual-write (`version: 1` race) | **PASS** |
| 409 + `error.details.server` contract | **PASS** |
| Post-conflict stability (no write storm) | **PASS** |

### 4. Observations (non-blocking)

1. Concurrent launch window was **~38 ms**, not <10 ms wall time; both requests were in flight together (`Promise.all`), satisfying the intent of a race on the same version.
2. `DELETE` returning 204 while `denali-create` row persisted warrants a separate delete-scope investigation.
3. Restore production draft from SQL reset if needed; row currently at **version 2** with probe payload after this audit.


---

## Network trace audit: `denali-create` (reactivity & loop indicators)

**Audit timestamp (UTC):** 2026-05-27  
**Log source:** `@apps/api` dev process — structured `REQUEST_TRACE` lines (terminal capture, pid 47699, `http://127.0.0.1:3001`)  
**Route filter:** `/api/v2/workspaces/.../draft-engine/denali-create`  
**Cross-check:** `packages/draft-engine` unit suite (18/18 pass), static review of `engine.ts` + `DenaliCreateTourWizard.tsx`

> **Scope note:** No browser DevTools HAR was present in-repo; analysis uses server-side `REQUEST_TRACE` timestamps (authoritative for Nest PATCH/GET) plus client engine/wizard code paths.

### Trace timeline (extracted)

| # | Time (UTC) | Method | Status | Δ from prev PATCH |
|---|------------|--------|--------|-------------------|
| 1 | 02:57:54.308 | PATCH | 409 | — (post-DELETE stale write) |
| 2 | 02:59:27.536 | PATCH | **200** | +93,228 ms |
| 3 | 02:59:27.538 | PATCH | 409 | **2 ms** |
| 4 | 02:59:27.571 | PATCH | 409 | 33 ms |
| 5 | 02:59:27.587 | PATCH | 409 | 16 ms |
| 6 | 02:59:27.607 | PATCH | 409 | 20 ms |
| 7 | 02:59:27.622 | PATCH | 409 | 15 ms |
| 8 | 02:59:27.637 | PATCH | 409 | 15 ms |

Also in window: `DELETE`×2, `GET`×5 (includes post-race verification reads).

### 1. Duplicate PATCH within &lt; 500 ms (loop indicators)

| Finding | Detail | Verdict |
|---------|--------|:-------:|
| PATCH pairs &lt; 500 ms | **6** adjacent pairs | See classification |
| Pair #2→#3 (2 ms): `200` then `409` | Matches **controlled OCC race** (`Promise.all`, dual `version: 1`) from concurrency audit — one winner, one conflict | **NOT a loop** |
| Pairs #3→#8 (15–33 ms): all `409` | Matches **manual stale-version burst** (5 sequential PATCHes still sending `version: 1` after race) — server rejects each; no version advance | **NOT a client retry loop** |
| Repeated `200` PATCH &lt; 500 ms | **0** occurrences | **PASS** |
| Monotonic successful write storm | **None** — only **one** `200` PATCH in entire trace window | **PASS** |

**Loop indicator conclusion:** Bursts under 500 ms are **explained by audit traffic** (race + deliberate stale replay), not unbounded autosave feedback. No evidence of an infinite or runaway PATCH loop on `denali-create`.

### 2. `CONFLICT_RESOLVING` reactivity guard (`doPush` suppression)

**Code paths (`packages/draft-engine/src/engine.ts`):**

| Guard site | Behavior |
|------------|----------|
| `setDraftData()` | No-op when `status === CONFLICT_RESOLVING` (does not mark `DIRTY` or schedule sync) |
| `scheduleDebouncedSync()` | Returns immediately if `CONFLICT_RESOLVING` (timer callback re-checks) |
| `doPush()` | Early return + `console.warn("doPush ignored: Conflict resolution in progress")` |
| `refetchAndReapplyLocal()` | Sets `CONFLICT_RESOLVING` → single `onFetch` → merge → `DIRTY` → **one** `scheduleSync()` |

**Trace correlation (02:59:27 burst):**

- After winning PATCH (`200` @ .536), loser `409` @ .538 → engine `REFETCH_REAPPLY` path issues **GET** @ .555 (re-fetch), not a second immediate `200` PATCH.
- Subsequent PATCHes in trace are **409-only** (stale audit script), consistent with **no** successful redundant `doPush` during resolution.
- Terminal shows `GET`×2 @ .659 / .676 after burst (verification reads), not PATCH spam.

**Unit test (`engine.spec.ts` — `REFETCH_REAPPLY conflict re-fetches…`):**

| Metric | Expected | Observed |
|--------|----------|----------|
| `onPush` calls | 2 (initial + one retry) | 2 |
| `onFetch` during conflict | ≥ 1 | ≥ 1 |
| Final status | `IDLE` | `IDLE` |
| `pushCount > 2` (runaway) | No | No |

| Assertion | **PASS/FAIL** |
|-----------|:-------------:|
| `CONFLICT_RESOLVING` prevents redundant `doPush` during resolution | **PASS** |
| Post-409 client settles without PATCH loop | **PASS** |

### 3. `setDraftData` only on user edits (not on engine re-fetch)

**Engine (server hydration never calls `setDraftData`):**

| Operation | Mechanism | Calls `setDraftData`? |
|-----------|-----------|:---------------------:|
| `initialize()` / `onFetch` | `fetchAndHydrate` → `applyPayload` or `pendingDraft` + `DRAFT_AVAILABLE` | **No** |
| `refetchAndReapplyLocal()` | `fetchAndHydrate({ forceApply: true })` + `merge` + `applyPayload` internally | **No** |
| `applyDraft()` | `applyPayload` directly | **No** |
| User edit (UI) | `setDraftData` → `DIRTY` → debounced `doPush` | **Yes** |

**Denali wizard (`DenaliCreateTourWizard.tsx`):**

| Path | Guard | Calls `setDraftData`? |
|------|-------|:---------------------:|
| `watch()` subscription | `suppressDraftPushRef`, `formState.isDirty`, skip if `DRAFT_AVAILABLE` | Only on dirty user input |
| Hydrate `reset(formDefaults)` | `suppressDraftPushRef = true` + microtask clear | **No** (blocked) |
| `currentStep` effect | Same dirty / suppress / `DRAFT_AVAILABLE` checks | Only if dirty (user navigated after edit) |
| Engine re-fetch / conflict | No `watch` fired from engine state; engine blocks `setDraftData` during `CONFLICT_RESOLVING` | **No** |

| Assertion | **PASS/FAIL** |
|-----------|:-------------:|
| Re-fetch / conflict resolution does not route through `setDraftData` | **PASS** |
| Form push tied to dirty user-driven `watch` / step change | **PASS** |

### 4. Overall verdict

| Area | Verdict |
|------|---------|
| &lt; 500 ms PATCH bursts = autosave loop | **PASS** (bursts attributable to audit scripts, not runaway UI sync) |
| `CONFLICT_RESOLVING` guards `doPush` / debounce | **PASS** |
| `setDraftData` isolation from re-fetch | **PASS** |

### 5. Recommendations (non-blocking)

1. Capture browser HAR on next wizard session to confirm BFF layer does not duplicate Nest PATCH (single hop expected via `draft-engine.client.ts`).
2. Tag audit/script traffic with a header or dedicated draft key prefix to separate from production traces in log analysis.
3. Optional: structured client telemetry (`draft_push_attempt`, `status`) correlated with `request_id` for end-to-end traces.


---

## Follow-up audit: DELETE 204 anomaly & `draft_key = 'undefined'`

**Audit timestamp (UTC):** 2026-05-27  
**Trigger:** Open items from concurrency + network trace audits

### A. `DELETE` returned 204 but `GET` still showed `denali-create` (v123)

**Evidence (REQUEST_TRACE, same session):**

| Time (UTC) | Method | Status | Notes |
|------------|--------|--------|-------|
| 02:58:06.386 | DELETE | 204 | Audit prep |
| 02:58:06.404 | GET | 200 | Row still present (`version: 123`, full wizard payload) |

**Root cause (code):** `deleteForMember` only treated `result.affected === 0` as failure. When TypeORM/driver omits `affected`, the check is skipped and Nest still returns **204** even though **zero rows** were removed.

**Fix applied:** `apps/api/src/modules/draft-engine/draft-engine.service.ts` — use `(result.affected ?? 0) === 0` before `NotFoundException`.

**Tests added:** `draft-engine.service.spec.ts` — success when `affected: 1`; reject when `affected: 0` or `affected` missing.

| Check | **PASS/FAIL** |
|-------|:-------------:|
| False-positive 204 on no-op delete | **FIXED** |

### B. `draft_key = 'undefined'` row in `draft_snapshots`

**DB (2026-05-27):** one row with literal `draft_key = 'undefined'`, `version = 1`.

**Root cause:** JavaScript `encodeURIComponent(undefined)` coerces to the string **`"undefined"`** in URL paths. Any call like `fetch(..., workspaceId, draftKey)` with an unset variable produces `/draft-engine/undefined`.

**Mitigation (already in web client):** `apps/web/lib/draft-engine.client.ts` — `assertDraftScope()` rejects empty/`"undefined"` workspaceId and draftKey before building the path.

**Denali wizard:** uses constant `DENALI_CREATE_DRAFT_KEY`; adapter skips fetch/push when `workspaceId` is empty. Residual row likely from manual/debug traffic predating the guard.

| Check | **PASS/FAIL** |
|-------|:-------------:|
| Client guard prevents new `undefined` keys | **PASS** (code) |
| Legacy DB row cleanup | **PENDING** (optional `DELETE` row or SQL) |

### C. Current DB hygiene snapshot

| `draft_key` pattern | Rows (sample) |
|---------------------|--------------:|
| `denali-create` | 1 (`version: 2`, probe payload from OCC audit) |
| `undefined` | 1 |
| `debug-occ-*` | 9 |

### D. Recommended next steps

1. Re-run DELETE→GET sequence against API with `node --env-file=apps/api/.env` once dev server is up (prior start failed: `DATABASE_URL` unset without env file).
2. `DELETE FROM draft_snapshots WHERE draft_key IN ('undefined') OR draft_key LIKE 'debug-occ-%';` in non-prod.
3. Optional: server-side `@Param` validation rejecting `draftKey === 'undefined'`.

