# DEC-CW-05 — Wizard resume placement (evidence packet)

**Ledger task:** CW5-10 (deferred)  
**Decision id:** DEC-CW-05  
**Status:** Evidence only — **no product semantics chosen**  
**Repository ref:** Wave 5B closure (`cursor/cw-wave-5b-5f5b`)  
**Prepared:** 2026-08-23 (Wave 6A, Worker D)  
**Decision owners:** Operator wizard product owner + Architect  

**Mandatory inputs (not re-audited):**

- `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` (TRUTH) §20
- `docs/dev/composable-workspace-refactor-plan.md` — DEC-CW-05 gate
- `packages/workspace-sdk/src/plugin/workspace-wizard-host-hooks.ts` — `resolveInitialStepIndex`
- `packages/workspaces/denali/src/wizard/resolve-initial-step-index.ts`
- `apps/web/src/wizard/workspace-wizard-host.tsx` — host mount behavior

---

## 1. Executive summary

**Wizard resume** = inferring the wizard step index when `savedStepIndex === 0` on first mount after draft hydration. Denali implements **field-inference resume** (phantom scalar filtering, meaningful data scan). Platform default is **noop** — host keeps saved index 0.

DEC-CW-05 blocks **CW5-10 only**. CW-5 CORE EXIT completed with CW5-10 deferred. Starter Profile (CW-6) and validation pipeline (CW-8) do not require this decision.

**Question:** Should resume inference remain Denali-only via wizard host hook, become manifest-declared, or adopt a platform default algorithm?

---

## 2. Current behavior census

### 2.1 Host contract (SDK)

`WorkspaceWizardHost.resolveInitialStepIndex?` — optional hook:

```ts
readonly resolveInitialStepIndex?: (input: {
  readonly draft: Readonly<Record<string, unknown>>;
  readonly visibleSteps: readonly unknown[];
  readonly savedStepIndex: number;
  readonly skipFieldInference?: boolean;
}) => number;
```

Documented: host calls **once** per mount when saved step is 0 (`SDK_CONTRACTS.md`, `docs/phase-11/web-draft-host.md`).

### 2.2 Host implementation (`apps/web`)

`workspace-wizard-host.tsx`:

- If hook absent → **no inference**; step stays `savedStepIndex`
- If `savedStepIndex !== 0` → inference skipped
- If `skipFieldInference` → use saved index only
- Otherwise → `wizardHost.resolveInitialStepIndex(...)`

**Platform default:** noop (hook undefined).

### 2.3 Denali implementation

| Artifact | Role |
|----------|------|
| `resolveDenaliInitialStepIndex` | Core inference: phantom scalars, field scan, template steps |
| `resolveDenaliInitialStepIndexFromHostInput` | Adapter for host hook shape |
| `denali-wizard-host-hooks.ts` | `resolveInitialStepIndex: resolveDenaliInitialStepIndexFromHostInput` |
| `isPhantomCanonicalScalar` | Filters sanitize/template defaults (`draft`, `false`, `none`, …) |
| `DENALI_CANONICAL_TO_FORM_PATH_MAP` | Field path resolution for inference |

**Complexity:** ~250 lines; Denali canonical paths, template steps, multi-day tour rules, empty-draft seed title patterns.

### 2.4 Other workspaces

| Workspace | Resume behavior |
|-----------|-----------------|
| **starter** | No hook — noop |
| **urban** | Platform wizard host hooks — **no** `resolveInitialStepIndex` |
| **harbor / guest-club** | No custom inference |
| **denali** | Full inference |

### 2.5 Saved-index compatibility

- Draft envelope stores `meta.currentStepIndex` (and related meta)
- Denali inference runs only when saved index is **0** — explicit operator navigation to step 0 is respected when inference returns 0
- `draftResumeEpoch` increments on clear to suppress re-inference jumps (`docs/phase-11/web-draft-host.md`)
- Branch B phantom-default fix documented in `docs/phase-11/denali-wizard-draft-binding.md`

---

## 3. Product evidence gaps

| Requirement | Evidence status |
|-------------|-----------------|
| Resume UX for **Starter** outdoor profile workspaces | **Unknown** — starter wizard is minimal; no draft resume spec |
| Resume UX for **Urban** | **Unknown** — short wizard; noop today |
| Whether noop remains valid platform default | **Likely yes** for minimal workspaces; Denali needs inference |
| Saved-index compatibility across releases | **Required** — Denali has production drafts |
| Cross-surface resume (portal vs operator) | Operator web only today |

---

## 4. Options

### Option A — Hook-only (status quo)

- Platform default: **noop**
- Workspaces with complex wizards implement `resolveInitialStepIndex` on `wizardHost`
- Denali keeps `resolveDenaliInitialStepIndex` in workspace package

| Pros | Cons |
|------|------|
| Zero platform risk | Every complex workspace duplicates inference or omits resume |
| CW5-10 = document + certify Denali hook boundary | Starter-outdoor may need copy or accept noop |
| Matches TRUTH §20 | No manifest inspectability of resume policy |

**CW5-10 effort:** LOW — evidence + guard that host never imports Denali resume directly (already `WEB-12-HOST-04`).

### Option B — Manifest `wizardResume` block

```json
"wizardResume": {
  "mode": "noop" | "fieldInference",
  "phantomScalars": ["draft", "false", "none"],
  "skipPaths": ["publishStatus", "category"]
}
```

Codegen projects mode into plugin host hooks or a shared platform inference module.

| Pros | Cons |
|------|------|
| Inspectable declarative policy | Generic inference still Denali-shaped; risk of false genericization |
| Profile can set `mode: noop` default | `fieldInference` needs field-registry coupling |
| CW6 profiles can declare defaults | CW5-10 blocked on schema + codegen design |

**CW5-10 effort:** MEDIUM — manifest domain + platform inference port.

### Option C — Capability module `wizardResumeExport`

```json
"wizardResume": {
  "module": "./wizard/resolve-initial-step-index",
  "export": "resolveWorkspaceInitialStepIndex"
}
```

Same as CW2 pattern (`equipmentIconKeyValidator`).

| Pros | Cons |
|------|------|
| No host `pluginId` branches | Denali module stays large in workspace package |
| Explicit workspace ownership | Not declarative — behavior hidden in TS |
| Aligns with workspace policy pipeline | Does not help Starter without new module |

**CW5-10 effort:** LOW–MEDIUM — manifest binding + migrate Denali export path.

### Option D — Hybrid (recommended PROPOSAL for Architect review)

1. **Platform default remains noop** (Option A baseline).
2. Optional manifest `wizardResume` with **only**:

```json
"wizardResume": { "mode": "noop" }
```

or

```json
"wizardResume": {
  "mode": "module",
  "module": "./wizard/resolve-initial-step-index",
  "export": "resolveDenaliInitialStepIndexFromHostInput"
}
```

3. Profile `starter-outdoor` sets `mode: "noop"` explicitly.
4. Denali uses `mode: "module"` — no algorithm in tour-core/platform-core.

| Pros | Cons |
|------|------|
| Preserves noop default | Two sub-modes to codegen |
| Manifest inspectability without generic inference | Still need DEC for future shared inference |
| Profile composition friendly | |

---

## 5. Impact analysis

| Area | Option A | Option B | Option C | Option D |
|------|----------|----------|----------|----------|
| CW5-10 | Document | Schema+codegen | Binding | Schema+binding |
| CW-6 profiles | noop implicit | profile default | profile module ref | explicit noop in profile |
| CW-8 pipeline | none | none | none | none |
| Host `apps/web` | unchanged | may call platform inference | unchanged | codegen sets hook |
| Denali parity | full | migration risk | rename export | manifest migration |
| TRUTH §20 | aligned | needs doc update | aligned | aligned |

---

## 6. Backward compatibility

| Concern | Mitigation |
|---------|------------|
| Existing Denali drafts with `currentStepIndex: 0` | Any change must golden-test inference outputs (`resolve-initial-step-index.spec.ts`, `denali-wizard-draft-contract.spec.ts`) |
| Host hook signature | Frozen — extend via `skipFieldInference` only |
| Saved index > 0 | Never run inference — preserve |

---

## 7. Evidence required for Architect approval

1. Product sign-off: Starter/Urban resume UX (noop vs inference).
2. Decision on whether **generic field inference** is a platform feature or permanently workspace-owned.
3. If manifest block chosen: coordinator-owned schema shape (DEC-CW-06 / CW6 pattern).
4. CW5-10 closure tests list signed.

---

## 8. Recommendation (evidence-only, not binding)

**PROPOSAL: Option D (hybrid)** — platform noop default + optional manifest `wizardResume` declaring `noop` or workspace module export. Denali migrates to manifest-declared module binding; does not move inference algorithm to platform-core.

**Defer generic `fieldInference` mode** until a second workspace needs shared inference without copying Denali (would trigger new decision / TRUTH update).

---

## 9. While unresolved

- **DEFER:** CW5-10 implementation.
- **CONTINUE:** CW-6, CW-7, CW-8, CW-9 tasks per ledger (DEC-CW-05 blocks only CW5-10).

---

## 10. Related files (CW5-10 implementation touch list)

| File | Role |
|------|------|
| `packages/workspace-sdk/src/manifest.schema.ts` | optional `wizardResume` block |
| `packages/workspaces/denali/workspace.manifest.json` | declare module binding |
| `scripts/codegen/workspace-registry/domains/wizard-host.mjs` | hook projection |
| `apps/web/src/wizard/workspace-wizard-host.tsx` | unchanged if hook still injected via plugin |
| `packages/workspaces/denali/test/resolve-initial-step-index.spec.ts` | parity |
| `apps/web/test/wizard-host-boundary.spec.ts` | host boundary |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/decisions/DEC-CW-05-evidence.md`.*
