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

# Feature Delivery (FDA-001 v1.4)

Orchestrate end-to-end feature work on a **locked branch** with mandatory discovery, design, architecture gates, evidence ledger, queued execution, and stop conditions. Feature-agnostic — ticketing is a regression example only.

**Canonical charter:** [`docs/dev/feature-delivery-agent.mdoc`](../../../docs/dev/feature-delivery-agent.mdoc)

**Subdocs:**

| Topic                           | Path                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Staged design (D0–D7)           | [`docs/dev/feature-delivery/staged-design-workflow.mdoc`](../../../docs/dev/feature-delivery/staged-design-workflow.mdoc) |
| Adversarial bug hunt (B1–B8)    | [`docs/dev/feature-delivery/adversarial-bug-hunt.mdoc`](../../../docs/dev/feature-delivery/adversarial-bug-hunt.mdoc) |
| Research, design, UI/UX detail  | [`docs/dev/feature-delivery/research-and-design-gate.mdoc`](../../../docs/dev/feature-delivery/research-and-design-gate.mdoc) |
| Architecture classifier         | [`docs/dev/feature-delivery/architecture-classifier.mdoc`](../../../docs/dev/feature-delivery/architecture-classifier.mdoc) |
| Evidence ledger                 | [`docs/dev/feature-delivery/evidence-ledger-schema.mdoc`](../../../docs/dev/feature-delivery/evidence-ledger-schema.mdoc)   |
| Stop conditions                 | [`docs/dev/feature-delivery/stop-conditions.mdoc`](../../../docs/dev/feature-delivery/stop-conditions.mdoc)                 |
| Blocker recovery                | [`docs/dev/feature-delivery/blocker-recovery.mdoc`](../../../docs/dev/feature-delivery/blocker-recovery.mdoc)               |
| Completion regression fixture   | [`docs/dev/feature-delivery/completion-rules-regression-fixture.mdoc`](../../../docs/dev/feature-delivery/completion-rules-regression-fixture.mdoc) |
| Notification regression fixture | [`docs/dev/feature-delivery/notification-case-study.mdoc`](../../../docs/dev/feature-delivery/notification-case-study.mdoc) |
| UI UX Pro Max (advisory)        | [`.cursor/skills/ui-ux-pro-max/FDA-INTEGRATION.md`](../../ui-ux-pro-max/FDA-INTEGRATION.md)                               |
| Browser quality closure         | [`.cursor/skills/browser-quality-closure/SKILL.md`](../browser-quality-closure/SKILL.md)                                    |
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

## Lifecycle — staged design (D0–D7)

**Do not code after a basic plan.** Complete mandatory D-stages for session tier first — [staged-design-workflow](staged-design-workflow).

| Stage | Artifact | Gate |
| ----- | -------- | ---- |
| **D0** | `baseline.json` | Branch, HEAD, WIP, scripts, DB, browser, tests |
| **D1** | `requirements-matrix.json` | Actors, goals, states, exclusions, risk |
| **D2** | `consumer-and-boundary-map.json` | Routes→DB trace; ≥2 consumers if shared |
| **D3** | `data-contract-map.json` | Before DB/contract/outbox (Tier B/C) |
| **D4** | `architecture-review.json` | architecture-reviewer when triggers apply |
| **D5** | `ui-ux-decision.json` | Before user-visible code; UI UX Pro Max advisory |
| **D6** | `test-plan-and-realness.json` | Test design + classify existing tests |
| **D7** | `failure-mode-analysis.json` | Mandatory finance/identity/permission/notification/tenant |

### Workflow tiers

| Tier | Scope | Mandatory D-stages |
| ---- | ----- | ------------------ |
| **A** | UI-only, no API/DB | D0, D1 light, D5, D6 UI-focused |
| **B** | API/DB/BFF/migration | D0–D7 |
| **C** | Platform, finance, notification, tenant | D0–D7 full + all B-passes |

Record `workflowTier` in `baseline.json`.

### Implementation (after D-gates)

1. Implementation plan + vertical slice (smallest E2E)
2. Per finding: reproduce → root cause → fix → regression test → rerun
3. **No UI symptom fixes** when root cause is API/contract/persistence/auth

### Adversarial bug-hunt (B1–B8)

After implementation — [adversarial-bug-hunt](adversarial-bug-hunt):

| Pass | Focus |
| ---- | ----- |
| B1 | Static/structural |
| B2 | Contracts |
| B3 | Persistence/RLS |
| B4 | Integration/outbox |
| B5 | Browser/UI/UX (BQC) |
| B6 | Recovery/resilience |
| B7 | Regression suites |
| B8 | Independent second review |

Record `bug-hunt-matrix.json`, `bug-reproduction.json`.

### Verification, commit, report

```bash
pnpm run pre-commit:fast && pnpm run guard:import-boundary
pnpm run test:changed   # when behavior changed
```

Scope-guarded commit; final report lists **every D-stage, B-pass, queue item**; run `evaluate-fda-verdict.regression.mjs` before `FEATURE_COMPLETE*`.

**Legacy CP0–CP7** maps to D/B stages — see [feature-delivery-agent.mdoc](../../../docs/dev/feature-delivery-agent.mdoc) §3.3.

---

## Mandatory architecture re-evaluation

At **D2**, **D4**, **after vertical slice**, **B8**, and **before commit**:

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
6. **Never** `FEATURE_COMPLETE` while mandatory rows carry blocking statuses per [completion-rules](completion-rules.mdoc) §2.

**Artifacts:** `blocker-investigation.json`, `research.json` (when external), `requirement-queue.json`.

---

## Autonomy

After **D-stages + plan approval** for tier, agent may execute implementation and B-passes without micro-prompts.

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
| Baseline | `.cache/feature-delivery/<sessionId>/baseline.json` |
| Requirements matrix | `.cache/feature-delivery/<sessionId>/requirements-matrix.json` |
| Consumer map | `.cache/feature-delivery/<sessionId>/consumer-and-boundary-map.json` |
| Data contract | `.cache/feature-delivery/<sessionId>/data-contract-map.json` |
| Test plan / realness | `.cache/feature-delivery/<sessionId>/test-plan-and-realness.json` |
| Failure modes | `.cache/feature-delivery/<sessionId>/failure-mode-analysis.json` |
| Bug hunt matrix | `.cache/feature-delivery/<sessionId>/bug-hunt-matrix.json` |
| Bug reproduction | `.cache/feature-delivery/<sessionId>/bug-reproduction.json` |
| Design brief | `.cache/feature-delivery/<sessionId>/design-brief.json` |
| UI/UX decision | `.cache/feature-delivery/<sessionId>/ui-ux-decision.json` |
| Research | `.cache/feature-delivery/<sessionId>/research.json` |
| Requirement queue | `.cache/feature-delivery/<sessionId>/requirement-queue.json` |
| Blocker investigation | `.cache/feature-delivery/<sessionId>/blocker-investigation.json` |

**Rule:** No final-report claim without a ledger row.

---

## Full closure (mandatory work queue)

**Canonical rules:** [`completion-rules.mdoc`](../../../docs/dev/feature-delivery/completion-rules.mdoc) (FDA-001 v1.4)

Verdicts: `FEATURE_COMPLETE` \| `FEATURE_COMPLETE_WITH_EXPLICIT_ACCEPTED_RISKS` \| `FEATURE_INCOMPLETE` \| `FEATURE_BLOCKED`

| Rule | Behavior |
| ---- | -------- |
| Blocking statuses | `broken`, `missing`, `partial`, `skipped`, `unverified`, `browser-unverified`, `producer-missing`, `data-durability-unverified`, `rls-unverified`, `security-unverified` |
| Accepted risks | Explicit approval only; never security/RLS/tenant/durability/mandatory producers |
| Skipped B-pass | Stays `unverified`; blocks `FEATURE_COMPLETE` |
| Regression fixture | `node .cursor/skills/feature-delivery/evaluate-fda-verdict.regression.mjs` |

---

## Final report template

1. Branch, `initialHead`, `currentHead`, working tree, `workflowTier`
2. Design stages completed (D0–D7)
3. Bug-hunt passes completed (B1–B8)
4. Requirement queue — every item and status
5. Bugs found/reproduced/root causes/fixes/regression tests
6. Classification and architecture-reviewer verdict(s)
7. Files changed (within `scopePaths`)
8. Test/guard matrix; UI/UX findings; browser evidence
9. Skipped/unverified items; accepted risks with explicit approval
10. Verdict: `FEATURE_*` (evaluator-backed)
11. Commit SHAs and push result
12. `Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL].`

---

_FDA-001 v1.4 — staged design D0–D7, adversarial B1–B8, tiered depth, completion gating._
