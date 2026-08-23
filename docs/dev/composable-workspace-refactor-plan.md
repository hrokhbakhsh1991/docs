# COMPOSABLE WORKSPACE REFACTOR MASTER PLAN

**Ledger id:** CW-PLAN-2026-08-23  
**Status:** CW-S1 IN PROGRESS (canonical ledger: `docs/dev/composable-workspace-refactor-plan.md`)  
**Mandatory evidence inputs (do not re-audit):**

- `.architecture-analysis/COMPOSABLE-WORKSPACE-ARCHITECTURE-AUDIT.md` (AUDIT)
- `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` (TRUTH)
- `.architecture-analysis/SHARED-TOUR-CORE-EXTRACTION-FEASIBILITY.md` (FEAS)

Scratch mirror of canonical ledger `docs/dev/composable-workspace-refactor-plan.md`. Do not edit TEMP alone — keep in sync with tracked copy.

Status markers: `[ ]` not started · `[v]` implementation/evidence exists, closure verification required · `[x]` complete · `[!]` blocked

---

## Versioning / canonical ledger

**Problem:** `TEMP/` is gitignored (`.gitignore:42`). A gitignored file cannot be the durable source of truth for a multi-phase refactor: it is invisible to reviewers, absent from Cloud Agent snapshots built from git, and unrecoverable if the working tree is lost.

**Binding versioning plan (do not execute yet):**

1. Planning source remains `TEMP/COMPOSABLE_WORKSPACE_REFACTOR_PLAN_2026-08-23.md` until CW-S1 is explicitly approved.
2. CW-S1 first copies the finalized ledger to **`docs/dev/composable-workspace-refactor-plan.md`**.
3. The tracked document becomes canonical **before any implementation commit closes**.
4. `TEMP/` may remain only as an untracked scratch/mirror; it must never supersede the tracked copy.
5. Status-marker updates are committed together with the slice they close ("ledger update" lines in the same PR).
6. No phase closes while its only ledger is under gitignored `TEMP/`.
7. The repo Doc-Gate / guard-docs applies to `docs/` changes accompanying protected-package edits; the ledger copy rides CW-S1, which also touches `packages/`.

Until that copy, this TEMP file is authoritative for planning only. Afterward, only `docs/dev/composable-workspace-refactor-plan.md` is canonical.

---

## Package decision record — `@app-tour/tour-core`

**Boundary choice:** new package `packages/tour-core` (`@app-tour/tour-core`) is preferred. **Dependency direction is governed by DEC-CW-07 below**, which supersedes the earlier FEAS assumption `tour-core → workspace-sdk`.

| Aspect | Decision | Evidence |
|--------|----------|----------|
| **Why a new package** | Tour/registration behavior needs an enforceable domain boundary separate from wizard engine and plugin SDK. Existing precedent: `booking-http-contracts` and `finance-core` are domain packages with explicit ownership | FEAS §4 |
| **Why not `platform-core`** | Its `package.json` description is "Schema-driven wizard engine — workspace-agnostic"; its test surface (purity, cold-start, runtime-isolation contracts) certifies an **engine**, not business orchestration. Mixing tour lifecycle into it couples engine release cadence to domain churn and dilutes its purity guards | FEAS §4; `packages/platform-core/package.json` |
| **Why not `workspace-sdk`** | Already 173 src TS files defining the **plugin contract**; adding orchestration makes it a dumping ground. Compatibility imports must not force a cycle; DEC-CW-07 places tour-facing contracts below or in tour-core, with SDK adapting/re-exporting one-way | FEAS §1, §4; cycle analysis below |
| **Allowed dependencies** | Per DEC-CW-07: `tour-core → booking-http-contracts` (and standard library) only; `workspace-sdk → tour-core` is allowed for compatibility re-exports. A future lower-level `tour-contracts` package requires a new recorded decision | DEC-CW-07 |
| **Forbidden dependencies** | `@app-tour/platform-core` (engine↔domain cycle risk), `packages/workspaces/*` (inverts ownership), `apps/*` (packages never import apps), `finance-core` (finance stays a peer capability; interaction via ports only) | FEAS §2.5 |
| **Ownership boundary** | tour-core owns: pure tour/registration math, port **interfaces** (publish visibility, capacity, list projection, registration orchestration), generic transition-table infrastructure. tour-core must NOT own: canonical field paths, publish label strings, workspace vocabularies, UI, persistence, adapters | TRUTH §SAFE / §MUST-NOT |
| **Boundary enforcement** | depcruise rule + import-boundary AST guard added in CW1-01, extended CW5-01; `guard:workspace-registry-fresh` unaffected | AUDIT §15 |
| **Reversal / rollback strategy** | Every moved SDK export leaves a one-way SDK compatibility re-export from tour-core until CW5-09. If the boundary proves wrong before CW5-09: restore implementations in SDK/original owners, repoint exports, remove consumers of tour-core, then delete package. No consumer imports are retired before census. After CW5-09 reversal cost rises; CW5-09 requires explicit architecture review | DEC-CW-07; CW5-09 |

---

## Executive summary

Target: `workspace = shared domain core + selected capabilities + workspace policy + branding/config`.

Evidence-established facts constraining this plan:

- Denali (393 src TS files) is the certified product, **not** the platform default (TRUTH §Semantic divergence; FEAS §2.3).
- Urban is an **intentionally divergent** vertical: separate `urban_registrations` table, `confirmed`/`waitlist` at intake, archive support, no `workspaceBooking` (TRUTH §9, §11, §14).
- `approved` ≠ `confirmed` — different strings, different persistence, different timing; unification is a product decision (DEC-CW-01), not a refactor task.
- Formal capability seams already exist and work: `workspaceFinance`, `workspaceBooking`, `catalogRegistrationFlow` (AUDIT §6).
- Extraction must be strangler-style; Big Bang is forbidden (FEAS §3, §8).

The plan has **10 phases (CW-0…CW-9), 91 implementation/evidence tasks** plus **7 decision records** (contingency range 74–94 tasks with discovered follow-ups). Highest risk concentrates in CW-3, CW-5, CW-7.

---

## Current baseline

| Fact | Evidence |
|------|----------|
| Wizard engine + canonical validation generic and tested | AUDIT §4; `platform-core` engine specs |
| Booking pipeline shared when `workspaceBooking` bound; statuses `pending/approved/waitlisted/rejected/cancelled` | TRUTH §13–18; `booking-lifecycle.spec.ts` |
| Urban registration: `confirmed`/`waitlist` decided at create via `resolveRegistrationCapacityDecision`; own table | TRUTH §9, §11; `registration-capacity.service.ts` |
| Publish vocabulary split: Denali `active`, Urban/Harbor `published` (+`archived`), plugin lifecycle `DRAFT/OPEN`; API bridges via label heuristics | TRUTH §5; `assert-tour-publish-lifecycle-gate.ts` |
| P1 host coupling: `ensure-registration-flow.client.ts` hand switch; IRR/toman `pluginId === "denali"` in marketing + web | AUDIT §7–8; FEAS §1 UI table |
| 40+ hand-written API files import `@app-tour/workspace-denali` (excl. generated) | FEAS §2.4 |
| Parallel Denali booking lifecycle graph duplicates host transitions | TRUTH §MUST NOT; FEAS §2.3 |
| New similar workspace today: ~80–120 hand modules (Denali-fork) | FEAS §6 |
| Guards: isolation, no-branch, registry freshness, certification all green baseline | AUDIT §15 |

---

## Target architecture

```
@app-tour/workspace-sdk          contracts, plugin, manifest types, ports
@app-tour/tour-core   (NEW)      tour+registration orchestration, pure rules, port interfaces
@app-tour/platform-core          wizard engine, field-policy engine, exposure engine (unchanged role)
@app-tour/booking-http-contracts booking wire enums/DTOs (unchanged)
workspaces/*                     adapters, field registries, composites, policy, branding
```

Dependency rule (DEC-CW-07): `workspace-sdk → tour-core → booking-http-contracts`. `tour-core` must not import `workspace-sdk`, `platform-core`, `packages/workspaces/*`, or `apps/*`.

A new workspace at CW-9 = manifest (profile + capability blocks) + policy hook modules + branding/theme + thin adapters. No Denali clone. No host edits.

---

## Non-goals / forbidden genericization

Execution MUST NOT (each item cites evidence):

1. Treat Denali semantics as platform default because Denali is most complete (TRUTH preamble).
2. Globally rename `approved` ↔ `confirmed` (TRUTH §14; DEC-CW-01).
3. Unify `operator_registrations` and `urban_registrations` persistence without product decision (FEAS §7; DEC-CW-01).
4. Move `DENALI_FROZEN_TEMPLATE_FIELDS` into shared core (TRUTH §19, §MUST NOT).
5. Move Denali trek publish-readiness matrix (`collectDenaliPublishReadinessRuleIssues`) into shared core (TRUTH §4).
6. Genericize Denali transport dong/personal-car rules (TRUTH §24).
7. Genericize Denali `self`/`other` registrant + nationalId behavior (TRUTH §12).
8. Add platform-level IRR/toman formatting rules — currency display becomes workspace config, not a core rule (AUDIT §8).
9. Make Denali equipment icon registry the generic default (FEAS §2.4 `parse-equipment-icon-key.ts`).
10. Add `if (workspaceType === …)` / `if (pluginId === …)` in neutral core/host code — generated dispatch only (guard `guard-no-workspace-type-branches.mjs`).
11. Big Bang migration of the Denali field registry or composites (FEAS §8).
12. Remove any old path before parity evidence exists for zero remaining consumers (Migration safety, below).
13. Normalize `waitlisted` ↔ `waitlist` strings without DEC-CW-01 resolution (TRUTH §16).
14. Make archive a generic lifecycle state before DEC-CW-02 (TRUTH §6).

---

## Decision gates

Execution HALTS at each gate; Cursor must not infer product semantics.

Cursor must never infer product semantics; each gate lists exactly which tasks stop and the latest safe execution point.

### DEC-CW-01 — `confirmed` vs `approved` state model

- **Question:** distinct concepts (two registration models) or one normalized state model with per-workspace strategy?
- **Evidence of ambiguity:** TRUTH §9, §14, §27 — portal label map excludes `confirmed`; separate tables.
- **Blocks directly:** CW4-05, CW4-08 (final classification rows), CW5-05, CW9-05.
- **Blocks transitively:** CW9-06, CW9-07, CW9-09, CW9-10 full different-vertical closure. CW9-08 may still publish club-only metrics.
- **Does NOT block exactly:** CW0-01..10; CW1-01..06; CW2-01..07; CW3-01..09; CW4-01..04, CW4-06..07; CW5-01..04, CW5-06..11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..15; CW8-01..07; CW9-01..04, CW9-08 (club-only run).
- **Latest safe point:** end of CW4-04 (booking SoT work is vocabulary-preserving); decision required before starting CW4-05.
- **Decision owner:** Product owner for Registration + Architect.
- **Evidence required:** signed semantic mapping for accepted-seat meaning, lifecycle transition matrix, persistence migration intent (none vs migration), portal/operator display requirements, backward-compatibility requirements.
- **While unresolved:** **DEFER blocked tasks; CONTINUE OTHER TASKS**.

### DEC-CW-02 — archive: generic lifecycle vs workspace/vertical capability

- **Evidence:** TRUTH §6 — Urban-only; Denali has no archive path.
- **Blocks directly:** CW3-05 archive-row final semantics; CW5-04 archive enumeration only; CW9-05 archive assertions only.
- **Blocks transitively:** no whole task when the documented not-published placeholder is used; only archive-specific acceptance evidence is deferred.
- **Does NOT block exactly:** CW0-01..10; CW1-01..06; CW2-01..07; CW3-01..04, CW3-06..09; CW4-01..08; CW5-01..03, CW5-05..11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..15; CW8-01..07; CW9-01..04, CW9-06..10.
- **Latest safe point:** CW3-05 may complete with the placeholder; decision required before CW-5 encodes any lifecycle-state enum containing archive, i.e. before CW5-04 closure review.
- **Decision owner:** Tour product owner + Architect.
- **Evidence required:** Denali archive product requirement, Urban archive transition rules, catalog visibility after archive, restoration/unarchive requirement.
- **While unresolved:** **DEFER archive-specific rows; CONTINUE OTHER TASKS**.

### DEC-CW-03 — capacity-decision-at-create as first-class strategy

- **Evidence:** TRUTH §11, §13; FEAS §2.2 — Urban decides `confirmed`/`waitlist` at create; booking decides at approve.
- **Blocks directly:** CW1-03, CW1-05, CW1-06; CW4-05; CW5-03 Urban-strategy portion, CW5-05; CW9-05.
- **Blocks transitively:** CW9-06, CW9-07, CW9-09, CW9-10 full different-vertical closure. It does not block CW-3 or the CW-5 core exit.
- **Does NOT block exactly:** CW0-01..10; CW1-01..02, CW1-04; CW2-01..07; CW3-01..09; CW4-01..04, CW4-06..08; CW5-01..02, CW5-03 non-Urban portion, CW5-04, CW5-06..11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..15; CW8-01..07; CW9-01..04, CW9-08 (club-only run).
- **Latest safe point:** CW1-02 may complete; decision required before CW1-03. CW-1 may pause after CW1-04 with CW1-03/05/06 deferred.
- **Decision owner:** Registration product owner + Architect + data owner.
- **Evidence required:** desired reusable strategy contract, Urban roadmap, booking-capability adoption intent, capacity timing invariants, persistence constraints.
- **While unresolved:** **DEFER CW1-03/05/06 and downstream strategy tasks; CONTINUE OTHER TASKS**.

### DEC-CW-04 — member-portal status display for non-booking workspaces

- **Evidence:** TRUTH §27 — `format-member-registration-display.server.ts` translates booking vocabulary only; `confirmed` falls through as raw string.
- **Blocks directly:** CW4-06, CW9-06.
- **Blocks transitively:** CW9-10 full different-vertical certification sign-off.
- **Does NOT block exactly:** CW0-01..10; CW1-01..06; CW2-01..07; CW3-01..09; CW4-01..05, CW4-07..08; CW5-01..11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..15; CW8-01..07; CW9-01..05, CW9-07..09.
- **Latest safe point:** end of CW9-04; required before CW9-05/06 (different-vertical cert).
- **Decision owner:** Portal product owner + Registration product owner.
- **Evidence required:** member-facing vocabulary/translation specification, supported member-app tiers, raw fallback acceptance.
- **While unresolved:** **DEFER blocked tasks; CONTINUE OTHER TASKS**.

### DEC-CW-05 — wizard resume placement

- **Evidence:** TRUTH §20 — `resolveDenaliInitialStepIndex` Denali-only; platform default noop.
- **Blocks directly:** CW5-10 only.
- **Blocks transitively:** none.
- **Does NOT block exactly:** CW0-01..10; CW1-01..06; CW2-01..07; CW3-01..09; CW4-01..08; CW5-01..09, CW5-11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..15; CW8-01..07; CW9-01..10.
- **Latest safe point:** any time before CW5-10 is picked up; if still open at CW-5 closure, CW5-10 carries into a later slice.
- **Decision owner:** Operator wizard product owner + Architect.
- **Evidence required:** resume UX requirement across Starter/Urban, whether noop remains valid, saved-index compatibility.
- **While unresolved:** **DEFER CW5-10; CONTINUE OTHER TASKS**.

### DEC-CW-06 — currency/locale display config shape

- **Evidence:** AUDIT §8 — IRR/toman keyed on `pluginId === "denali"`; replacement config target (manifest block vs tenant config) undesigned.
- **Blocks directly:** CW2-02, CW2-03, CW2-07 currency-specific assertions, CW7-11.
- **Blocks transitively:** CW7-12 (depends on CW7-11). Equipment/Transport minimum and CW-9 remain executable.
- **Does NOT block exactly:** CW0-01..10; CW1-01..06; CW2-01, CW2-04..06; CW3-01..09; CW4-01..08; CW5-01..11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..10, CW7-13..15; CW8-01..07; CW9-01..10.
- **Latest safe point:** CW-2 may start and complete CW2-04..06 first; decision required before CW2-02.
- **Decision owner:** Pricing product owner + Architect.
- **Evidence required:** tenant-vs-workspace override requirement, currency/scale contract, localization ownership, runtime configurability requirement.
- **While unresolved:** **DEFER CW2-02/03, CW2-07 currency guard, CW7-11; CONTINUE OTHER TASKS**.

### DEC-CW-07 — tour-core dependency direction and compatibility strategy

- **Decision:** **APPROVED by Architect (2026-08-23).** One-way dependency `workspace-sdk → tour-core → booking-http-contracts`. `tour-core` must **not** import `workspace-sdk`.
- **Why:** FEAS proposed `tour-core → workspace-sdk`, but CW5-02 requires SDK compatibility re-exports from tour-core. Both directions would create a package cycle. One-way SDK-to-domain dependency permits compatibility re-exports and keeps tour-core independent from plugin/workspace concepts.
- **Shared contract types:** tour-facing pure types live in `tour-core`; SDK-specific plugin/manifest types stay in `workspace-sdk` and may reference/re-export tour-core types. `tour-core` APIs use its own structural types, not `CanonicalDocument` from SDK.
- **Compatibility:** old SDK paths become one-way re-export/adapters importing tour-core. Old workspace-owned paths may also re-export tour-core directly. No tour-core import of those owners.
- **Lower-level contracts package:** **not required for CW-S1/CW-5 based on current evidence**. If a future type must be consumed by both packages while also requiring SDK implementation callbacks, stop and create DEC-CW-08 before introducing `tour-contracts`.
- **Allowed directions:** `workspace-sdk → tour-core`; `platform-core → workspace-sdk`; `workspaces/* → workspace-sdk|platform-core|tour-core`; `apps/* → all package APIs`; `tour-core → booking-http-contracts`.
- **Forbidden directions:** `tour-core → workspace-sdk|platform-core|workspaces/*|apps/*|finance-core`; `workspace-sdk → workspaces/*|apps/*`.
- **Rollback:** until CW5-09, restore implementation in original owner, repoint SDK/old-path exports, migrate direct tour-core consumers back, delete package. CW5-09 requires explicit Architect review.
- **Blocks directly:** CW1-01, CW5-01.
- **Blocks transitively:** CW1-02..06; CW3-01..09; CW4-01..08; CW5-02..11; CW6-01..04, CW6-05A, CW6-05B, CW6-06..07; CW7-01..15; CW8-01..07; CW9-01..10.
- **Does NOT block exactly:** CW0-01..10; CW2-01..07.
- **Latest safe point:** CW0-10. Architect approval recorded before CW1-01.
- **Decision owner:** Architect.
- **Evidence required:** package manifests (`platform-core → workspace-sdk` today), CW5-02 compatibility requirement, import-boundary guards, cycle analysis above.
- **Status:** **APPROVED** — CW-S1 authorized.

Rule: a `[!]` blocked marker with the DEC id is placed on any task reaching an unresolved gate. If a blocked task is reached mid-slice, the slice completes its unblocked remainder and surfaces the gate.

---

## Dependency graph

```
CW-0 (baseline freeze)
 ├──→ DEC-CW-07 ──→ CW-1 (pure math)
 │     ├──→ CW-3 (publish/lifecycle ports)
 │     │      └──→ CW-4 booking core (CW4-01..04,07)
 │     │             ├──→ CW4-05/08 registration divergence ←(DEC-CW-01, DEC-CW-03)
 │     │             └──→ CW-5 core orchestration (CW5-01..04,06..09,11)
 │     │                    ├──→ CW5-05 registration orchestration ←(DEC-CW-01, DEC-CW-03)
 │     │                    ├──→ CW-6 profile core (through CW6-05A/06/07)
 │     │                    ├──→ CW-7 (composable capabilities)
 │     │                    └──→ CW-8 (policy pipeline)
 │     │                           ├──→ CW6-05B (workspace-policy override proof)
 │     │                           └──→ CW-9 (certification)
 │     │                                  needs CW6 profile core + CW6-05B + CW7(min) + CW8
 │     └──→ CW-2 (host coupling removal)   [parallel track; only CW-0 required]
 └──→ CW-2
```

Refinement vs requested shape (evidence-based):

- **CW-2 depends only on CW-0**, not CW-1 — coupling fixes (registration-flow dispatch, currency display) don't need math extraction (FEAS Step 7 "parallel track").
- **CW-6 profile core does not require CW-8:** CW6-05A proves theme/intake/config overrides. **CW6-05B explicitly joins CW-6 and CW-8** after CW8-03; no interim hook exists.
- **CW-6 does not require CW-7 complete** — Starter Profile composes existing formal capabilities; tour-domain capabilities extend it later.
- **CW-9 requires a minimum CW-7 slice** (Transport OR Equipment), not all of CW-7 — certification of "capabilities compose" needs at least one extracted tour-domain capability.

---

## Phase table

| Phase | Goal | Tasks | Risk | Dependencies | Exit criteria |
|-------|------|-------|------|--------------|---------------|
| **CW-0** | Freeze externally observable behavior; golden/contract evidence + reproducible metrics baseline | 10 | LOW | — | Parity harness exists; all listed behaviors snapshotted; metrics baseline frozen; zero behavior change |
| **CW-1** | Extract proven-generic pure functions with compat re-exports | 6 | LOW | CW-0, DEC-CW-07; DEC-CW-03 for CW1-03/05/06 | CW1-02/04 may close independently; full phase requires DEC-CW-03 and all consumers green |
| **CW-2** | Remove P1 host/customer branching via config/registry | 7 | MEDIUM | CW-0 | Named host files free of workspace ids; guards extended; DEC-CW-06 resolved |
| **CW-3** | Neutral publish visibility/label ports; vocabulary preserved | 9 | HIGH | CW1-02/04 partial exit | Host lifecycle gate consumes manifest-declared labels; no hard-coded `published`/`active` heuristic without manifest entry |
| **CW-4** | Single booking lifecycle SoT; explicit intentional divergence | 8 | MEDIUM–HIGH | CW-3, DEC-CW-01, DEC-CW-03 | Parallel Denali graph demoted/removed; divergence documented as contract |
| **CW-5** | `@app-tour/tour-core` orchestration package | 11 | HIGH | CW-3 + CW4-01..04/07 for core exit; DEC-CW-01/03 for CW5-05/full exit | Core exit certifies neutral orchestration; full exit adds decided registration strategy |
| **CW-6** | Declarative Starter Profile (composition, not clone base) | 8 | MEDIUM | CW-5 for profile core; CW8-03 for CW6-05B/full exit | Profile-core exit: CW6-01..04,05A,06,07; full exit adds policy override proof CW6-05B |
| **CW-7** | Tour-domain capabilities: Transport, Equipment, Itinerary, Pricing fields, Membership link, Difficulty/Fitness | 15 | HIGH | CW-5 | Each shipped capability has contract+seams+isolation tests; Denali behavior unchanged |
| **CW-8** | Policy pipeline: shared → capability → workspace validation | 7 | MEDIUM | CW-5 | Ordered pipeline with certification; no core branching for workspace rules |
| **CW-9** | Synthetic-workspace certification (similar club + different vertical) | 10 | MEDIUM | CW6 profile core + CW6-05B, CW-8, ≥1 CW-7 capability | Metrics targets met; both synthetic workspaces onboard with zero host edits |

**Total: 91 implementation/evidence tasks + 7 decision records** (contingency range 74–94 tasks; see Estimation).

---

## Detailed task ledger

### CW-0 — Baseline & Semantic Freeze

> No production/test file changes to existing behavior; CW-0 ADDS parity fixtures/snapshot specs only (additive test assets are in scope for execution, not for this planning run).

- **CW0-01** `[x]` **Parity harness scaffold**
  - Objective: reusable golden-snapshot harness for cross-phase parity proofs.
  - Invariant: harness replays recorded inputs and diffs outputs byte/JSON-stable.
  - Evidence: FEAS §3 Step 0.
  - Files: new `test/parity/` (root) or `scripts/parity/`; no prod code.
  - Action: snapshot runner + fixture loader; wire to `test:changed`.
  - Focused validation: harness self-test.
  - Regression: none (additive).
  - Rollback: delete harness.
  - Deps: —. Risk: **LOW**.

- **CW0-02** `[ ]` **Publish transition goldens (Denali/Urban/Harbor/Starter)**
  - Invariant: `detectDenaliTourPublishTransition` (`draft`↔`active`), urban nested `tour.publishStatus` `published`, harbor `published`, starter lifecycle `DRAFT→OPEN` produce identical results pre/post any CW-3 change.
  - Evidence: TRUTH §5; `denali-tour-publish-transition.spec.ts`, `tour-publish-transition.spec.ts`.
  - Files: fixtures capturing canonical before/after pairs per workspace.
  - Validation: goldens match current spec outputs. Rollback: remove fixtures. Deps: CW0-01. Risk: **LOW**.

- **CW0-03** `[x]` **Capacity goldens (definition + consumption + release)**
  - Invariant: `sumApprovedPartySizeInTx` counts only `approved`; urban `sumAcceptedPartySize` counts only `confirmed`; cancel/reject excluded.
  - Evidence: TRUTH §8–10; `booking-approve-capacity.spec.ts`, `registration-capacity.spec.ts`.
  - Files: fixtures for both stores. Deps: CW0-01. Risk: **LOW**.

- **CW0-04** `[ ]` **Registration lifecycle goldens (booking path)**
  - Invariant: pending→approved/waitlisted/rejected/cancelled edges + outbox events (`registration.approved`, `.waitlisted`, `.cancelled`; reject silent).
  - Evidence: TRUTH §13–18; `booking-lifecycle.spec.ts`, `booking-reject-lifecycle.spec.ts`.
  - Deps: CW0-01. Risk: **LOW**.

- **CW0-05** `[ ]` **`approved`/`confirmed` divergence contract spec**
  - Invariant: documented, executable assertion that the two vocabularies live in different stores and neither maps onto the other today (negative test: portal label map excludes `confirmed`).
  - Evidence: TRUTH §14, §27.
  - Files: new contract spec in `test/parity/`.
  - Deps: CW0-01. Risk: **LOW**.

- **CW0-06** `[x]` **Public remaining capacity goldens**
  - Invariant: `spotsRemaining = max(0, totalCapacity − approvedPartySize)`; only `approved` counts.
  - Evidence: TRUTH §29; `compute-spots-remaining.spec.ts`, `catalog-spots-enrichment.spec.ts`.
  - Deps: CW0-01. Risk: **LOW**.

- **CW0-07** `[ ]` **Wizard validation + frozen-field goldens**
  - Invariant: Denali frozen set (category, title, destinationId, startDateTime, capacityMax, photos anchor, transport.mode) enforced; engine draft-vs-publish mode outputs stable; starter/urban minimal paths stable.
  - Evidence: TRUTH §19, §21–22; `ensure-tour-kind-template-field.spec.ts`, `canonical-validation-draft-vs-publish.spec.ts`.
  - Deps: CW0-01. Risk: **LOW**.

- **CW0-08** `[ ]` **Pricing/finance linkage goldens (affected surface only)**
  - Invariant: `resolveDenaliRegistrationObligationMinor` outputs; membership discount gate `readTourAllowMembershipDiscount` fail-closed behavior.
  - Evidence: TRUTH §25–26; `finance-obligation-denali.spec.ts`, `read-tour-membership-discount-gate.spec.ts`.
  - Deps: CW0-01. Risk: **LOW**.

- **CW0-09** `[x]` **Architecture metrics script (machine-repeatable)**
  - Objective: create `scripts/metrics/cw-architecture-metrics.mjs`; one command (`node scripts/metrics/cw-architecture-metrics.mjs`) emits exact JSON to stdout. CW9-08 reruns this exact command and schema.
  - Output schema: top-level `{ schemaVersion: 1, repositoryRef, rulesVersion: 1, metrics: {...}, evidence: {...} }`. Volatile timestamps, absolute paths, filesystem mtimes, and unordered object/set iteration are forbidden. Paths normalized repo-relative; arrays lexicographically sorted; JSON formatted with two spaces + trailing newline.
  - Fixed inclusion roots: `apps/api/src`, `apps/web/src`, `apps/portal/src`, `apps/marketing/src`, and `packages/*/src`.
  - Fixed exclusions: `packages/workspaces/**`, `legacy/**`, `**/node_modules/**`, `**/dist/**`, `**/*.generated.ts`, `**/*.spec.ts`, `**/*.test.ts`, fixture/smoke files matching `**/fixtures/**|**/*.fixture.ts|**/*smoke*`, plus a versioned per-rule allowlist exported inside the script (each entry requires path + rationale). Workspace IDs come from sorted `packages/workspaces/*/workspace.manifest.json` `id` values — never a hand-maintained name list.
  - Determinism invariant: two consecutive executions at the same git ref are byte-identical (`cmp` exit 0).
  - Measured counts (each with the precise rule, so numbers are reproducible, not judgment calls):
    1. **workspace-ID branches in neutral production code** — AST/regex census of equality comparisons, switch cases, and literal sets where a value equals any discovered workspace ID; emits `{count, hits:[{path,line,workspaceId,kind}]}`. `resolve-workspace-type.ts` smoke override appears only in the versioned allowlist and is emitted separately as `allowlistedHits`.
    2. **direct workspace/Denali imports from neutral host code** — static/dynamic import census matching `@app-tour/workspace-*`; emits total, Denali subtotal, and per-workspace sorted hits. Generated/spec/fixture exclusions above are binding.
    3. **generic host edits required for onboarding** — script reads versioned `scripts/metrics/cw-similar-workspace-onboarding-inputs.json` containing the canonical onboarding operation list, runs `workspace:create` in dry-run/planning mode (or imports its pure file-plan builder), expands registry output paths without writing, and counts planned **manual** edits outside `packages/workspaces/<id>/**` and generated outputs. If a required operation lacks a machine-readable planner, metric exits nonzero rather than accepting a manual estimate.
    4. **manual/copied modules for a similar workspace** — emits exact non-generated TS/TSX counts for (a) Denali source baseline, (b) guest scaffold file plan, and at CW9 (c) `cert-club`; copied-module detection uses content hash / normalized AST similarity against Denali with a fixed threshold recorded in `rulesVersion`.
    5. **shared Tour rules with single ownership** — a versioned rule catalog embedded as data (initial entries exactly TRUTH §SAFE SHARED CORE CANDIDATES) gives symbol names and permitted implementation patterns; emits implementation sites, re-export sites, and `singleOwner` boolean per rule. Any unknown/unresolved symbol fails the metric run.
    6. **formal reusable capabilities** — a capability qualifies only when all three machine checks pass: recognized manifest-schema key, generated binding/registry output, and certification/isolation spec. Emits named capability list + missing criterion per rejected candidate.
  - Evidence: FEAS §6; AUDIT §10, §15; guard sources under `scripts/guards/`.
  - Files: new script only (+ optional `scripts/metrics/README`); no prod code.
  - Focused validation: JSON-schema self-test; run twice + `cmp`; intentional fixture proving each inclusion/exclusion category; spot-check known facts without making estimates closure evidence.
  - Rollback: delete script.
  - Deps: —. Risk: **LOW**.

- **CW0-10** `[x]` **Baseline metrics capture (run + freeze)**
  - Invariant: CW0-09 script output stored as tracked baseline JSON next to the canonical ledger (e.g. `docs/dev/cw-metrics-baseline.json` — NOT under gitignored `TEMP/`) **before** any CW-1 move alters counts; Metrics table below updated with exact values replacing all approximations.
  - Deps: CW0-09. Risk: **LOW**.

**Exit CW-0:** all ten `[x]`; parity harness green in CI fast path; metrics baseline frozen; no diff in existing specs.

---

### CW-1 — Pure Shared Domain Math

- **CW1-01** `[x]` **Create `@app-tour/tour-core` package shell (math-only scope)**
  - Objective: package skeleton with the Package Decision Record dependency rules enforced.
  - Invariant: `workspace-sdk → tour-core → booking-http-contracts`; tour-core imports no workspace-sdk/platform-core/workspace/app modules; depcruise rule added.
  - Evidence: DEC-CW-07; Package decision record.
  - Files: `packages/tour-core/{package.json,tsconfig.json,src/index.ts}`; depcruise config.
  - Focused validation: build + boundary guard.
  - Regression: `guard:architecture`, `guard:import-boundary`.
  - Rollback: delete package (no consumers yet).
  - Deps: CW0-01, DEC-CW-07 approval (metrics baseline CW0-10 must land before CW1-02, not before empty shell). Risk: **LOW**.

- **CW1-02** `[x]` **Move `computeSpotsRemaining` / `withSpotsRemaining`**
  - Invariant: identical outputs for all golden fixtures (CW0-06).
  - Evidence: FEAS §2.1; TRUTH §29 (safe candidate).
  - Files: from `packages/workspaces/denali/src/catalog/compute-spots-remaining.ts` → `packages/tour-core/src/capacity/spots-remaining.ts`; **compat re-export left at old path**.
  - Focused validation: moved spec green from tour-core.
  - Regression: `catalog-spots-enrichment.spec.ts` unchanged and green.
  - Rollback: restore original file; delete tour-core copy.
  - Deps: CW1-01, CW0-06, CW0-10 (baseline frozen before ownership count changes). Risk: **LOW**.

- **CW1-03** `[!]` **Urban capacity-decision ownership (blocked: DEC-CW-03)**
  - Safe treatment selected: **Option B — keep implementation in its current API/Urban ownership until product semantics are decided.** No Urban `confirmed`/`waitlist` behavior enters tour-core merely because it is pure.
  - After DEC-CW-03: either (a) move it as an explicitly named reusable at-create strategy, preserving vocabulary, or (b) retain it as Urban-owned and close this task with ownership certification only.
  - Invariant: strings `confirmed`/`waitlist` preserved exactly; urban host wiring (`configure-product-http-hosts.ts` `decideRegistrationStatus`) behavior identical.
  - Evidence: FEAS §2.1 with rename warning; TRUTH §9.
  - Files after decision only: `apps/api/src/registrations/registration-capacity.service.ts`; potential destination determined by DEC-CW-03.
  - Focused validation: `registration-capacity.spec.ts`.
  - Regression: `urban-catalog-registration.spec.ts`.
  - Rollback: no-op while deferred; after decision use compat path.
  - Deps: CW1-01, CW0-03, DEC-CW-03. Risk: **LOW** (ownership-only/move-only; semantic changes forbidden).

- **CW1-04** `[ ]` **Migrate Denali catalog consumer to tour-core import**
  - Invariant: zero behavior diff (goldens CW0-06).
  - Files: denali catalog enrichment imports; compat re-export retained for other consumers.
  - Deps: CW1-02. Risk: **LOW**.

- **CW1-05** `[!]` **Migrate urban host wiring only if DEC-CW-03 chooses reusable strategy**
  - Files: `apps/api/src/http/configure-product-http-hosts.ts`.
  - Deps: CW1-03, DEC-CW-03. Risk: **LOW**.

- **CW1-06** `[!]` **Consumer census + old-path retirement check (blocked until DEC-CW-03 disposes CW1-03/05)**
  - Invariant: grep census shows zero non-re-export consumers of old paths; re-exports annotated `@deprecated` but NOT removed (removal is CW-5 cleanup after full census).
  - Deps: CW1-04, CW1-05 (or DEC-CW-03 decision to retain Urban path, which closes CW1-05 as not applicable). Risk: **LOW**.

**Exit CW-1:** CW1-02/04 form a stable partial exit with identical Denali behavior. Full phase closure requires DEC-CW-03 disposition for CW1-03/05/06; both workspaces green; tour-core has no workspace imports and no workspace-sdk import.

---

### CW-2 — Host / Customer Coupling Removal

- **CW2-01** `[ ]` **Prepare DEC-CW-06 evidence packet**
  - Objective: enumerate current formatter inputs and compare manifest-vs-tenant-config options without selecting product semantics.
  - Deps: CW0-09. Risk: **LOW**. Decision remains external.

- **CW2-02** `[!]` **Replace marketing IRR/toman `pluginId === "denali"` (blocked: DEC-CW-06)**
  - Invariant: Denali tenants render exactly as today (toman label); other workspaces unchanged; no workspace id in `format-catalog-display.ts`.
  - Evidence: AUDIT §8; FEAS §1 UI table.
  - Files: `apps/marketing/src/catalog/format-catalog-display.ts`; config source per DEC-CW-06 (likely manifest `catalogPresentation` extension + codegen).
  - Focused validation: marketing catalog snapshot per-workspace.
  - Regression: `guard-marketing-denali-boundary.mjs`; marketing specs.
  - Rollback: restore pluginId check (single file).
  - Deps: CW2-01, CW0-01. Risk: **MEDIUM**.

- **CW2-03** `[!]` **Replace operator tour-list IRR set `["denali"]` (blocked: DEC-CW-06)**
  - Files: `apps/web/src/features/tours/tour-list-formatters.ts`; same config seam as CW2-02.
  - Invariant/validation analogous. Deps: CW2-01. Risk: **MEDIUM**.

- **CW2-04** `[ ]` **Replace hand `switch(pluginId)` in `ensure-registration-flow.client.ts` with generated registry**
  - Invariant: identical flow module loaded per workspace (denali, guest-club, harbor, urban); lazy-load timing preserved.
  - Evidence: AUDIT §7 P1; FEAS Step 7.
  - Files: `packages/guest-workspace-runtime/src/ensure-registration-flow.client.ts`; codegen domain `registration.mjs` (extend to emit loader).
  - Focused validation: `guest-runtime-register-isolation.spec.ts`; portal flow contract spec per workspace.
  - Regression: portal E2E smoke (SMK-PTL-*).
  - Rollback: keep old switch behind unused export until census zero.
  - Deps: CW0-01. Risk: **MEDIUM**.

- **CW2-05** `[ ]` **Equipment icon key parsing behind generated settings binding**
  - Invariant: same accepted icon keys for Denali; workspaces without equipment module unaffected.
  - Evidence: FEAS §2.4 (`parse-equipment-icon-key.ts` imports Denali registry directly).
  - Files: `apps/api/src/settings/parse-equipment-icon-key.ts`; codegen `settings-api.mjs` binding.
  - Validation: `settings-resources.spec.ts`, `denali-equipment-icon-registry.spec.ts`.
  - Deps: CW0-01. Risk: **MEDIUM**.

- **CW2-06** `[ ]` **Exposure resolver imports via generated bindings only**
  - Invariant: `configure-product-http-hosts.ts` no direct `resolve-denali-surface-exposure` import; behavior identical.
  - Evidence: FEAS §2.4; AUDIT §7 P2.
  - Files: `apps/api/src/http/configure-product-http-hosts.ts`, `apps/api/src/exposure/workspace-exposure-host-bindings.generated.ts` (codegen extension).
  - Validation: exposure specs; reminder scheduler smoke.
  - Deps: CW0-01. Risk: **MEDIUM**.

- **CW2-07** `[ ]` **Extend `guard-no-workspace-type-branches.mjs` to lock CW-2 wins**
  - Invariant: guard fails on reintroduction of the removed patterns (marketing formatter, tour-list formatter, guest runtime switch).
  - Deps: CW2-02..06. Risk: **LOW**.

**Exit CW-2:** named host files contain no workspace identity; guards updated; Denali rendering byte-identical.

---

### CW-3 — Publish/Lifecycle Ports

- **CW3-01** `[ ]` **Design `TourPublishVisibilityPort` + manifest declaration**
  - Invariant: port answers "is publicly visible" per workspace without host label knowledge; Denali `active`, Urban/Harbor `published` preserved verbatim.
  - Evidence: FEAS §2.2, §3 Step 1; TRUTH §5, §30.
  - Files: `packages/workspace-sdk/src/tour/` new port type; manifest schema field (extends existing `canonicalTour` block); design doc in ledger appendix.
  - Deps: CW1-02, CW1-04, CW0-02 (does not depend on deferred Urban capacity tasks CW1-03/05/06). Risk: **MEDIUM** (design only).

- **CW3-02** `[ ]` **Codegen: publish-visibility dispatch bindings**
  - Files: `scripts/codegen/workspace-registry/domains/` (canonical/tour domain), new `*.generated.ts` dispatch.
  - Validation: `generate-workspace-registry.mjs --check` determinism; goldens CW0-02.
  - Deps: CW3-01. Risk: **MEDIUM**.

- **CW3-03** `[ ]` **Migrate marketing/portal catalog gating to visibility port (one consumer)**
  - Invariant: unpublished tours never exposed (negative fixtures per workspace).
  - Regression: `denali-catalog-exposure-prd.spec.ts`, `urban-public-catalog.spec.ts`, `to-harbor-catalog-card.spec.ts`.
  - Rollback: consumer flips back to direct `is*TourPublished` import.
  - Deps: CW3-02. Risk: **HIGH** (public exposure surface).

- **CW3-04** `[ ]` **Migrate registration published-tour gate to port (second consumer)**
  - Files: `requireWorkspacePublishedTour` call sites (denali/urban/harbor registration services keep same behavior via injected checker — already injectable, formalize source).
  - Deps: CW3-03. Risk: **MEDIUM**.

- **CW3-05** `[ ]` **Design neutral publish-label mapping table (manifest-declared, wire-only)**
  - Invariant: no global rename; mapping = workspace canonical strings → lifecycle contract states; Denali `active→OPEN-equivalent`, urban `published→…`, `archived` handling **deferred to DEC-CW-02** (map to non-published bucket until decided).
  - Evidence: TRUTH §2, §5; FEAS Step 2.
  - Deps: CW3-01; DEC-CW-02 for archive placement (partial block allowed: `archived` treated as not-published placeholder documented).
  - Risk: **HIGH** (design).

- **CW3-06** `[ ]` **Replace `isPublishedPublishStatusLabel` heuristics with manifest mapping**
  - Invariant: `assertTourPublishLifecycleOnUpdate` outcomes identical for all CW0-02 golden pairs.
  - Files: `apps/api/src/canonical/assert-tour-publish-lifecycle-gate.ts`, `workspace-canonical-tour-dispatch.ts`.
  - Focused validation: goldens; `tour-publish-transition.spec.ts`.
  - Regression: publish e2e (denali metadata-path publish integration spec).
  - Rollback: heuristic branch retained behind flag until parity proven, then removed (strangler).
  - Deps: CW3-05, CW3-02. Risk: **HIGH**.

- **CW3-07** `[ ]` **List projection dispatch (`extractTourListProjection` via generated bindings)**
  - Invariant: operator list chips identical (denali `active→open/active`, urban `published/archived/draft`).
  - Evidence: FEAS Step 5; TRUTH §6.
  - Files: `workspace-sdk/src/tour/tour-list-projection.contract.ts` + codegen + web consumer.
  - Validation: both `tour-list-projection.spec.ts` files.
  - Deps: CW3-02. Risk: **MEDIUM**.

- **CW3-08** `[ ]` **Publish-transition detector behind dispatch (census + migrate consumers)**
  - Invariant: outbox emission points unchanged (CW0-02, CW0-04 goldens).
  - Deps: CW3-06. Risk: **MEDIUM**.

- **CW3-09** `[ ]` **Guard: no hard-coded publish label heuristic in host**
  - Invariant: CI fails on new `=== "published" || === "active"` style checks in `apps/api/src/canonical` outside generated/mapping code.
  - Deps: CW3-06. Risk: **LOW**.

**Exit CW-3:** host consumes ports/mappings; each workspace keeps its own vocabulary; all goldens byte-identical.

---

### CW-4 — Booking / Registration Source-of-Truth Cleanup

> Gate: DEC-CW-01 and DEC-CW-03 must be answered before CW4-05+.

- **CW4-01** `[ ]` **Booking transition table census (host vs Denali parallel graph)**
  - Invariant: documented diff between `BookingsService` enforced edges and `DENALI_BOOKING_TRANSITIONS`; both allow pending→{approved,waitlisted,rejected,cancelled}, waitlisted→{approved,rejected,cancelled}, approved→cancelled.
  - Evidence: TRUTH §13–18; FEAS Step 4.
  - Deps: CW0-04. Risk: **LOW**.

- **CW4-02** `[ ]` **Promote host transition table to exported contract (booking-http-contracts or tour-core)**
  - Invariant: single machine-readable edge list; host service consumes it; wire enum unchanged.
  - Files: `packages/booking-http-contracts/src/` (+ service import).
  - Validation: `booking-lifecycle.spec.ts` unchanged.
  - Deps: CW4-01. Risk: **MEDIUM**.

- **CW4-03** `[ ]` **Denali ops manifest statusPipeline derives from shared contract**
  - Invariant: `bookings-ops-manifest.spec.ts` DN-B1-OPS-01 alignment becomes derivation, not manual sync.
  - Files: `packages/workspaces/denali/src/bookings/ops-manifest.ts`, `booking/status.ts`.
  - Deps: CW4-02. Risk: **MEDIUM**.

- **CW4-04** `[ ]` **Demote `denali/booking/lifecycle.ts` to derived/test-parity module**
  - Invariant: no production consumer relies on the parallel graph for authorization; history-append model either moved to shared contract or explicitly workspace-retained (documented).
  - Rollback: keep parallel file; mark `[v]` pending closure.
  - Deps: CW4-03. Risk: **MEDIUM**.

- **CW4-05** `[!]` **Registration model divergence contract (blocked: DEC-CW-01, DEC-CW-03)**
  - Objective: encode the decided relationship (distinct models vs strategy-unified) as SDK contract + certification spec.
  - Invariant: whichever decision — `urban_registrations` behavior unchanged unless product migration is separately approved.
  - Deps: CW4-02; DEC gates. Risk: **HIGH** (semantics).

- **CW4-06** `[!]` **Portal member-status mapping per DEC-CW-04**
  - Files: `apps/portal/src/me/format-member-registration-display.server.ts` (+ i18n) only after decision.
  - Deps: DEC-CW-04. Risk: **MEDIUM**.

- **CW4-07** `[ ]` **Shared invariant extraction: duplicate-protection contract doc + negative tests**
  - Invariant: booking DB partial uniques + probe kinds documented as capability behavior; urban email-unique documented as workspace policy; no code unification.
  - Evidence: TRUTH §12.
  - Deps: CW0-04. Risk: **LOW**.

- **CW4-08** `[ ]` **Explicit divergence ledger (intentional vs debt)**
  - Invariant: every TRUTH §Semantic-divergence row labeled `INTENTIONAL(contract)` or `DEBT(ticket)` in this file's appendix; no silent drift.
  - Deps: CW4-05 (or DEC answers). Risk: **LOW**.

**Exit CW-4:** one enforced transition SoT for booking; divergences explicit contracts; nothing merged "for neatness".

---

### CW-5 — Shared Tour Core Orchestration

- **CW5-01** `[ ]` **tour-core architecture doc + boundary guard hardening**
  - Invariant: DEC-CW-07 directions enforced: tour-core forbidden imports include workspace-sdk, platform-core, workspaces/*, apps/*, finance-core.
  - Evidence: DEC-CW-07; FEAS §2.5.
  - Deps: CW1-01, DEC-CW-07. Risk: **LOW**.

- **CW5-02** `[ ]` **Registration guard interfaces move (published-tour gate, departure-not-set, contact basics)**
  - Invariant: SDK imports/re-exports tour-core one-way; tour-core uses its own structural types and never imports SDK; behavior identical (goldens CW0-04).
  - Files: implementation from `workspace-sdk/src/http/workspace-registration-guards.ts` → tour-core; SDK path becomes one-way compatibility adapter/re-export.
  - Deps: CW3-04. Risk: **MEDIUM**.

- **CW5-03** `[ ]` **Generic capacity contracts (definition port + occupancy port)**
  - Invariant: capacity **paths** stay workspace adapters (`capacityMax` vs `tour.capacity` vs harbor chain); tour-core holds only the port types + arithmetic.
  - Evidence: TRUTH §8; FEAS §2.2.
  - Deps: CW1-02; DEC-CW-03 + CW1-03 only for an Urban at-create strategy portion. Risk: **MEDIUM**.

- **CW5-04** `[ ]` **Publish orchestration port set (visibility + label mapping + transition detection) formalized in tour-core**
  - Invariant: CW-3 dispatch types re-homed; consumers unchanged via re-exports.
  - Deps: CW3-06..08. Risk: **MEDIUM**.

- **CW5-05** `[!]` **Registration orchestration interfaces (blocked: DEC-CW-01, DEC-CW-03)**
  - Invariant: expresses BOTH models per DEC-CW-03 outcome — booking pending-pipeline and capacity-decision-at-create — as first-class strategies OR booking-only with urban explicitly outside; no forced convergence.
  - Deps: CW4-05 (gate). Risk: **HIGH**. `[!]` until DEC-CW-03.

- **CW5-06** `[ ]` **Shared state-transition infrastructure (generic transition table type + assert helper)**
  - Invariant: generic `TransitionTable<S>` used by booking contract (CW4-02) without changing edges.
  - Deps: CW4-02. Risk: **MEDIUM**.

- **CW5-07** `[ ]` **API canonical orchestration consumes tour-core interfaces (one write-path consumer: publish gate)**
  - Files: `apps/api/src/canonical/canonical-tour.service.ts` imports (types only) from tour-core.
  - Focused validation: full tour write integration suite; goldens.
  - Rollback: type re-import from old locations.
  - Deps: CW5-04. Risk: **HIGH**.

- **CW5-08** `[ ]` **Second consumer migration (tours validation-mode / dispatch)**
  - Files: `apps/api/src/tours/resolve-validation-mode.ts`, `workspace-tour-write-dispatch.ts`.
  - Deps: CW5-07. Risk: **HIGH**.

- **CW5-09** `[ ]` **Deprecated re-export retirement (CW-1..CW-5 accumulated)**
  - Invariant: zero consumers via census before each deletion; one deletion per commit.
  - Deps: CW5-07/08. Risk: **MEDIUM**.

- **CW5-10** `[!]` **Wizard-resume placement (blocked: DEC-CW-05)**
  - Deps: DEC-CW-05. Risk: **MEDIUM**. `[!]` until decided.

- **CW5-11** `[ ]` **tour-core certification spec (no workspace imports; parity suite green; public API snapshot)**
  - Deps: CW5-01..04, CW5-06..09. CW5-05 registration strategy is separately gated and not required for core package certification. Risk: **LOW**.

**CW-5 core exit (unblocks CW-6/7/8):** CW5-01..04, CW5-06..09, CW5-11 complete; tour-core owns neutral publish/capacity/transition infrastructure, with vertical/workspace rules excluded.  
**CW-5 full exit:** additionally CW5-05 complete after DEC-CW-01/03; CW5-10 may remain deferred per DEC-CW-05.

---

### CW-6 — Starter Profile

- **CW6-01** `[ ]` **Profile schema design (`profiles` or `extends` manifest block)**
  - Invariant: profile = named bundle of capability blocks + defaults; expansion is codegen-time, deterministic, inspectable.
  - Evidence: AUDIT §12 Phase 2; FEAS Step 8.
  - Deps: CW5-11. Risk: **MEDIUM**.

- **CW6-02** `[ ]` **Codegen profile expansion + `--check` determinism**
  - Files: `manifest.schema.ts`, `generate-workspace-registry.mjs`, new domain module.
  - Deps: CW6-01. Risk: **MEDIUM**.

- **CW6-03** `[ ]` **`starter-outdoor` profile definition (composes existing RC capabilities: booking, finance, registration-flow, catalog presentation, member profile)**
  - Invariant: profile references capabilities by contract, not by copying Denali modules.
  - Deps: CW6-02. Risk: **MEDIUM**.

- **CW6-04** `[ ]` **`workspace:create --profile` scaffold path**
  - Files: `scripts/workspace-create.mjs` extension.
  - Deps: CW6-03. Risk: **LOW**.

- **CW6-05A** `[ ]` **Theme/intake/config override proof (independent profile-core proof)**
  - Invariant: synthetic profile workspace overrides branding/theme, intake fields, and supported config via existing declarative seams only; no policy hook and no core edits.
  - Deps: CW6-04. Risk: **MEDIUM**.

- **CW6-05B** `[ ]` **Workspace-policy override proof (CW-6/CW-8 join)**
  - Invariant: synthetic profile workspace adds workspace policy through the formal CW8-03 seam; no interim hook, no host/core edits.
  - Deps: CW6-04, CW8-03. Risk: **MEDIUM**.

- **CW6-06** `[ ]` **Profile certification test (manifest → expected capability set, exact)**
  - Evidence: AUDIT §15 missing-cert #1.
  - Deps: CW6-03. Risk: **LOW**.

- **CW6-07** `[ ]` **Docs: profile authoring guide (in ledger appendix / docs gate per repo rules at execution time)**
  - Deps: CW6-06. Risk: **LOW**.

**CW-6 profile-core exit:** CW6-01..04, CW6-05A, CW6-06..07 complete; new manifest boots a working minimal workspace with declarative theme/intake/config overrides; no clone.  
**CW-6 full exit:** additionally CW6-05B complete after CW8-03; workspace-policy override proven without interim architecture.

---

### CW-7 — Composable Tour Capabilities

> Largest phase. Ship capabilities ONE at a time; each is its own pausable slice. Order by value/risk: Equipment → Transport → Difficulty/Fitness → Itinerary → Pricing fields → Membership link.

Per-capability required artifacts (applies to every CW7 block): configuration contract (manifest block), validation seam, UI seam, persistence ownership statement, registration mechanism (codegen), isolation tests.

- **CW7-01** `[ ]` Equipment: manifest block design (`workspaceEquipment`) + persistence statement (host `workspace_equipment` table stays host-owned reference data). Evidence: AUDIT §6 WL; FEAS §5. Deps: CW5-11, CW2-05. Risk: **MEDIUM**.
- **CW7-02** `[ ]` Equipment: codegen bindings + Denali adapter (icon registry stays Denali). Deps: CW7-01. Risk: **MEDIUM**.
- **CW7-03** `[ ]` Equipment: field-registry fragment as optional module; Denali parity goldens. Deps: CW7-02. Risk: **HIGH**.
- **CW7-04** `[ ]` Equipment: isolation test (workspace without module has zero equipment surface). Deps: CW7-03. Risk: **LOW**.
- **CW7-05** `[ ]` Transport: manifest block design (`workspaceTransport`) — generic snapshot contract only; dong/personal-car stays Denali policy. Evidence: TRUTH §24 MUST-NOT. Deps: CW5-11. Risk: **MEDIUM**.
- **CW7-06** `[ ]` Transport: intake initializer + registration snapshot via capability binding (existing `transportInitializerExport` generalized). Deps: CW7-05. Risk: **HIGH**.
- **CW7-07** `[ ]` Transport: Denali adapter migration + parity (registration flow goldens, roster projections `transportKind` unchanged). Deps: CW7-06. Risk: **HIGH**.
- **CW7-08** `[ ]` Transport: isolation test. Deps: CW7-07. Risk: **LOW**.
- **CW7-09** `[ ]` Difficulty/Fitness: presentation gates already manifest (`catalogPresentation`); add optional field-module contract; Denali fields stay vertical. Deps: CW5-11. Risk: **MEDIUM**.
- **CW7-10** `[ ]` Itinerary: capability block (detail-section gate exists); wizard composite stays workspace UI. Deps: CW5-11. Risk: **MEDIUM**.
- **CW7-11** `[!]` Pricing fields: base-price field module contract; IRR/toman remains workspace config (blocked: DEC-CW-06 through CW2-02/03). Deps: CW5-11, CW2-02/03. Risk: **MEDIUM**.
- **CW7-12** `[!]` Membership link: formalize `pricing.allowMembershipDiscount` as capability-declared field consumed by finance gate (transitively blocked by DEC-CW-06 through CW7-11). Evidence: TRUTH §25; AUDIT §6 SC-small. Deps: CW7-11. Risk: **LOW**.
- **CW7-13** `[ ]` Capability composition matrix test (enable/disable combinations on synthetic manifest; registry `--check` deterministic). Deps: CW7-04, CW7-08 (min: equipment+transport). Risk: **MEDIUM**.
- **CW7-14** `[ ]` Denali full regression checkpoint (certified suite + goldens) after each shipped capability — recurring gate task. Risk: **LOW** each run.
- **CW7-15** `[ ]` Guard: capability modules cannot import Denali product ids (extend `denali-coupling.contract.spec.ts` scope to capability packages). Deps: CW7-02. Risk: **LOW**.

**Exit CW-7 (minimum for CW-9):** Equipment + Transport shipped with all six artifacts each; Denali parity proven. Remaining capabilities may trail.

---

### CW-8 — Workspace Policy Pipeline

- **CW8-01** `[ ]` **Pipeline contract design: `sharedValidation → capabilityValidation → workspacePolicyValidation`**
  - Invariant: ordered, short-circuit semantics defined; existing flat hooks (`WorkspaceValidationHooks`, `validatePublishReadiness`) mapped into stages without behavior change for Denali/Urban.
  - Evidence: AUDIT §7 missing seam; FEAS §2.2.
  - Deps: CW5-11. Risk: **MEDIUM**.

- **CW8-02** `[ ]` **Host runner implementation behind flag; legacy path default**
  - Files: `apps/api/src/tours/run-workspace-validation-hooks.ts` successor.
  - Focused validation: pipeline-order unit tests. Deps: CW8-01. Risk: **MEDIUM**.

- **CW8-03** `[ ]` **Workspace policy hook seam (manifest-declared policy module per workspace)**
  - Invariant: a new workspace adds 2 custom rules via one policy module, zero host edits.
  - Deps: CW8-02. Risk: **MEDIUM**.

- **CW8-04** `[ ]` **Denali migration to pipeline stages (parity via CW0-07 goldens)**
  - Deps: CW8-03. Risk: **HIGH**.

- **CW8-05** `[ ]` **Urban migration to pipeline stages**
  - Deps: CW8-04. Risk: **MEDIUM**.

- **CW8-06** `[ ]` **Legacy flat-hook path removal after consumer census zero**
  - Deps: CW8-05. Risk: **MEDIUM**.

- **CW8-07** `[ ]` **Guardrails: pipeline-order certification + no-core-branching lint for policy modules**
  - Evidence: AUDIT §15 missing-cert #3.
  - Deps: CW8-04. Risk: **LOW**.

**Exit CW-8:** ordered pipeline live for both production workspaces; custom rules demonstrably host-edit-free.

---

### CW-9 — Composable Workspace Certification

- **CW9-01** `[ ]` **Define certification protocol + scenario inputs for the existing CW0-09 metrics script (no second metrics implementation)**
  - Invariant: cert-club/cert-events paths are supplied to schemaVersion 1 inputs; counting rules remain unchanged.
  - Deps: CW6-06. Risk: **LOW**.
- **CW9-02** `[ ]` **Synthetic similar-club workspace via profile (`cert-club`): scaffold from `workspace:create --profile starter-outdoor`**
  - Invariant: no Denali clone; no generic host edits; branding data-driven.
  - Deps: CW9-01, CW6-04, CW6-05A, CW7-13, CW8-07. Risk: **MEDIUM**.
- **CW9-03** `[ ]` **cert-club: enable equipment+transport+finance+booking; two custom policy rules via CW-8 seam**
  - Deps: CW9-02, CW6-05B. Risk: **MEDIUM**.
- **CW9-04** `[ ]` **cert-club: full behavior suite (publish, registration, capacity, waitlist, spots remaining) green**
  - Deps: CW9-03. Risk: **MEDIUM**.
- **CW9-05** `[!]` **Synthetic different-vertical workspace (blocked: DEC-CW-01, DEC-CW-03)**
  - Deps: CW9-01, CW6-05A, CW6-05B, CW8-07; DEC-CW-01/03 resolved. Risk: **MEDIUM**.
- **CW9-06** `[!]` **cert-events member-status display (blocked: DEC-CW-04)**
  - Deps: CW9-05. Risk: **MEDIUM**.
- **CW9-07** `[ ]` **Registry regeneration determinism proof (two runs byte-identical) with both synthetic workspaces**
  - Deps: CW9-03, CW9-05. Risk: **LOW**.
- **CW9-08** `[ ]` **Metrics rerun: execute the unchanged CW0-09 script; diff vs frozen CW0-10 baseline; publish deltas in ledger**
  - Invariant: same script, same rules — targets judged on identical measurement semantics; any script change between CW0 and CW9 requires re-running baseline on a pre-CW-1 ref for comparability.
  - Deps: CW9-04, CW9-06 (or CW9-04 alone if DEC-CW-04 still open — club metrics publishable independently). Risk: **LOW**.
- **CW9-09** `[ ]` **Guard sweep: all isolation/boundary/branch guards green with synthetics present**
  - Deps: CW9-07. Risk: **LOW**.
- **CW9-10** `[ ]` **Certification report + synthetic workspace retirement decision (keep as fixtures vs remove)**
  - Deps: CW9-06, CW9-08, CW9-09. Risk: **LOW**.

**Exit CW-9:** both synthetic onboardings meet metric targets; certification report appended to this ledger.

---

## Metrics

All baseline values below are provisional estimates; CW0-10 replaces them with exact machine-counted values from the CW0-09 script. CW9-08 reruns the identical script.

| Metric | Baseline (frozen at CW0-10) | Target at CW-9 |
|--------|------------------------------|----------------|
| Hand-written modules to onboard similar workspace | 458 Denali TS/TSX + 14 guest scaffold TS/TSX (machine count) | **≤ 30** (manifest+policy+branding+adapters) |
| Generic host files edited per new workspace | 5 manual host edit paths (machine count) | **0** (dev-host mapping automated or documented as env, not code) |
| Copied Denali modules per new workspace | field registry + composites + hooks (~30–40% of 393) | **0** |
| Workspace-ID branches in neutral production code (non-generated) | 33 (machine count; see cw-metrics-baseline.json) | **0** |
| Shared Tour rules with single ownership | singleOwnerRatio 0.6923 across TRUTH catalog (machine count) | **100% of SAFE-CANDIDATES list single-owned in tour-core/host** |
| Formal composable capabilities | 4 qualified formal capabilities (machine count) | **≥ 5 tour-domain** (equipment, transport, difficulty/fitness, itinerary, pricing-fields) |
| Blast radius — publish validation change | platform-core + 3 workspaces' rules | platform-core + rule data only (no host bridges) |
| Blast radius — capacity rule change | API + denali (+ divergent urban path) | tour-core contract + adapters |
| Blast radius — new shared wizard field | every workspace registry by hand | profile/capability module + opt-in |
| Blast radius — waitlist fix | API + denali + urban separately | booking contract single edit (urban per DEC-CW-01/03) |
| Blast radius — new reusable capability | schema+codegen+api+sdk (works today) | unchanged (already good) — keep ≤ current |

Measurement rules for every metric are fixed in CW0-09 (script), making baseline and CW-9 rerun directly comparable.

---

## Migration safety (binding policy)

Every MEDIUM/HIGH task uses strangler replacement:

```
old path valid
→ new neutral path introduced (flagged or additive)
→ parity test vs CW-0 goldens
→ one consumer migrates
→ regression proof
→ remaining consumers migrate one-by-one
→ old path removed ONLY at zero-consumer census (separate commit)
```

Additional binding rules:

- No large-scale file moves without behavioral proof.
- Never update golden/parity expectations to make a failing migration pass without a written semantic justification referencing TRUTH sections.
- One deletion per commit for old-path retirements.

---

## Pause points

Architecture is consistent (not half-migrated) if execution stops after:

| Pause point | State left behind |
|-------------|-------------------|
| **After CW-0** | Pure additive test assets; zero risk |
| **After CW1-02/04 partial exit** | tour-core has proven-generic spots math; Urban capacity strategy remains untouched pending DEC-CW-03 |
| **After full CW-1** | DEC-CW-03 disposition recorded; any moved Urban strategy is explicit; compat paths remain valid |
| **After CW-2** | Host cleaner; no structural change pending |
| **After CW-3** | Ports live; vocabularies intact; heuristics gone — stable plateau |
| **After CW-4** | Single booking SoT; divergence documented — stable plateau |
| **After CW-5 core exit** | neutral tour-core complete without unresolved registration strategy; **best long-pause point** |
| **After CW-6 profile-core exit** | Profile + theme/intake/config overrides shipped; policy proof correctly waits for CW8-03 |
| **After CW6-05B** | Full Starter Profile including policy override proof complete |
| **After each CW-7 capability** | Each capability is independently complete |
| **After CW-8** | Pipeline live; certification optional but recommended |

**Do NOT pause mid-CW-3 (between CW3-05 and CW3-06)** or mid-consumer-migration in any strangler sequence.

---

## Next-workspace milestone (risk-based recommendation, not a commercial blocker)

**Evidence does not prove that onboarding earlier is unsafe.** The Denali-adapter-fork path is certified and viable today (AUDIT §14: "onboard similar club via Denali adapter fork + manifest — works today, high maintenance"; harbor/PROD-4 prove admission). Therefore this section is a **risk/cost recommendation**, and commercial timing may override it with eyes open.

| Onboard after… | Risk accepted | Cost accepted |
|----------------|---------------|---------------|
| **Nothing (today)** | Publish-label heuristics must absorb a 4th vocabulary (TRUTH §5); customer-branch formatters may gain another `pluginId` entry (AUDIT §8) | Full Denali-fork maintenance (~80–120 hand modules); every CW phase later runs against 3 production workspaces instead of 2 — parity/migration effort grows roughly linearly with workspaces |
| **CW-0 only** | Same as above | Same, but golden parity floor protects the migration itself |
| **CW-0..CW-2** | Publish-label heuristics risk remains | Fork cost remains; no new customer-branch debt accrues |
| **CW-0..CW-3 (recommended)** | Residual: booking SoT duplication (CW-4) — contained, test-covered | Fork cost remains but new workspace binds ports, not heuristics |

**Recommendation:** complete **CW-0..CW-3** before signing the next similar club when schedule allows; if the deal cannot wait, minimum **CW-0** (parity floor + frozen metrics baseline) plus an explicit note in this ledger that a third workspace was onboarded pre-ports, which raises CW-3/CW-5 migration effort.

**Recommended additionally:** CW4-01..04 (booking SoT) if the new club uses operator approvals.

**Not needed for a similar club:** CW-6..CW-9 — becomes the recommendation before the SECOND additional club or the first materially different vertical (composition pays off at n≥2).

---

## Estimated size

| Phase | Tasks | LOW | MEDIUM | HIGH |
|-------|-------|-----|--------|------|
| CW-0 | 10 | 10 | 0 | 0 |
| CW-1 | 6 | 6 | 0 | 0 |
| CW-2 | 7 | 2 | 5 | 0 |
| CW-3 | 9 | 1 | 5 | 3 |
| CW-4 | 8 | 3 | 4 | 1 |
| CW-5 | 11 | 2 | 6 | 3 |
| CW-6 | 8 | 3 | 5 | 0 |
| CW-7 | 15 | 5 | 7 | 3 |
| CW-8 | 7 | 1 | 5 | 1 |
| CW-9 | 10 | 5 | 5 | 0 |
| **Total** | **91** | **38** | **42** | **11** |

- Contingency range: **74–94** (some CW-7 capabilities may merge tasks; DEC outcomes may add follow-ups).
- Consistent with the prior 50–90 evidence estimate; upper half confirmed by phase decomposition (CW-7 alone is 15).
- **Highest-risk phases:** CW-3 (public exposure + publish gate), CW-5 (write-path consumers), CW-7 (Transport/Equipment field-registry split).
- **Safe-to-pause phases:** after CW-1, CW-2, CW-3, CW-4, CW-5 (best), CW-6, each CW-7 capability.

---

## Execution policy (binding)

1. Cursor executes **one phase/slice at a time**; a slice = the task set explicitly named in the execution request.
2. No next MEDIUM/HIGH-risk phase starts until previous phase evidence is reviewed by a human (Architect).
3. MEDIUM/HIGH phase closure requires explicit human review recorded in this ledger (reviewer + date next to phase exit).
4. Commits small and slice-scoped; conventional messages; one logical change per commit.
5. Never combine unrelated migration slices in one branch/PR.
6. Never hide failing parity tests by updating expectations without semantic proof citing TRUTH sections.
7. Any unresolved DEC gate encountered mid-task → mark `[!]`, stop that task, continue only unblocked work, surface the gate in the run summary.
8. Repo verification policy applies: fast-track scripts first; full gates only with explicit human YES (`.cursorrules`).

---

## First execution slice (DO NOT EXECUTE YET)

**Slice CW-S1 — "Parity floor + metrics baseline + first pure move" (all LOW risk):**

**Mandatory preconditions (decision records are not counted as implementation tasks):**

- Architect explicitly approves **DEC-CW-07** one-way direction recorded above. If not approved, CW-S1 stops after CW0-10; CW1-01/02 do not start.
- User explicitly authorizes CW-S1 implementation.
- Finalized ledger is copied to `docs/dev/composable-workspace-refactor-plan.md`; tracked copy becomes canonical before implementation commits close. TEMP may remain scratch/mirror only.

**Binding order (decision checkpoint shown inline):**

1. **CW0-01** parity harness scaffold
2. **CW0-03** capacity goldens
3. **CW0-06** spots-remaining goldens
4. **CW0-09** architecture metrics script (deterministic JSON)
5. **CW0-10** baseline metrics capture (frozen before any move)
6. **DEC-CW-07 approval checkpoint** (Architect; mandatory, not counted as an implementation task)
7. **CW1-01** tour-core package shell + boundary guard
8. **CW1-02** move `computeSpotsRemaining` with compat re-export

Order is binding: metrics implementation precedes baseline; CW0-10 precedes ownership move; DEC-CW-07 approval precedes package creation; CW1-01 precedes function move.

Slice invariants (revalidated after plan hardening):

- **LOW risk:** every task LOW; no HIGH/MEDIUM in slice.
- **Zero semantic change:** additive test assets + script + empty package + verbatim function move with compat re-export; CW0-06 goldens prove byte-identical spots-remaining behavior.
- **No unresolved DEC gate at execution start:** DEC-CW-07 must be approved before CW1-01; DEC-CW-01..06 do not touch CW-S1 implementation tasks.
- **Independently rollbackable:** each step reverts alone — delete harness / delete fixtures / delete script / delete package / restore original file.
- **Parity-protected:** CW0-06 + CW0-03 goldens exist before CW1-02 executes; metrics baseline frozen at CW0-10.

Ledger copy is required by the preconditions; TEMP may remain an explicitly non-canonical mirror.

Explicitly NOT in slice 1: any CW-2 coupling fix (CW2-02/03 need DEC-CW-06), any publish-label work, any vocabulary handling, CW1-03 (Urban capacity-decision move — second slice, keeps slice 1 single-workspace-touching).

---

## Mechanical consistency record

Validated against this file after hardening:

| Check | Result |
|-------|--------|
| Task IDs | **91 definitions, 91 unique; no duplicates** |
| Phase totals | `10+6+7+9+8+11+8+15+7+10 = 91` |
| Risk totals | **38 LOW + 42 MEDIUM + 11 HIGH = 91**; every task has exactly one normalized risk |
| Decision records | **7 unique** (`DEC-CW-01..07`) |
| Dependency references | Every `CW*-*` and `DEC-CW-*` token in a `Deps` field resolves to a defined task/decision |
| Blocked tasks | Every `[!]` task names or transitively references a DEC gate |
| Graph alignment | CW-3 uses CW1-02/04 partial exit; CW-5 core does not require gated CW5-05; CW6-05B is explicit CW-6/CW-8 join; CW-9 requires CW6-05B |
| Pause safety | No pause declared between new-path introduction and first-consumer parity/removal; CW-1 partial pause leaves old Urban path untouched |
| Later-phase dependency | CW-6 profile-core exit excludes CW6-05B; full CW-6 exit explicitly waits for CW8-03 — no undocumented interim hook |

Validation command shape (planning-time, read-only): parse task headings; assert uniqueness; extract normalized `Risk`; sum by phase; parse `Deps` references against task/decision sets. Re-run whenever ledger task IDs/dependencies change.

---

## Appendix A — Divergence ledger (populated at CW4-08)

| Divergence | Classification | Contract/ticket |
|------------|----------------|-----------------|
| `approved` vs `confirmed` | pending DEC-CW-01 | — |
| `waitlisted` vs `waitlist` | pending DEC-CW-01 | — |
| `active` vs `published` labels | INTENTIONAL after CW-3 mapping | CW3-05 |
| Archive Urban-only | pending DEC-CW-02 | — |
| Capacity at approve vs at create | pending DEC-CW-03 | — |
| Flat vs nested canonical shape | INTENTIONAL (workspace canonical ownership) | list-projection port CW3-07 |

## Appendix B — Phase closure sign-offs

| Phase | Exit evidence link | Reviewer | Date |
|-------|--------------------|----------|------|
| CW-0 | — | — | — |
| CW-1 | — | — | — |
| CW-2 | — | — | — |
| CW-3 | — | — | — |
| CW-4 | — | — | — |
| CW-5 | — | — | — |
| CW-6 | — | — | — |
| CW-7 | — | — | — |
| CW-8 | — | — | — |
| CW-9 | — | — | — |

---

*Architect, documentation status: Not Needed (planning artifact under TEMP/, outside docs gate). Link to docs: n/a.*
