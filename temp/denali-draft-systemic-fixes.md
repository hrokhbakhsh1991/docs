# Denali Draft Sync Engine — Deterministic Specification

```yaml
spec_version: "3.0.0"
supersedes: "2.1.0"
baseline_shipped: ["Phase-1", "Phase-2", "Phase-3", "Phase-4"]
target_phases: ["Phase-5A", "Phase-5B", "Phase-6"]
pr_ref: "https://github.com/hrokhbakhsh1991/docs/pull/18"
covenant_docs:
  - docs/phase-11/web-draft-host.md
  - docs/phase-11/denali-wizard-draft-binding.md
```

---

# [SYSTEM_CONTEXT]

```yaml
target: Denali Draft Sync Engine Evolution (Phases 5–6)
core_paradigm: Hermetic Schema Isolation + Network-only Quarantine
completed_baseline:
  Phase-1: { transport: PATCH status-before-JSON, AbortController, merge_v2, meta.deletedRoots }
  Phase-2: { error_ux: [DraftSyncSoftLockBanner, DraftManualSyncButton], validation_i18n_by_code }
  Phase-3: { visibility_flush: [useDraftVisibilityFlush, flushKeepalive] }
  Phase-4: { closure: [DenaliFlatEditValidationList, WEB-P11-CLOSE-01..05, test-changed mapping] }
trust_boundary_shift:
  from: transport_resilience
  to: [client_schema_gate, network_quarantine, api_structural_tombstone_only]
monorepo_packages:
  engine: "@app-tour/draft-engine"
  denali: "@app-tour/workspace-denali"
  web: "apps/web"
  api: "apps/api"
```

---

# [STATE_MACHINE_DEFINITION]

## DraftStatus Unified Enum

```typescript
type DraftStatus =
  | "IDLE"
  | "SAVING"           // alias: DIRTY + debounce pending (legacy: DIRTY)
  | "SYNCING"
  | "CONFLICT_RESOLVING"
  | "ERROR"
  | "QUARANTINED";     // Phase 5A — network sync halted; UI editable
```

```yaml
legacy_mapping:
  DIRTY: SAVING          # existing code uses DIRTY; spec uses SAVING semantically
  DRAFT_AVAILABLE: IDLE  # pending remote draft not applied
```

## Orthogonal Layer Model (Phase 5A)

```yaml
layers:
  UI_RENDER_LAYER:
    field: engine.data
    mutator: setDraftData
  NETWORK_SYNC_LAYER:
    field: engine.status
    mutators: [doPush, flushKeepalive, debounced_sync]
```

## State Transition Matrix

| From | Event | Guard | To | Side Effects |
| ---- | ----- | ----- | -- | ------------ |
| IDLE | setDraftData(user) | — | SAVING | data←payload; scheduleSync |
| SAVING | debounce_fire | status≠QUARANTINED | SYNCING | invoke doPush |
| SAVING | debounce_fire | status=QUARANTINED | SAVING | no network; remain SAVING |
| SYNCING | prePush ok | G-CORE-01 pass | SYNCING | HTTP PATCH |
| SYNCING | prePush fail | G-CORE-01 fail | QUARANTINED | schemaIssues←gate; HALT network |
| SYNCING | PATCH ok | — | IDLE | hydrate version |
| SYNCING | PATCH 409 | — | CONFLICT_RESOLVING | DraftConflictError |
| SYNCING | PATCH error | — | ERROR | error←err |
| QUARANTINED | setDraftData(user) | G-UI-02 | QUARANTINED | data←payload; UI RW; NO auto-push until flush/retry |
| QUARANTINED | flush/retry + prePush ok | G-CORE-01 pass | SYNCING | resume network |
| QUARANTINED | revert_to_last_valid | — | IDLE | data←lastValidSnapshot |
| ERROR | retry + prePush ok | G-CORE-01 pass | SYNCING | — |
| CONFLICT_RESOLVING | merge + prePush ok | G-CORE-01 pass | IDLE/SAVING | hydrate |
| * | visibility hidden + SAVING | G-CORE-01 pass | * | flush or keepalive |
| * | visibility hidden + QUARANTINED | — | QUARANTINED | flushKeepalive MUST return early |
| * | pagehide + SAVING | G-CORE-01 pass | * | keepalive push |
| * | pagehide + QUARANTINED | — | QUARANTINED | flushKeepalive MUST return early |

## State Invariants

```yaml
IF status == QUARANTINED:
  UI_RENDER_LAYER: READ_WRITE
  NETWORK_SYNC_LAYER: LOCKED
  setDraftData: ALLOWED
  doPush: MUST_ABORT
  flushKeepalive: MUST_RETURN_EARLY_NO_FETCH
  navLocked: false
  DISP_BANNER: DraftQuarantineBanner | DraftSyncSoftLockBanner
  DISP_BANNER_CONTENT: [schema_issue_codes, Revert_CTA]
  DraftManualSyncButton: visible; onFlush re-runs prePush gate

IF status == SYNCING | CONFLICT_RESOLVING:
  UI_RENDER_LAYER: READ_WRITE | READ_ONLY per host policy
  navLocked: true
  DISP_BANNER: DraftSyncSoftLockBanner

IF status == SAVING:
  UI_RENDER_LAYER: READ_WRITE
  navLocked: false
```

## Strict Guards — Engine

```yaml
G-CORE-01:
  scope: [doPush, flushKeepalive, buildPayload]
  rule: |
    result = schemaGate(payload, { phase: "prePush" })
    IF result.ok == false:
      transition → QUARANTINED
      HALT network pipeline (zero bytes egress)
      RETURN
    ELSE:
      payload = result.value
      PROCEED PATCH

G-CORE-02:
  scope: setDraftData
  rule: |
    MUST NOT invoke schemaGate synchronously to reject user input
    MUST update engine.data unconditionally (source=user)
    MAY schedule debounced sync (subject to G-CORE-01 at egress)

G-CORE-03:
  scope: flushKeepalive
  rule: |
    IF status == QUARANTINED: RETURN immediately
    IF prePush gate fails: RETURN immediately (no fetch, no swallow-and-send)

G-CORE-04:
  scope: syncEpoch / clearDraft
  rule: in-flight push after clearDraft MUST NOT mutate state (existing)
```

---

# [SCHEMA_GATE_CONTRACT]

## Input / Output Types

```typescript
// packages/draft-engine/src/types.ts (Phase 5A additions)

type DraftSchemaPhase = "prePush" | "merge";

type DraftSchemaIssue = {
  readonly code: string;
  readonly path?: readonly string[];
  readonly message?: string;
};

type DraftSchemaGateResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly DraftSchemaIssue[] };

type DraftSchemaGate<T> = (
  candidate: T,
  ctx: { readonly phase: DraftSchemaPhase }
) => DraftSchemaGateResult<T>;

type DraftEngineConfig<T> = {
  readonly schemaGate?: DraftSchemaGate<T>;
  // ...existing: id, conflictStrategy, onFetch, onPush, onDelete, debounceMs, merge
};
```

## Denali Envelope Schema (client-only)

```typescript
// packages/workspaces/denali/src/draft/denali-wizard-draft-schema.ts

const MAX_SANITY_ATTEMPTS = 2 as const;

const DenaliWizardDraftMetaSchema = z.object({
  currentStepIndex: z.number().int().min(0),
  wizardSessionId: z.string().optional(),
  freshStart: z.boolean().optional(),
  deletedRoots: z.array(z.string()).optional(), // enum tightened client-side
});

const DenaliWizardDraftEnvelopeSchema = z.object({
  form: z.object({ data: z.record(z.unknown()) }),
  meta: DenaliWizardDraftMetaSchema,
});

type DenaliWizardDraftEnvelope = z.infer<typeof DenaliWizardDraftEnvelopeSchema>;
```

## createDenaliDraftSchemaGate Pseudocode

```typescript
function createDenaliDraftSchemaGate(rules, ctx): DraftSchemaGate<DenaliWizardDraftEnvelope> {
  return (candidate, { phase }) => {
    IF phase NOT IN ["prePush", "merge"]:
      RETURN { ok: false, issues: [{ code: "INVALID_PHASE" }] }

    LET current = candidate
    FOR attempt IN 1..MAX_SANITY_ATTEMPTS:                    // G-DENALI-02
      parsed = DenaliWizardDraftEnvelopeSchema.safeParse(current)
      IF !parsed.success:
        RETURN { ok: false, issues: zodToIssues(parsed.error) }

      sanitized = sanitizeDenaliWizardDraftEnvelope(parsed.data, rules, ctx)
      reparsed = DenaliWizardDraftEnvelopeSchema.safeParse(sanitized)
      IF !reparsed.success:
        RETURN { ok: false, issues: zodToIssues(reparsed.error) }

      IF stableEqual(parsed.data, reparsed.data):
        RETURN { ok: true, value: reparsed.data }

      current = reparsed.data
    END FOR

    console.warn("[denali-draft-gate] SANITIZE_FIXPOINT_EXCEEDED", { attempts: MAX_SANITY_ATTEMPTS })
    RETURN { ok: false, issues: [{ code: "SANITIZE_FIXPOINT_EXCEEDED" }] }  // → QUARANTINED
  }
}
```

```yaml
G-DENALI-01:
  rule: DenaliWizardDraftEnvelopeSchema MUST be defined only in @app-tour/workspace-denali
  forbidden_import_in: [apps/web, apps/api, draft-engine]

G-DENALI-02:
  rule: parse → sanitize → re-parse loop MUST NOT exceed MAX_SANITY_ATTEMPTS (= 2)
  on_exceed: { ok: false, code: SANITIZE_FIXPOINT_EXCEEDED, effect: QUARANTINED }

G-DENALI-03:
  rule: freshStart=true MUST clear deletedRoots in normalization before prePush pass
```

---

# [FILE_MAP]

## Phase 5A — @app-tour/draft-engine

| File | Action | Contract |
| ---- | ------ | -------- |
| `packages/draft-engine/src/types.ts` | MODIFY | Add `QUARANTINED`, `DraftSchemaGate*`, `DraftSchemaIssue` |
| `packages/draft-engine/src/engine.ts` | MODIFY | G-CORE-01..04 at doPush/flushKeepalive/buildPayload |
| `packages/draft-engine/test/engine.spec.ts` | MODIFY | QUARANTINED transitions, prePush abort |
| `packages/draft-engine/test/schema-gate.spec.ts` | CREATE | G-CORE-01 unit matrix |

## Phase 5A — @app-tour/workspace-denali

| File | Action | Contract |
| ---- | ------ | -------- |
| `packages/workspaces/denali/src/draft/denali-wizard-draft-schema.ts` | CREATE | Zod schemas, `MAX_SANITY_ATTEMPTS` |
| `packages/workspaces/denali/src/draft/create-denali-draft-schema-gate.ts` | CREATE | G-DENALI-02 fixpoint gate factory |
| `packages/workspaces/denali/src/draft/index.ts` | MODIFY | export gate + schema |
| `packages/workspaces/denali/test/denali-wizard-draft-schema.spec.ts` | CREATE | fixpoint oscillation fixtures |

## Phase 5B — apps/web (Presentation)

| File | Action | Contract |
| ---- | ------ | -------- |
| `apps/web/src/draft/draft-sync-chrome.tsx` | CREATE | G-UI-03 shared shell |
| `apps/web/src/draft/draft-quarantine-banner.tsx` | CREATE | QUARANTINED banner + Revert CTA |
| `apps/web/src/draft/denali-wizard-draft-merge.ts` | MODIFY | merge output → prePush gate before hydrate sync |
| `apps/web/src/draft/create-workspace-draft-adapter.ts` | MODIFY | wire schemaGate; G-CORE-03 keepalive |
| `apps/web/src/draft/use-workspace-draft.ts` | MODIFY | expose schemaIssues, quarantine helpers |
| `apps/web/app/tours/new/new-tour-wizard-client.tsx` | MODIFY | DraftSyncChrome; remove UI-thread sanitize duplicate |
| `apps/web/app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx` | MODIFY | G-UI-03 symmetry |
| `apps/web/src/wizard/workspace-wizard-host.tsx` | MODIFY | consume DraftSyncChrome |
| `apps/web/test/denali-draft-hermetic-closure.spec.ts` | CREATE | WEB-P11-HERMETIC-* |
| `apps/web/test/denali-flat-edit-sync-chrome.spec.ts` | CREATE | WEB-P11-SYMM-* |

```yaml
G-UI-01:
  rule: QUARANTINED MUST NOT set navLocked=true
  rule: QUARANTINED MUST NOT disable form inputs

G-UI-02:
  rule: setDraftData during QUARANTINED MUST NOT unmount form subtree

G-UI-03:
  rule: |
    DraftSyncChrome MUST bind symmetrically on:
      - new-tour-wizard-client.tsx
      - denali-flat-edit-page-client.tsx
    components: [DraftSyncIndicator, DraftConflictBanner, DraftSyncSoftLockBanner, DraftQuarantineBanner, DraftManualSyncButton]
```

## Phase 6 — @apps/api (Backend Persistence)

| File | Action | Contract |
| ---- | ------ | -------- |
| `apps/api/src/workspace-drafts/invariants/envelope-tombstone-invariants.ts` | CREATE | G-API-04 structural check |
| `apps/api/src/workspace-drafts/workspace-drafts.service.ts` | MODIFY | invoke invariant on PATCH for allowlisted namespaces |
| `apps/api/src/workspace-drafts/workspace-drafts.errors.ts` | MODIFY | TombstoneResurrectionError, DeletedRootsNotArrayError |
| `apps/api/test/workspace-draft-tombstone-invariants.spec.ts` | CREATE | API-P11-TOMB-*, API-P11-GEN-01 |

```yaml
G-API-04:
  forbidden_imports:
    - "@app-tour/workspace-denali"
    - "@app-tour/workspace-denali/draft"
    - "packages/workspaces/denali/**"
  allowed: opaque unknown + structural shape probe only

TOMBSTONE_ENFORCEMENT:
  trigger: PATCH ingress, draftNamespace IN allowlist ["operator.wizard"]
  steps:
    1: IF data NOT shape { form: { data: object }, meta: object } → PASS (opaque blob)
    2: IF meta.deletedRoots present AND NOT Array.isArray(deletedRoots) → HTTP 400 DELETED_ROOTS_NOT_ARRAY
    3: FOR EACH root IN meta.deletedRoots:
         IF Object.prototype.hasOwnProperty.call(form.data, root):
           → HTTP 400 TOMBSTONE_RESURRECTION
    4: ELSE → ACCEPT persist
  note: NO canonical root whitelist on server; ANY string in deletedRoots is enforced
```

## Docs (doc-first covenant — before protected package merge)

| File | Action |
| ---- | ------ |
| `docs/phase-11/web-draft-host.md` | MODIFY — QUARANTINED state, G-CORE-01 |
| `docs/phase-11/denali-wizard-draft-binding.md` | MODIFY — gate + fixpoint |
| `docs/phase-11/workspace-draft-persistence.md` | MODIFY — G-API-04 tombstone table |

---

# [API_PATCH_IO_SCHEMA]

## Request (unchanged envelope)

```yaml
PATCH /workspaces/{workspaceId}/drafts/{namespace}/{key}
body:
  data: unknown          # JSONB blob
  version: number
  schemaVersion: number
  lastModified: number
```

## Server Tombstone Decision Function

```typescript
type TombstoneDecision =
  | { ok: true }
  | { ok: false; http: 400; code: "DELETED_ROOTS_NOT_ARRAY" }
  | { ok: false; http: 400; code: "TOMBSTONE_RESURRECTION"; keys: string[] };

function assertEnvelopeTombstoneInvariants(data: unknown): TombstoneDecision;
```

```yaml
inputs:
  data: unknown
outputs:
  ok_true: persist via repo.patch
  ok_false: throw mapped HTTP 400; emit workspace_draft.tombstone_violation event
```

---

# [MERGE_CONTRACT]

```yaml
function: mergeDenaliWizardDraftEnvelope(local, server)
post_condition:
  - deletedRoots = union(local.meta.deletedRoots, server.meta.deletedRoots)
  - tombstoned roots omitted from form.data merge
pre_sync_gate:
  - merged envelope MUST pass schemaGate(_, { phase: "prePush" }) before first PATCH
  - IF fail → QUARANTINED (UI still editable)
```

---

# [DEFINITION_OF_DONE_ASSERTIONS]

Implementation COMPLETE iff ALL assertions GREEN:

```yaml
WEB-P11-HERMETIC-01:
  assert: engine drops doPush execution upon schemaGate violation
  runner: |
    pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/schema-gate.spec.ts

WEB-P11-HERMETIC-02:
  assert: flushKeepalive blocks network calls if prePush gate fails
  runner: |
    pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/engine.spec.ts
    pnpm --filter @apps/web exec node --import tsx --test test/create-workspace-draft-adapter.spec.ts

WEB-P11-HERMETIC-03:
  assert: merge output gated at prePush before first sync
  runner: |
    pnpm --filter @apps/web exec node --import tsx --test test/denali-wizard-draft-resume.spec.ts

WEB-P11-HERMETIC-04:
  assert: fixpoint aborts at MAX_SANITY_ATTEMPTS=2 → ok:false
  runner: |
    pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/denali-wizard-draft-schema.spec.ts

WEB-P11-SYMM-01:
  assert: flat-edit binds DraftSyncSoftLockBanner + DraftManualSyncButton
  runner: |
    pnpm --filter @apps/web exec node --import tsx --test test/denali-flat-edit-sync-chrome.spec.ts

WEB-P11-SYMM-02:
  assert: DraftSyncChrome consumed by create-tour + flat-edit (static grep guard)
  runner: |
    pnpm --filter @apps/web exec node --import tsx --test test/denali-flat-edit-sync-chrome.spec.ts

API-P11-TOMB-01:
  assert: server rejects PATCH when ∃ root ∈ meta.deletedRoots ∩ keys(form.data)
  runner: |
    pnpm --filter @apps/api exec node --import tsx --test test/workspace-draft-tombstone-invariants.spec.ts

API-P11-TOMB-02:
  assert: PATCH omitting tombstoned root keys → accept
  runner: same as TOMB-01

API-P11-GEN-01:
  assert: @apps/api zero imports from workspace-denali (static guard)
  runner: |
    pnpm run guard:import-boundary
```

```bash
# Fast-track bundle (Phase 5–6 iteration)
pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/engine.spec.ts test/schema-gate.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/denali-wizard-draft-schema.spec.ts test/denali-wizard-draft-binding.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/denali-draft-hermetic-closure.spec.ts test/denali-flat-edit-sync-chrome.spec.ts test/create-workspace-draft-adapter.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/workspace-draft-tombstone-invariants.spec.ts test/workspace-drafts.spec.ts
bash scripts/guard-docs.sh
pnpm run pre-commit:fast && pnpm run guard:import-boundary
```

---

# [CRITICAL_NEGATIVE_CONSTRAINTS_AND_ANTI_PATTERNS]

```yaml
NEVER:
  - direct setData / setDraftData bypassing eventual prePush schemaGate at network egress
  - import DenaliWizardDraftEnvelopeSchema or DENALI_CANONICAL_OBJECT_ROOTS in @apps/api
  - import workspace-denali Zod into draft-engine
  - duplicate Zod schemas in apps/web (must import gate factory from workspace-denali/draft)
  - swallow prePush failure in flushKeepalive and still fetch (poison egress)
  - infinite parse→sanitize→re-parse loop (MUST cap at MAX_SANITY_ATTEMPTS=2)
  - server-side Denali field-level / form-level validation
  - server canonical root whitelist (tombstone strings are opaque to API)

MUST_NOT:
  - unmount form subtree on QUARANTINED transition
  - freeze/disable inputs on QUARANTINED (G-UI-01)
  - set navLocked=true on QUARANTINED
  - block setDraftData when schemaGate fails (network-only quarantine)
  - couple backend registries to frontend form structures

DO_NOT:
  - use QUARANTINED to mean UI read-only (UI_RENDER_LAYER=READ_WRITE always)
  - validate full Denali form schema on API PATCH ingress
  - extend tombstone check beyond: meta.deletedRoots array ∩ top-level form.data keys
  - run phase-5:gate | ci:integrity | test:full without explicit Architect YES
```

---

# [RISK_MATRIX]

| ID | Condition | L | I | Mitigation | Test |
| -- | --------- | - | - | ---------- | ---- |
| R-1 | Tombstoned root re-added to form.data | H | H | G-DENALI + G-API tombstone | API-P11-TOMB-01 |
| R-2 | Quarantine Catch-22 (UI frozen) | M | H | G-UI-01, G-CORE-02 | WEB-P11-HERMETIC-01 |
| R-3 | keepalive poison egress | M | H | G-CORE-03 | WEB-P11-HERMETIC-02 |
| R-4 | fixpoint infinite loop | L | M | G-DENALI-02 | WEB-P11-HERMETIC-04 |
| R-5 | API workspace import leak | H | H | G-API-04 | API-P11-GEN-01 |
| R-6 | concurrent tab resurrection | M | M | server 400 + client 409 merge | API-P11-TOMB-01 |
| R-7 | freshStart + stale deletedRoots | M | M | G-DENALI-03 | denali-wizard-draft-resume spec |

---

# [EDGE_CASE_CATALOG]

```yaml
EC-01:
  trigger: freshStart=true
  expect: deletedRoots cleared before prePush

EC-02:
  trigger: Tab-A tombstones root; Tab-B PATCHes stale blob with root
  expect: API 400 TOMBSTONE_RESURRECTION; Tab-B 409-merge + re-tombstone

EC-03:
  trigger: sanitize oscillates A→B→A within 2 attempts
  expect: SANITIZE_FIXPOINT_EXCEEDED → QUARANTINED; UI editable

EC-04:
  trigger: QUARANTINED + user edits + ManualSync flush + prePush pass
  expect: QUARANTINED → SYNCING → IDLE; PATCH succeeds

EC-05:
  trigger: empty object {} vs omitted key at canonical root
  expect: trackDeletedCanonicalRoots uses isNonEmptyRootValue; gate aligns

EC-06:
  trigger: non-envelope namespace PATCH (no form/meta shape)
  expect: assertEnvelopeTombstoneInvariants PASS; opaque persist
```

---

# [IMPLEMENTATION_ORDER]

```yaml
sequence:
  1: docs/phase-11/* (doc-first covenant)
  2: draft-engine types + QUARANTINED + G-CORE-01..04 + tests
  3: workspace-denali schema + createDenaliDraftSchemaGate + G-DENALI-02 tests
  4: apps/web adapter wire + DraftSyncChrome + symmetry
  5: apps/api envelope-tombstone-invariants + service hook + tests
  6: closure specs WEB-P11-HERMETIC-* + WEB-P11-SYMM-* + API-P11-*
```

---

```yaml
architect_footer:
  documentation_status: Not_Needed  # temp spec; update covenant docs at step 1 of IMPLEMENTATION_ORDER
  links:
    - docs/phase-11/web-draft-host.md
    - docs/phase-11/denali-wizard-draft-binding.md
```
