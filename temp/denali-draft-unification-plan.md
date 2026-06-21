# Draft Unification — AI Implementation Spec v3

```yaml
doc_id: DENALI-DRAFT-UNIFICATION-PLAN
version: 3
audience: AI coding agent + human reviewer
status: proposed

# ─── AGENT CONTRACT ───
agent_rules:
  - Read §2 Truth Model FIRST. Server decides tombstones; client AckRecord is cache only.
  - Read §3 Plugin Contract BEFORE touching DENALI_CANONICAL_OBJECT_ROOTS.
  - Execute 3 TRACKS in order (A → B → C). Not 6 phases — do not inflate scope.
  - One track ≈ one PR. Max 4 spec files total for whole project (see §7).
  - Do not mark done without tests that FAIL when implementation reverts.
  - Do not run full monorepo gates unless human YES.
  - Protected packages → update docs/ before commit (.cursorrules).
  - Blocked? STOP. No shortcuts.

decision_summary:
  correctness: SERVER stored row + incoming form → deletedRoots (sole authority)
  client_ack: cache only (version + snapshot for OCC + optional hint); NOT source of truth
  client_deletedRoots: optional hint in PATCH; server IGNORES or overwrites hint
  roots: plugin DraftBinding.resolveTombstoneRoots() — NOT hardcoded Denali set in platform
  sanitize: once on edit; prePush validate-only
  rollout: single flag DRAFT_UNIFICATION_V3=off|shadow|on
  rejected: 6-phase rollout, 3+ flags, client-centric diff correctness, Denali roots in draft-engine
```

---

## 0. Navigation (AI — if lost, read this)

| Step | Section |
|------|---------|
| What is source of truth? | §2 |
| Multi-workspace roots? | §3 |
| What to build? | §4 Tracks A/B/C |
| Files? | §5 |
| Tests (only 4 suites)? | §7 |
| Progress? | §8 |

---

## 1. Problem (one line)

Persistent client `meta.deletedRoots` + dual sanitize → `TOMBSTONE_RESURRECTION`. Fix by server-authoritative tombstones + plugin-scoped roots + single client sanitize.

---

## 2. Truth model (CRITICAL — fixes client-centric bias)

```text
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY TRUTH (correctness)                                  │
│  Server DB row at PATCH time: { version, data.form }        │
│  serverDeletedRoots = diff(stored.form, incoming.form)      │
│       via plugin.resolveTombstoneRoots(stored, incoming)    │
│  Persist: meta.deletedRoots = serverDeletedRoots            │
│  assertEnvelopeTombstoneInvariants AFTER recompute            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CLIENT CACHE (optimization + OCC only)                     │
│  AckRecord = last parsed GET/PATCH 200 body + version       │
│  Used for: expectedVersion in PATCH, optional hint, debug   │
│  If AckRecord wrong/stale → server still correct; client     │
│  may get 409 or hint mismatch log — NOT resurrection 400    │
└─────────────────────────────────────────────────────────────┘
```

### Revised invariants

```text
INV-1  Server PATCH ALWAYS recomputes deletedRoots before persist (non-optional).
INV-2  Client MUST NOT persist meta.deletedRoots in local envelope after cutover.
INV-3  prePush MUST NOT sanitize/rewrite form (validate + assert only).
INV-4  Single sanitize on edit path (plugin reduce/sanitize).
INV-5  Tombstone root set comes from plugin DraftBinding — never hardcoded in draft-engine/apps/api generic code.
INV-6  AckRecord updates ONLY via commitServerAck after parsed 200/GET; cache miss → refetch, not guess.
INV-7  409 → server-wins reload; NO mergeDeletedRoots union.
INV-8  trackDeletedCanonicalRoots removed from create-wizard path.
```

### What changes from v2

| v2 (weak) | v3 (strong) |
|-----------|-------------|
| Client diff + server recompute as belt | **Server recompute = only correctness path** |
| Client hint important | Hint optional; log mismatch only |
| AckRecord implicit truth for diff | AckRecord **cache only** |
| DENALI_CANONICAL_OBJECT_ROOTS shared | **plugin.resolveTombstoneRoots** |

---

## 3. Plugin contract (multi-workspace — REQUIRED before Track A)

Do NOT import `DENALI_CANONICAL_OBJECT_ROOTS` in `draft-engine`, `apps/api` generic draft service, or `apps/web` generic draft layer.

### 3.1 Add to workspace-sdk (doc-first)

```typescript
/** Platform draft tombstone binding — workspace implements, core consumes. */
export type WorkspaceDraftTombstoneBinding = {
  /** Top-level form keys eligible for tombstone diff on PATCH. */
  resolveTombstoneRoots(
    baselineForm: Readonly<Record<string, unknown>>,
    incomingForm: Readonly<Record<string, unknown>>,
  ): readonly string[];

  /** Same roots + empty semantics for invariant assert (may delegate to shared helper). */
  assertEnvelopeCoherent?(envelope: unknown): void;
};

/** Extend WorkspacePlugin or wizardHost with: */
readonly draftTombstone?: WorkspaceDraftTombstoneBinding;
```

### 3.2 Denali implementation

```typescript
// packages/workspaces/denali — wraps existing DENALI_CANONICAL_OBJECT_ROOTS + isNonEmptyRootValue
resolveTombstoneRoots(baseline, incoming) {
  return topLevelRootsRemoved(baseline, incoming, DENALI_CANONICAL_OBJECT_ROOTS);
}
```

### 3.3 Starter / future workspaces

- Starter: empty roots `[]` or minimal set — spec proves no false tombstones.
- API routes: resolve binding via `workspaceId → plugin.draftTombstone` (registry), not Denali import.

### 3.4 Acceptance

```bash
# After Track A — MUST be zero:
rg "DENALI_CANONICAL_OBJECT_ROOTS" apps/api/src/workspace-drafts/ packages/draft-engine/
# Allowed only in packages/workspaces/denali/
```

---

## 4. Implementation tracks (3 tracks — NOT 6 phases)

### TRACK A — Server authoritative + plugin roots (THE FIX)

**Goal:** Even with broken client cache, PATCH never returns TOMBSTONE_RESURRECTION for valid form.

**Prerequisites:** §3 doc scaffold in `docs/phase-11/workspace-draft-persistence.md`.

| ID | Task | Done when |
|----|------|-----------|
| A-1 | Add `WorkspaceDraftTombstoneBinding` to workspace-sdk + plugin contract doc | Type exported |
| A-2 | Denali: implement `draftTombstone.resolveTombstoneRoots` | Delegates to existing logic |
| A-3 | `patchWorkspaceDraft`: load stored row → recompute roots via plugin binding → persist | INV-1 |
| A-4 | Run invariant on recomputed envelope | INV-1 |
| A-5 | Remove dependence on client `meta.deletedRoots` for server decision | Server overwrites |

**Track A tests:** `apps/api/test/workspace-draft-server-tombstone.spec.ts` (NEW, 1 file)

- Case: client sends `deletedRoots: ["photos"]` but form still has `photos` → server strips/fixes or rejects with clear code BEFORE invariant (prefer recompute fixes)
- Case: stored has photos, incoming omits photos → server persists `deletedRoots: ["photos"]`, 200
- Case: starter plugin empty roots → no tombstones

**Verify:**
```bash
pnpm --filter @apps/api exec node --import tsx --test test/workspace-draft-server-tombstone.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/workspace-draft-tombstone-invariants.spec.ts
```

**Track A gate:** API specs green; rg Denali roots not in api generic code.

---

### TRACK B — Client cleanup (single sanitize, no dual state, ack cache)

**Goal:** Remove bug class on client; align with server-primary model.

| ID | Task | Done when |
|----|------|-----------|
| B-1 | Remove `trackDeletedCanonicalRoots` from `onDraftChange` | INV-8 |
| B-2 | Client envelope: no persistent `deletedRoots` in meta | INV-2 |
| B-3 | prePush: validate-only (remove sanitizeEnvelopeForm) | INV-3 |
| B-4 | Single sanitize on edit | INV-4 |
| B-5 | AckRecord + `commitServerAck` atomic (cache only) | INV-6 |
| B-6 | Push: send `expectedVersion` from ack; **optional** client hint via plugin binding (same fn as server) | Hint ≠ truth |
| B-7 | ack null && version>0 → block push + refetch | No blind PATCH |
| B-8 | Hydrate: strip stale client `deletedRoots` from loaded envelope | One-time repair |

**Track B tests:** `apps/web/test/draft-unification-client.spec.ts` (NEW, 1 file — consolidates client cases)

- no meta.deletedRoots after edit
- prePush does not mutate form (hash stable)
- commitServerAck not called on abort epoch
- optional: hint matches plugin resolveTombstoneRoots (log-only)

**Also update:** `apps/web/test/denali-draft-hermetic-closure.spec.ts` (adjust assertions, do not delete file)

**Verify:**
```bash
pnpm --filter @apps/web exec node --import tsx --test test/draft-unification-client.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/denali-draft-hermetic-closure.spec.ts
grep -r trackDeletedCanonicalRoots apps/web/app/tours/new/ && exit 1 || true
```

**Track B gate:** Client specs green; INV-2,3,4,8.

---

### TRACK C — Rollout + conflict (minimal)

**Goal:** Safe prod; no phase explosion.

| ID | Task | Done when |
|----|------|-----------|
| C-1 | Single flag `DRAFT_UNIFICATION_V3`: off → shadow (log server vs client hint) → on | |
| C-2 | 409: SERVER_WINS + reload UI (FA/EN) | INV-7 |
| C-3 | Remove `mergeDeletedRoots` from 409 path | grep clean |
| C-4 | Manual smoke checklist (§9) | Human sign-off |
| C-5 | Delete dead code after 100% + 90d | trackDeleted, mergeDeleted if unused |

**Track C tests:** extend `apps/web/test/create-workspace-draft-adapter.spec.ts` only (409 reload — no new file)

**Verify:**
```bash
pnpm --filter @apps/web exec node --import tsx --test test/create-workspace-draft-adapter.spec.ts
```

---

## 5. File map

| Layer | Path |
|-------|------|
| **NEW contract** | `packages/workspace-sdk/src/draft/workspace-draft-tombstone-binding.ts` |
| Plugin (Denali) | `packages/workspaces/denali/src/draft/denali-draft-tombstone-binding.ts` |
| Server PATCH | `apps/api/src/workspace-drafts/workspace-drafts.service.ts` |
| Server invariant | `apps/api/src/workspace-drafts/invariants/envelope-tombstone-invariants.ts` |
| Schema gate | `packages/workspaces/denali/src/draft/create-denali-draft-schema-gate.ts` |
| Client wizard | `apps/web/app/tours/new/new-tour-wizard-client.tsx` |
| Merge (409 fix) | `apps/web/src/draft/denali-wizard-draft-merge.ts` |
| Engine cache | `packages/draft-engine/src/engine.ts` |
| Docs | `docs/phase-11/workspace-draft-persistence.md`, `denali-wizard-draft-binding.md` |

---

## 6. AckRecord — cache semantics (Track B)

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

**Rules:**

| Event | Action |
|-------|--------|
| GET/PATCH 200 parsed | `commitServerAck` → update cache |
| syncEpoch changed mid-push | NO commit |
| keepalive push | NO commit without parse |
| cache null, version>0 | BLOCK push → refetch GET |
| cache stale vs server | Server wins on next PATCH/409; **no client tombstone fix attempt** |

**Failure mode:** cache wrong → worst case 409 + reload. **Not** TOMBSTONE_RESURRECTION (server Track A).

---

## 7. Test budget (anti fake-green)

**Whole project: 4 spec targets (+ 2 updated). Do not add more without human YES.**

| # | File | Owner track |
|---|------|-------------|
| 1 | `apps/api/test/workspace-draft-server-tombstone.spec.ts` | A |
| 2 | `apps/web/test/draft-unification-client.spec.ts` | B |
| 3 | `apps/web/test/denali-draft-hermetic-closure.spec.ts` | B (update) |
| 4 | `apps/web/test/create-workspace-draft-adapter.spec.ts` | C (update) |
| — | `apps/api/test/workspace-draft-tombstone-invariants.spec.ts` | A (existing) |

**Every new test must:**

```text
[ ] Assert outcome (status code, shape, key presence) — not mock.calledOnce only
[ ] Include regression name: "TOMBSTONE_RESURRECTION cannot occur when server recomputes"
[ ] Fail if trackDeletedCanonicalRoots re-added to onDraftChange
```

---

## 8. Progress tracker

```text
[x] Track A — Server authoritative + plugin roots (+ docs)
[x] Track B — Client cleanup + ack cache (+ docs)
[x] Track C — Flag + 409 reload (code + docs)
[ ] Track C — §9 manual smoke (human sign-off before flag=on 100%)
[ ] C-5 — Delete trackDeletedCanonicalRoots after 100% rollout + 90d
```

**Current track:** _C complete (code); §9 smoke pending_

---

## 9. Manual smoke (required before flag=on 100%)

```text
1. /tours/new → photo → remove → wait 1s → PATCH 200 (no TOMBSTONE_RESURRECTION)
2. DevTools: client meta has NO deletedRoots; server row may have ephemeral deletedRoots
3. Break ack cache manually (dev) → PATCH still 200 or 409 — never resurrection 400
4. Two tabs → 409 → reload → server state
```

---

## 10. Anti-patterns

```text
❌ DENALI_CANONICAL_OBJECT_ROOTS in apps/api or draft-engine
❌ Client diff as correctness gate
❌ 6 phases / 13 spec files / 3 flags
❌ mergeDeletedRoots on 409
❌ Second sanitize in prePush "for safety"
❌ Tests that always pass (empty assert, tautology)
❌ AckRecord update on user setDraftData
```

---

## 11. Risk register (explicit)

| Risk | Mitigation in v3 |
|------|------------------|
| Hardcoded Denali roots breaks reuse | §3 plugin binding + rg gate |
| AckRecord cache drift | Server Track A; cache miss → refetch |
| Phase / team drift | 3 tracks, 1 flag, 4 spec budget |
| Legacy DB drafts with bad meta | B-8 hydrate strip; server recompute on next PATCH |

---

## 12. FAQ (AI)

| Q | A |
|---|---|
| Who computes deletedRoots for correctness? | **Server only** (Track A) |
| Client sends deletedRoots? | Optional hint; server overwrites |
| AckRecord wrong? | 409/refetch — not resurrection |
| Where do roots come from? | **plugin.draftTombstone.resolveTombstoneRoots** |
| Can I add Phase 7? | **No** — ask human |
| Test red? | Fix code |

---

## 13. References

- RCA: `temp/denali-workspace-complete-report.md`
- Testing: `docs/dev/tiered-testing.md`
- v2 archived concepts: ephemeral hint, commitServerAck — retained but subordinate to §2

---

*End spec v3 — server-primary, plugin roots, 3 tracks.*
