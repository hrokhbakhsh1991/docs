---
name: feature-delivery
description: >
  Reusable architecture-aware feature delivery workflow for the app-tour pnpm monorepo.
  Use when implementing or completing a bounded feature on a locked branch: deep discovery,
  product/design/UI-UX gates, architecture classification, consumer scan, research, vertical
  slice, shared-boundary gates, browser verification, evidence ledger, bounded blocker recovery,
  and commit/push. Invoke at session start for any non-trivial feature (API, database,
  workspace-sdk, Portal/Web, notifications, identity, tenant routing). Do not use for
  docs-only typo fixes or one-line changes outside FDA scope.
disable-model-invocation: true
---

# Feature Delivery (FDA-001 v1.2)

Orchestrate end-to-end feature work on a **locked branch** with mandatory discovery, design, architecture gates, evidence ledger, queued execution, and stop conditions. Feature-agnostic — ticketing is a regression example only.

**Canonical charter:** [`docs/dev/feature-delivery-agent.mdoc`](../../../docs/dev/feature-delivery-agent.mdoc)

**Subdocs:**

| Topic                           | Path                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Research, design, UI/UX, queue  | [`docs/dev/feature-delivery/research-and-design-gate.mdoc`](../../../docs/dev/feature-delivery/research-and-design-gate.mdoc) |
| Architecture classifier         | [`docs/dev/feature-delivery/architecture-classifier.mdoc`](../../../docs/dev/feature-delivery/architecture-classifier.mdoc) |
| Evidence ledger                 | [`docs/dev/feature-delivery/evidence-ledger-schema.mdoc`](../../../docs/dev/feature-delivery/evidence-ledger-schema.mdoc)   |
| Stop conditions                 | [`docs/dev/feature-delivery/stop-conditions.mdoc`](../../../docs/dev/feature-delivery/stop-conditions.mdoc)                 |
| Blocker recovery                | [`docs/dev/feature-delivery/blocker-recovery.mdoc`](../../../docs/dev/feature-delivery/blocker-recovery.mdoc)               |
| Notification regression fixture | [`docs/dev/feature-delivery/notification-case-study.mdoc`](../../../docs/dev/feature-delivery/notification-case-study.mdoc) |
| Tiered testing                  | [`docs/dev/tiered-testing.md`](../../../docs/dev/tiered-testing.md)                                                         |
| Workspace API agnosticism       | [`docs/standards/workspace-api-capabilities.mdoc`](../../../docs/standards/workspace-api-capabilities.mdoc)                 |

**Pair with:** [`app-tour-architecture`](../app-tour-architecture/SKILL.md) for boundaries and fast-track verification.

**Architecture decisions:** read-only subagent [`.cursor/agents/architecture-reviewer.md`](../../agents/architecture-reviewer.md) — never substitute keyword classification for reviewer verdict.

**Safety rule:** [`.cursor/rules/feature-delivery.mdc`](../../rules/feature-delivery.mdc) is always on during FDA sessions.

**Repo tooling:** pnpm workspace only — never NX or `nx affected`.

---

## Session lock (every checkpoint)

Record at CP0 and verify before every checkpoint:

| Field          | Rule                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| `lockedBranch` | `git branch --show-current` at session start — **immutable**                        |
| `initialHead`  | `git rev-parse HEAD` at session start — **evidence baseline only**                  |
| `currentHead`  | May advance after authorized commits on `lockedBranch` — **not a branch violation** |
| `scopePaths`   | Glob allowlist from approved plan — amend only with user/architect approval         |

**Hard-stop** if `git branch --show-current` ≠ `lockedBranch` ([SC-GIT-01](stop-conditions)). Never `checkout`, `switch`, `merge`, `rebase`, `reset`, `clean`, `worktree`, or force-push.

Never compare `currentHead` to `initialHead` as an error when commits were authorized on the locked branch.

---

## Lifecycle (CP0–CP7)

### CP0 — Repository and requirement discovery

**Before any file edit.**

1. Confirm repository root; record `lockedBranch` and `initialHead`.
2. Inspect working-tree status; undeclared WIP outside scope → hard-stop until acknowledged ([SC-GIT-04](stop-conditions)).
3. **Deep discovery** per [research-and-design-gate](research-and-design-gate) §1 — AGENTS.md, pnpm graph, routes, BFFs, ports, outbox, Prisma/RLS, adjacent modules, tests, manifests, docs, runtime when needed. Use repo evidence only.
4. Build **requirement inventory** — classify capabilities; record actor, states, evidence requirements ([research-and-design-gate](research-and-design-gate) §2).
5. Derive `featureId` and `scopePaths`.
6. Classify per [architecture-classifier](architecture-classifier); run **consumer investigation** (≥2 consumers when platform candidate).
7. Invoke **architecture-reviewer** when: platform candidate, multi-consumer primitive, protected paths, or classifier `unknown`.

**Artifacts:** `requirement-inventory.json`, `requirement-queue.json` (initial).

**CP0 output:** discovery evidence, requirement inventory, classification signals, consumers, scope allowlist, test plan, doc-first requirement, risks.

### CP1 — Product, architecture, and UI/UX design gate

**No source implementation until CP1 complete.**

Produce reviewable **design brief** per [research-and-design-gate](research-and-design-gate) §3:

- Problem, member/operator/system journeys, domain boundary, classification, consumers, data/RLS, API/BFF, UI placement, desktop/mobile, RTL/LTR, all UI states, verification matrix, risks/exclusions.

Invoke **architecture-reviewer** with requirement inventory + design brief.

**Artifact:** `design-brief.json`. Perform **internet research** when design uncertainty warrants it ([research-and-design-gate](research-and-design-gate) §5) → `research.json`.

**Do not implement** until design brief is internally consistent and approved in chat (or explicit autonomy after CP1).

### CP2 — Implementation plan and consumer review

Produce implementation plan: task IDs, invariants, non-goals, files/packages, sequencing, risks/rollback, focused tests, evidence requirements.

Re-run **future-consumer analysis** ([research-and-design-gate](research-and-design-gate) §4).

**architecture-reviewer** on plan + consumer scan before CP3.

### CP3 — First vertical slice

1. Implement **smallest end-to-end slice** (one happy path).
2. Run focused validation.
3. **architecture-reviewer** on **actual diff**.
4. Re-run consumer analysis on slice shape.
5. **Stop** if narrower/broader than approved architecture ([SC-ARCH-03](stop-conditions)).

### CP4 — Pre-DB / shared-contract review

**Mandatory before** database, Prisma, `workspace-sdk`, HTTP contract, outbox, inbox, notification, identity, permission, tenant-routing, or `platform-core` changes:

1. Re-run consumer scan on proposed shape.
2. WAC-001 workspace-agnostic boundary.
3. Tenant/auth/RLS posture (FORCE RLS, no superuser proof).
4. Idempotency / dedupe / `rowVersion`.
5. **architecture-reviewer** verdict `proceed` or `proceed_with_accepted_risk`.
6. Doc-first on protected paths.

### CP5 — UI / browser integration review

Per [research-and-design-gate](research-and-design-gate) §6:

1. Portal vs Web ownership (PCMS-001).
2. Denali / Urban / starter divergence.
3. Existing UI placement before new routes/tabs.
4. Design tokens, primitives, RTL/LTR, responsive, all states.
5. **Browser proof** when user-visible — screenshots desktop/mobile; accessibility when available.
6. Never mark UI complete from curl/API/build alone.
7. **architecture-reviewer** when shared notification/inbox or cross-surface contracts touched.

### CP6 — Verification and blocker recovery

1. Run required tests for changed surfaces only.
2. `test:changed` gaps → explicit package tests + ledger ([SC-VERIFY-03](stop-conditions)).
3. Fast-track default:

   ```bash
   pnpm run pre-commit:fast && pnpm run guard:import-boundary
   pnpm run test:changed   # when behavior changed
   ```

4. Heavy gates need explicit user **YES** ([SC-VERIFY-04](stop-conditions)).
5. Ledger every command, exit code, artifact ([evidence-ledger-schema](evidence-ledger-schema)).
6. **SKIP ≠ PASS.** Unverified rows stay open.
7. On failure → [blocker-recovery](blocker-recovery) — up to 3 hypotheses before STOP.
8. **Queued execution:** blocked sub-feature must not stop unrelated queue items.
9. Update capability status per inventory — never claim complete for stub/route-only/admin-read-only.

Postgres/RLS: `DATABASE_URL` with `app_tour` role (NOSUPERUSER).

### CP7 — Scope-guarded commit/push and final report

1. Scope guard — only `scopePaths` staged ([SC-SCOPE-01](stop-conditions)).
2. Branch still `lockedBranch`.
3. Logical commits; no force-push.
4. `git push origin <lockedBranch>`.
5. Update `currentHead` after commits.
6. **Final report** — every queue item status; ledger-backed claims only.

**architecture-reviewer** on full diff before commit when platform candidates or multi-consumer primitives in scope.

---

## Mandatory architecture re-evaluation

At **CP0**, **CP1**, **after CP3 slice**, **before CP4 shared boundaries**, **CP5 UI**, and **CP7 commit**:

1. Reusable by another module/workspace?
2. Inspect future consumers (not only requesting module).
3. Detect domain-specific naming in shared tables/APIs.
4. Compare with standards and design freezes.
5. Invoke **architecture-reviewer** for platform candidates.

Keyword classification is **not** an architecture decision.

---

## Notification regression rule

[`notification-case-study.mdoc`](../../../docs/dev/feature-delivery/notification-case-study.mdoc) is a **mandatory regression fixture**.

Module-specific notification/inbox while booking, finance, payment, or wallet are plausible consumers:

1. **Stop** — **[SC-ARCH-02](stop-conditions)**.
2. Pivot memo.
3. Do not silently create another bespoke notification platform.

---

## Stop behavior

Hard-stop ([stop-conditions](stop-conditions)):

- Do not continue on blocked path.
- Do not auto-revert, switch branch, or hide failed tests.
- Emit **Feature Delivery STOP** report with `stopId`, checkpoint, evidence, pivot options, architect decision.

**Recoverable failures** → [blocker-recovery](blocker-recovery) first (unless `BR-SEC` / `BR-PROD`).

Resume only after explicit direction addressing stop ID.

---

## Blocker recovery (mandatory)

Per [blocker-recovery.mdoc](../../../docs/dev/feature-delivery/blocker-recovery.mdoc):

1. **Never stop on first failure** — classify, investigate, recover, or exhaust.
2. **11-step loop:** classify → inspect error/source → adjacent implementations → scripts/env → repo history/docs → web research when relevant → up to **3 hypotheses** → smallest fix → narrowest rerun → ledger → resume queue.
3. Categories: code, test, dependency, environment, browser/runtime, architecture, security/product (hard stop).
4. **Blocked sub-feature** must not stop unrelated queue items.
5. After **3 failed hypotheses** or architecture/security/product issue → STOP with evidence and options.
6. **Never** `COMPLETE` while mandatory rows `MISSING`, `PARTIAL`, `BLOCKED`, `SKIPPED`, or `UNVERIFIED`.

**Artifacts:** `blocker-investigation.json`, `research.json` (when external), `requirement-queue.json`.

---

## Autonomy

After **CP1 design + plan approval**, agent may execute CP2–CP7 without micro-prompts, subject to gates.

**Always stop for:** unresolved architecture, shared contracts, product scope change, migration rewrite, security/RLS ambiguity, branch mismatch, scope creep, missing evidence, staging/production without unlock.

---

## Invoking architecture-reviewer

Task tool with [`.cursor/agents/architecture-reviewer.md`](../../agents/architecture-reviewer.md). Pass: `featureId`, checkpoint, requirement inventory, design brief, UI/UX decisions, consumer list, research sources, changed files/plan, standards links.

Reviewer is **read-only**.

---

## Evidence ledger (session-local)

Per [evidence-ledger-schema](evidence-ledger-schema):

| Artifact | Path |
| -------- | ---- |
| Session lock | `.cache/feature-delivery/<sessionId>/SESSION.lock` |
| Ledger TSV | `.cache/feature-delivery/<sessionId>/evidence.tsv` |
| Arch review | `.cache/feature-delivery/<sessionId>/arch-review.json` |
| Requirement inventory | `.cache/feature-delivery/<sessionId>/requirement-inventory.json` |
| Design brief | `.cache/feature-delivery/<sessionId>/design-brief.json` |
| Research | `.cache/feature-delivery/<sessionId>/research.json` |
| Requirement queue | `.cache/feature-delivery/<sessionId>/requirement-queue.json` |
| Blocker investigation | `.cache/feature-delivery/<sessionId>/blocker-investigation.json` |

**Rule:** No final-report claim without a ledger row.

---

## Full closure (mandatory work queue)

**Audit completion ≠ feature completion.**

| Rule | Behavior |
| ---- | -------- |
| Mandatory rows | `MISSING` / `PARTIAL` / `BLOCKED` / `UNVERIFIED` blocks `COMPLETE` |
| SKIP | Never PASS or COMPLETE |
| Stub/route-only | Never complete capability |
| Admin read-only catalog | Not admin-complete without mutation path |
| Browser | curl/API/build ≠ browser-verified |
| Queue | Process independent items when one blocked |
| Final report | Lists every queue item; forbidden while rows open |

---

## Final report template

1. Branch, `initialHead`, `currentHead`, working tree
2. Requirement queue — every item and status
3. Classification and architecture-reviewer verdict(s)
4. Files changed (within `scopePaths`)
5. Test/guard matrix; capability status table
6. Artifacts (screenshots, research URLs, design brief ref)
7. Remaining / accepted risks
8. Commit SHAs and push result
9. `Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL].`

---

_FDA-001 v1.2 — deep discovery, design gate, research, UI/UX review, queued execution, bounded blocker recovery._
