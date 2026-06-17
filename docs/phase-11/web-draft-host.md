# Web draft host (Phase 11.3)

> **API:** [`workspace-draft-persistence.md`](workspace-draft-persistence.md)  
> **Engine:** `@app-tour/draft-engine`  
> **Decision:** [DEC-P11-004](appendices/IMPLEMENTATION-DECISIONS.md#dec-p11-004--web-draft-host-layout-113)

## Layout

```
apps/web/src/draft/
  workspace-draft-types.ts       — generic envelope + hook result types
  workspace-draft-client.ts      — browser fetch → BFF
  create-workspace-draft-adapter.ts — DraftEngineConfig factory
  use-workspace-draft.ts         — React hook (useDraftEngine wrapper)
  draft-sync-indicator-logic.ts  — status → badge variant (unit-tested)
  draft-sync-indicator.tsx       — ui-primitives Badge UI
  draft-unification-v3.ts        — DRAFT_UNIFICATION_V3 flag resolver (Track C)
  draft-unification-v3-options.ts — Denali conflictStrategy / merge wiring
  draft-unification-v3-shadow.ts — shadow tombstone mismatch logging

apps/web/app/api/workspaces/[workspaceId]/drafts/route.ts
  GET — list index proxy (11.9-T6)

apps/web/app/api/workspaces/[workspaceId]/drafts/[namespace]/[key]/route.ts
  proxy-workspace-draft-api.server.ts — session + API_INTERNAL_URL forward
```

## BFF contract

Browser calls **same-origin** `/api/workspaces/.../drafts/...` — never `API_INTERNAL_URL` from the client.

### List index (11.9-T6)

```http
GET /api/workspaces/{workspaceId}/drafts?namespace=operator.wizard
```

Forwards to API `GET /workspaces/{workspaceId}/drafts` — returns `{ items: WorkspaceDraftIndexItem[] }` without `data` blobs.

Client: `fetchWorkspaceDraftIndex` · hook: `useWorkspaceDraftIndex` · UI: `WorkspaceDraftIndexSummary` on Denali create tour page.

### Draft events BFF (11.9-T5 web)

```http
GET /api/workspaces/{workspaceId}/drafts/{namespace}/{key}/events?limit=50
```

Client: `fetchWorkspaceDraftEvents` — proxies API audit stream for operator tooling.

### Explicit save (11.3-T7)

`DraftEngine.flush()` skips debounce and PATCHes immediately. `useWorkspaceDraft` exposes `flush`; Denali create tour page renders **Save draft** when status is `DIRTY` or `ERROR`.

Route handler forwards `Authorization: Bearer <session>` to `@apps/api` paths documented in 11.2.

## PATCH transport contract (Phase 1 — systemic fixes)

`patchWorkspaceDraftSnapshot` mirrors GET ordering: **status checks before body parse**.

```text
fetch(PATCH)
  → if status === 409 → parse JSON body (Content-Type gate) → DraftConflictError
  → if !response.ok → throw WORKSPACE_DRAFT_PATCH_FAILED:${status} (no JSON required)
  → parse JSON → parseDraftSyncPayload
```

### Content-Type gate

`readJsonResponseBody(response)` parses only when `Content-Type` includes `application/json`. Gateway HTML error pages (502/504 from edge proxies) therefore surface as `WORKSPACE_DRAFT_PATCH_FAILED:502` instead of `SyntaxError: unexpected token <`.

When `409` arrives with a non-JSON body, throw `WORKSPACE_DRAFT_PATCH_FAILED:409` — do not silently drop conflict semantics.

### Error taxonomy (client)

| Code | Meaning |
| ---- | ------- |
| `WORKSPACE_DRAFT_PATCH_FAILED:${status}` | HTTP failure (4xx/5xx except handled 409) |
| `WORKSPACE_DRAFT_PATCH_ABORTED` | Superseded in-flight PATCH (see below) |
| `DraftConflictError` | 409 with valid `DraftSyncPayload` body |

GET failures continue to use `WORKSPACE_DRAFT_FETCH_FAILED:${status}`.

### Push-time AbortController

`create-workspace-draft-adapter` owns a closure-scoped `AbortController` per adapter instance:

1. Each `onPush` call **aborts** the previous in-flight PATCH signal.
2. A new controller is created and its `signal` is passed to `fetch`.
3. `AbortError` is normalized to `WORKSPACE_DRAFT_PATCH_ABORTED`.

`DraftEngine.doPush` treats `WORKSPACE_DRAFT_PATCH_ABORTED` as a **benign supersession** — it does not set `status: ERROR` because a newer push owns recovery.

This complements existing `syncEpoch` / `localChangedDuringPush` guards inside the engine.

## AckRecord cache (Track B — INV-6)

`DraftEngine` maintains an explicit **ack cache** (`DraftAckCache<T>`) — last parsed GET/PATCH 200 body + OCC fields. Used for PATCH `expectedVersion`; **not** primary truth for tombstones (server Track A).

```typescript
type DraftAckCache<T> = {
  version: number;
  lastModified: number;
  schemaVersion: number;
  data: T;
  ackedAt: number;
  ackSource: "initialize" | "patch200" | "conflictRefetch";
};
```

| Event | Action |
| ----- | ------ |
| GET / PATCH 200 parsed | `commitServerAck` → update cache |
| PATCH 200 while local still dirty (`localChangedDuringPush`) | Commit ack/version from server; keep in-memory edits |
| `syncEpoch` changed mid-push | **No** commit |
| `WORKSPACE_DRAFT_PATCH_ABORTED` | **No** commit |
| `flushKeepalive` fire-and-forget | **No** commit (no parsed response) |
| `ackCache == null` && `version > 0` | Block PATCH → refetch GET → commit → hydrate quietly |

`setDraftData` from user edits does **not** update the ack cache. `buildPayload` uses `ackCache.version` when present for OCC.

## Generic envelope

Workspace packages may wrap form state + meta:

```typescript
type WorkspaceDraftEnvelope<TForm, TMeta = unknown> = {
  form: TForm;
  meta: TMeta;
};
```

`useWorkspaceDraft<T>` is generic over `T` — Denali uses `WorkspaceDraftEnvelope<DenaliForm, { currentStepIndex: number }>` in **11.5**.

## Hook contract

```typescript
const draft = useWorkspaceDraft<MySnapshot>({
  workspaceId,
  namespace: "operator.wizard",
  draftKey: "denali-create",
  conflictStrategy: "REFETCH_REAPPLY",
  merge: (local, server) => ({ ...server, ...local }),
});

// draft.data, draft.setData, draft.status, draft.retry, draft.flush, draft.clearDraft
// draft.navLocked — true while SYNCING or CONFLICT_RESOLVING (11.3-T5)
```

`initialize()` runs on mount. `setData` schedules debounced PATCH (500ms default).

### `clearDraft()` sequencing (Denali wizard)

`DraftEngine.clearDraft()` is safe against in-flight auto-save races:

1. Clears debounce and **`pendingSync`** so no queued flush re-runs after clear.
2. Bumps **`syncEpoch`** so a stale `doPush` that completes after clear cannot mutate local state.
3. **Awaits** active `syncInFlight` (errors swallowed) so DELETE runs after the stale PATCH finishes — then deletes the row.
4. Resets local OCC fields to `version: 0` / `data: null` / `IDLE`.

Denali create tour (`new-tour-wizard-client.tsx`) runs **`clearDraft()` → `setData(prefilled)` → `flush()`** so the template reset is persisted before navigation. Failures surface via `wizard-clear-draft-error` alert; the clear button stays disabled until the sequence completes.

### Conflict merge + resume (Denali create)

- Envelope meta may include `freshStart: true` after explicit clear. `mergeDenaliWizardDraftEnvelope` keeps the local template and step **0** — stale server `currentStepIndex` and fields must not win during OCC conflict while fresh-start is active.
- `WorkspaceWizardHost` runs `resolveInitialStepIndex` **once** per mount when `draftHydrated` is true (not on every draft keystroke). `draftResumeEpoch` increments after clear to suppress re-inference jumps.
- When matrix / contextual rules change the visible step list, the host re-anchors by **`stepId`** (`resolveWizardStepIndexAfterPlanChange`) instead of keeping a numeric index that may point at different content.

## 409 mapping

`workspace-draft-client.patchWorkspaceDraftSnapshot` throws `DraftConflictError` when BFF returns `409` with `DraftSyncPayload` body.

| `conflictStrategy` | Engine behaviour | Operator UX |
| ------------------ | ---------------- | ----------- |
| `REFETCH_REAPPLY` (default / flag `off` \| `shadow`) | Refetch baseline, merge via `mergeDenaliWizardDraftEnvelope`, re-push | Quiet — no reload banner; optional `DRAFT_AVAILABLE` if merge yields pending local delta |
| `SERVER_WINS` (flag `on`) | `hydrateFromRemote(serverPayload)`; `conflictReloadNotice = true` | `DraftConflictBanner` → `common.draftSync.serverReloaded` until next edit |

Flag wiring: [`denali-wizard-draft-binding.md`](denali-wizard-draft-binding.md#track-c-rollout--draft_unification_v3).

`DraftEngineState.conflictReloadNotice` is exposed by `useWorkspaceDraft` and passed to `DraftSyncChrome` → `DraftConflictBanner`.

Explicit conflict chooser (`applyServer` / `discardLocal`) remains for `REFETCH_REAPPLY` + `DRAFT_AVAILABLE` only.

## DraftSyncIndicator

Maps `DraftStatus` → `@app-tour/ui-primitives/badge` variant + `common.draftSync.*` i18n keys.

| Status | Variant | Visible |
| ------ | ------- | ------- |
| IDLE | success | optional (saved) |
| DIRTY | warning | yes |
| SYNCING | info | yes |
| ERROR | danger | yes + retry |
| DRAFT_AVAILABLE | info | yes |
| CONFLICT_RESOLVING | warning | yes |
| QUARANTINED | danger | yes — sync paused; form stays editable (Phase 5A) |

## Hermetic schema gate + network quarantine (Phase 5A)

Phase 5A adds optional `schemaGate` on `DraftEngineConfig`. The gate runs **only at network egress** (`buildPayload` / `doPush` / `flushKeepalive`) — never on `setDraftData`.

### Dual-state model

| Layer | Field | QUARANTINED behaviour |
| ----- | ----- | --------------------- |
| UI render | `data` | **READ_WRITE** — `setDraftData` always updates in-memory draft |
| Network sync | `status === QUARANTINED` | **LOCKED** — `doPush` and `flushKeepalive` abort before HTTP |

**G-CORE-01:** `schemaGate(payload.data, { phase: "prePush" })` — if `ok === false`, transition to `QUARANTINED`, store `schemaIssues`, **zero bytes egress**.

**G-CORE-02:** `setDraftData` MUST NOT invoke the gate synchronously or reject user input.

**G-CORE-03:** `flushKeepalive` when `QUARANTINED` or when prePush gate fails → return immediately (no fetch, no swallow-and-send).

While `QUARANTINED`, debounced auto-sync does not schedule; operator uses **Save draft** / `flush()` to re-run the gate. `navLocked` stays `false` (same as `ERROR` soft-lock).

### Hook additions

```typescript
useWorkspaceDraft({
  // ...
  schemaGate: createDenaliDraftSchemaGate(rules, evalContext), // from @app-tour/workspace-denali/draft
});
// draft.schemaIssues — readonly when QUARANTINED
```

Quarantine banner UI (`DraftQuarantineBanner`) → integrated in `DraftSyncChrome` (Phase 5B).

## DraftSyncChrome (Phase 5B)

`apps/web/src/draft/draft-sync-chrome.tsx` — shared by create-tour header and flat-edit page:

| Child | Role |
| ----- | ---- |
| `DraftSyncIndicator` | status badge |
| `DraftManualSyncButton` | Save / Retry |
| `DraftConflictBanner` | 409 pending draft (`REFETCH_REAPPLY`) or server reload notice (`SERVER_WINS`) |
| `DraftQuarantineBanner` | `QUARANTINED` + `schemaIssues` codes |
| `DraftSyncSoftLockBanner` | optional inline (`showInlineSoftLockBanner`) — flat-edit |

Create-tour keeps step-body `DraftSyncSoftLockBanner` in `WorkspaceWizardHost` for `ERROR`. Flat-edit uses inline soft-lock for `SYNCING` / `CONFLICT_RESOLVING` / `ERROR`.

## API tombstone rejection (Phase 6)

When `@apps/api` rejects PATCH with `400` (`TOMBSTONE_RESURRECTION` or `DELETED_ROOTS_NOT_ARRAY`), the BFF forwards the JSON body unchanged. The browser client throws `WORKSPACE_DRAFT_PATCH_FAILED:400` → engine `ERROR`. Operator may fix local envelope (merge / remove resurrected roots) and retry via **Save draft**.

Server emits audit event `tombstone_violation`. Contract: [`workspace-draft-persistence.md`](workspace-draft-persistence.md#envelope-tombstone-invariants-phase-6--g-api-04).

## Verification

- `apps/web/test/workspace-draft-client.spec.ts` — mock `fetch`, no Denali
- `apps/web/test/draft-sync-indicator-logic.spec.ts` — status mapping
- `apps/web/test/draft-visibility-flush-logic.spec.ts` — visibility → flush/keepalive mapping
- `apps/web/test/create-workspace-draft-adapter.spec.ts` — abort + keepalive + SERVER_WINS 409 paths
- `apps/web/test/draft-unification-v3.spec.ts` — Track C flag + merge tombstone guards
- `apps/web/test/draft-conflict-banner-logic.spec.ts` — `serverReloaded` banner view
- **Systemic fixes DoD:** [`denali-wizard-draft-binding.md`](denali-wizard-draft-binding.md#systemic-fixes-closure-phase-4--dod) — Phases 1–6 closure checklist + fast-track commands
- `apps/web/test/denali-draft-systemic-closure.spec.ts` — regression guards (`WEB-P11-CLOSE-*`)
- `apps/web/test/denali-draft-hermetic-closure.spec.ts` — Phase 5A (`WEB-P11-HERMETIC-*`)
- `apps/web/test/denali-flat-edit-sync-chrome.spec.ts` — Phase 5B (`WEB-P11-SYMM-*`)

## ERROR soft-lock UX (Phase 2 — systemic fixes)

When `DraftStatus === ERROR`, the host **must not** disable wizard fields or step navigation (`navLocked` stays false — only `SYNCING` / `CONFLICT_RESOLVING` lock nav).

### Soft-lock banner

`WorkspaceWizardHost` accepts optional `draftSyncStatus`. When `ERROR`, it renders a non-blocking `DraftSyncSoftLockBanner` above step content:

- Message: `common.draftSync.softLockBanner` — local edits accumulate; server sync is temporarily unavailable.
- Fields remain editable; first keystroke transitions engine to `DIRTY` and clears `error` (existing `setDraftData` contract).

### Manual sync button (Save draft)

`resolveDraftManualSyncButtonView(status)` drives the header **Save draft** control on Denali create tour:

| Status | Label | Action | Enabled |
| ------ | ----- | ------ | ------- |
| `ERROR` | `common.draftSync.retry` | `draft.retry()` | yes (unless `navLocked` / clear pending) |
| `DIRTY` | `wizard.saveDraft` | `draft.flush()` | yes |
| `SYNCING` | `wizard.savingDraft` | — | disabled |
| other | `wizard.saveDraft` | — | disabled |

`DraftEngine.flush()` is a no-op when not `DIRTY`; routing `ERROR` to `retry()` avoids the dead Save click documented in the Phase 2 audit.

`DraftSyncIndicator` keeps inline retry on `ERROR`; the Save/retry button uses the same `retry()` entry point for consistency.

## Visibility flush (Phase 3 — lifecycle)

Debounced auto-save (500ms default) can lose the last edit if the user hides or closes the tab before the timer fires. `useDraftVisibilityFlush` (wired inside `useWorkspaceDraft` by default) closes that gap.

### Two-tier event strategy

| Event | Condition | Action |
| ----- | --------- | ------ |
| `visibilitychange` | `document.visibilityState === "hidden"` and `status === DIRTY` | `DraftEngine.flush()` — normal async PATCH (primary path) |
| `pagehide` | still `DIRTY` (not `SYNCING`) | `DraftEngine.flushKeepalive()` — fire-and-forget PATCH |

Skip flush when `status` is `CONFLICT_RESOLVING` or `DRAFT_AVAILABLE`. Opt out per hook: `useWorkspaceDraft({ visibilityFlush: false })`.

Engine data is already sanitized at `setData` time (Denali `onDraftChange` / flat-edit rule sync) — visibility flush does not re-run sanitize.

### PATCH `keepalive` transport

`patchWorkspaceDraftSnapshot` accepts `keepalive?: boolean` on `PatchWorkspaceDraftSnapshotOptions`. When true:

- `fetch` includes `keepalive: true` (browser may complete PATCH after page unload)
- **No `AbortSignal`** — mutually exclusive with Phase 1 push-time abort
- Keepalive pushes must not abort an in-flight debounced PATCH; debounced pushes must not abort a keepalive unload send

`create-workspace-draft-adapter` routes `onPush(payload, { keepalive: true })` to this path and swallows errors (unload context).

`DraftEngine.flushKeepalive()` clears debounce, builds payload, calls `onPush` with keepalive — **does not** transition to `SYNCING` (unload-safe).

### Browser limit

`keepalive` request bodies are capped at ~64KB in modern browsers. Large Denali drafts may fail silently on `pagehide`; the `visibilitychange` flush remains the reliable path when the user switches tabs.

## Draft events timeline (11.11)

`WorkspaceDraftEventsTimeline` on Denali create tour — reads `fetchWorkspaceDraftEvents` (BFF) and refreshes when `useWorkspaceDraft.version` changes after sync.

Collapsible `<details>` — last 10 events, action label + localized timestamp. Full cross-workspace audit screen remains future scope.
