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

## 409 mapping

`workspace-draft-client.patchWorkspaceDraftSnapshot` throws `DraftConflictError` when BFF returns `409` with `DraftSyncPayload` body — engine `REFETCH_REAPPLY` handles merge quietly.

Explicit conflict banner UI → **11.3-T6** (later).

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

## Verification

- `apps/web/test/workspace-draft-client.spec.ts` — mock `fetch`, no Denali
- `apps/web/test/draft-sync-indicator-logic.spec.ts` — status mapping

## Draft events timeline (11.11)

`WorkspaceDraftEventsTimeline` on Denali create tour — reads `fetchWorkspaceDraftEvents` (BFF) and refreshes when `useWorkspaceDraft.version` changes after sync.

Collapsible `<details>` — last 10 events, action label + localized timestamp. Full cross-workspace audit screen remains future scope.
