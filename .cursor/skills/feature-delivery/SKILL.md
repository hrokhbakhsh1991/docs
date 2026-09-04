---
name: feature-delivery
description: >
  Reusable architecture-aware feature delivery workflow for the app-tour monorepo.
  Use when implementing or completing a bounded feature on a locked branch: discovery,
  architecture classification, consumer scan, plan gate, vertical slice, shared-boundary
  gates, UI integration, verification with evidence ledger, and commit/push. Invoke at
  session start for any non-trivial feature (API, database, workspace-sdk, Portal/Web,
  notifications, identity, tenant routing). Do not use for docs-only typo fixes or
  one-line changes outside FDA scope.
disable-model-invocation: true
---

# Feature Delivery (FDA-001)

Orchestrate end-to-end feature work on a **locked branch** with mandatory architecture gates, evidence ledger, and stop conditions. This Skill is the **main workflow** (Custom Mode entry point). It is feature-agnostic — ticketing is a regression example only.

**Canonical charter:** [`docs/dev/feature-delivery-agent.mdoc`](../../../docs/dev/feature-delivery-agent.mdoc)

**Subdocs:**

| Topic                           | Path                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
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

---

## Session lock (every checkpoint)

Record at CP0 and verify before every checkpoint:

| Field          | Rule                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| `lockedBranch` | `git branch --show-current` at session start — **immutable**                        |
| `initialHead`  | `git rev-parse HEAD` at session start — **evidence baseline only**                  |
| `currentHead`  | May advance after authorized commits on `lockedBranch` — **not a branch violation** |
| `scopePaths`   | Glob allowlist from approved plan — amend only with user/architect approval         |

**Hard-stop** if `git branch --show-current` ≠ `lockedBranch` ([SC-GIT-01](stop-conditions)). Never `checkout`, `switch`, `merge`, `rebase`, `reset`, `clean`, `worktree`, or force-push to fix branch mismatch.

Never compare `currentHead` to `initialHead` as an error when commits were authorized on the locked branch.

---

## Lifecycle

### CP0 — Bootstrap

**Before any file edit.**

1. Confirm repository root (`git rev-parse --show-toplevel`).
2. Record `lockedBranch` and `initialHead`; refuse to switch branch.
3. Inspect working-tree status (`git status --short`); detect undeclared existing changes outside declared scope → hard-stop until acknowledged ([SC-GIT-04](stop-conditions)).
4. Derive `featureId` (stable slug) and `scopePaths` from the feature request + inventory.
5. Classify the feature per [architecture-classifier](architecture-classifier) — output is **signals only**.
6. Run **consumer investigation** (codebase-memory graph, standards, outbox, ports, parallel implementations).
7. Invoke **architecture-reviewer** when: platform candidate, multi-consumer primitive, protected paths (`platform-core`, `workspace-sdk`, `apps/api`), or classifier `unknown`.

**CP0 output (required before CP1):**

- Architecture classification (proposed + reviewer verdict)
- Consumers and evidence
- Scope allowlist (`scopePaths`)
- Test plan (fast-track default; heavy gates need user YES)
- Documentation requirement (doc-first covenant if protected paths)
- Risks and unresolved decisions

### CP1 — Plan gate

Produce a **reviewable implementation plan** including:

- Task IDs
- Invariants and non-goals
- Files and packages in scope
- Dependencies and sequencing
- Risks and rollback
- Focused tests and regression tests
- Evidence requirements (ledger rows per claim)

**Do not implement** until the plan is reviewed or explicitly approved in chat.

### CP2 — First vertical slice

1. Implement the **smallest end-to-end slice** (one happy path).
2. Run focused validation on the slice.
3. Invoke **architecture-reviewer** on the **actual diff** (not the plan alone).
4. **Stop** if implementation is narrower or broader than the approved architecture ([SC-ARCH-03](stop-conditions), scope creep).

### CP3 — Shared boundary gate

**Mandatory before** database, Prisma, `workspace-sdk`, HTTP contract, outbox, inbox, notification, identity, permission, tenant-routing, or `platform-core` changes:

1. Re-run consumer scan on the proposed shape.
2. Confirm workspace-agnostic boundary (WAC-001 — no `workspaceType` branches in `apps/api` hand-written code).
3. Confirm tenant/auth/RLS posture (tenant-scoped queries, FORCE RLS plan, no superuser RLS proof).
4. Confirm idempotency / dedupe / `rowVersion` rules for mutations.
5. Require **architecture-reviewer** verdict `proceed` or `proceed_with_accepted_risk`.
6. **Stop** on `pivot`, `blocked`, or unresolved shared-contract decision.

Doc-first: update Markdoc under `docs/` before protected code; state `Updating documentation for this change`.

### CP4 — UI / application integration

1. Preserve **Portal vs Web** ownership (PCMS-001 member session on portal).
2. Preserve **Denali / Urban / starter** divergence — workspace-specific code under `packages/workspaces/<id>`.
3. Verify i18n, responsive behavior, host/session authority, BFF boundaries, workspace manifest behavior.
4. Run appropriate app tests; **screenshot or recording proof** when UI is touched (`/opt/cursor/artifacts/` on Cloud).
5. Invoke **architecture-reviewer** when UI work touches shared notification/inbox models or cross-surface contracts.

### CP5 — Verification

1. Run **only** required tests for changed surfaces.
2. When `test:changed` does not cover a touched package, run explicit package tests and ledger both rows ([SC-VERIFY-03](stop-conditions)).
3. Run relevant guards and builds:

   ```bash
   pnpm run pre-commit:fast && pnpm run guard:import-boundary
   pnpm run test:changed   # when behavior changed
   ```

4. Heavy gates (`test:full`, `ci:integrity`, `phase-N:gate`) require explicit user **YES** ([SC-VERIFY-04](stop-conditions)).
5. Record **every** command, exit code, artifact, result, and verifier in the evidence ledger per [evidence-ledger-schema](evidence-ledger-schema).
6. **Never claim a test passed without a ledger row.**
7. **SKIP is never PASS.** Skipped Axe, Playwright, MinIO, Postgres, or build checks leave the matrix row `UNVERIFIED` or `MISSING` — not `COMPLETE`.
8. Final report claims must **exactly match** ledger rows.

Postgres/RLS specs: `DATABASE_URL` must use `app_tour` role (NOSUPERUSER).

### CP6 — Commit and push

1. Confirm only allowlisted files are staged ([SC-SCOPE-01](stop-conditions)).
2. Confirm branch is still `lockedBranch`.
3. Create **logical commits** — do not force-push.
4. Push only `origin <lockedBranch>`.
5. Update `currentHead` in session lock after each commit.
6. Produce **final evidence report** (branch, heads, classification, files, test matrix, artifacts, risks, commit SHAs, push result).

Invoke **architecture-reviewer** on the full diff before commit when platform candidates or multi-consumer primitives are in scope.

---

## Mandatory architecture re-evaluation

At **CP0**, **after the first vertical slice (CP2)**, **before every shared contract/database boundary (CP3)**, **before UI integration (CP4)**, and **before commit (CP6)**:

1. Ask whether this concept is reusable by another module or workspace.
2. Inspect future consumers (not only the requesting module).
3. Detect domain-specific naming that may indicate accidental coupling (`ticket_*`, `wallet_*` in shared tables/APIs).
4. Compare implementation with existing standards and design freezes (e.g. SK2 notification outbox).
5. Invoke **architecture-reviewer** for platform candidates or multi-consumer concepts.

Keyword classification is **not** an architecture decision.

---

## Notification regression rule

Use [`notification-case-study.mdoc`](../../../docs/dev/feature-delivery/notification-case-study.mdoc) as a **mandatory regression fixture**.

If a new notification / inbox / delivery design is **module-specific** while booking, finance, payment, or wallet are plausible consumers:

1. **Stop** — do not continue implementation.
2. Emit **[SC-ARCH-02](stop-conditions)**.
3. Produce a **pivot memo** (wrong direction, target boundary, docs to update, forward-fix steps).
4. Do **not** silently create another bespoke notification platform.

---

## Stop behavior

When any **hard-stop** fires ([stop-conditions](stop-conditions)):

- Do **not** continue implementation on the blocked path.
- Do **not** auto-revert user changes.
- Do **not** switch branch.
- Do **not** hide failed tests.
- Emit the standard **Feature Delivery STOP** report:

```markdown
## Feature Delivery STOP

- **Stop ID:** SC-…
- **Checkpoint:** CP…
- **Branch:** <lockedBranch> (locked)
- **initialHead:** …
- **currentHead:** …
- **Finding:** …
- **Evidence:** …
- **Pivot options:** …
- **Architect decision needed:** …
```

Resume only after explicit user/architect direction addressing the stop ID; re-verify branch at bootstrap.

**Recoverable failures** (not hard stops) → follow [blocker-recovery](blocker-recovery) — never halt on the first failure.

---

## Blocker recovery (mandatory)

Per [blocker-recovery.mdoc](../../../docs/dev/feature-delivery/blocker-recovery.mdoc):

1. **Never stop immediately** on the first failure — classify, investigate, recover, or exhaust attempts.
2. **Classify** every blocker: code/test, dependency, environment/browser/runtime, missing evidence, architecture ambiguity, security/RLS (hard stop), product decision (hard stop).
3. **Code/test:** inspect call graph + consumers; search repo code/tests/migrations/scripts/docs; hypothesize; smallest scoped fix; rerun failing + regression tests.
4. **Dependency:** official docs first; web research only for current external facts; record URL/version/finding/conclusion in `blocker-investigation.json`; never trust unverified snippets alone.
5. **Browser/runtime:** inspect env, ports, health, logs, console, network; start permitted services only; retry smallest flow; never claim browser proof without execution.
6. **Architecture:** scan consumers + phase/standard docs; compare ports/contracts/events/schemas; fresh **architecture-reviewer** verdict.
7. **Hard stops unchanged:** security, tenant/RLS ambiguity, production access, secrets, migration rewrite, unresolved product decisions — internet research **never** overrides.
8. **Blocked sub-feature** must not stop unrelated executable mandatory work.
9. **After recovery:** resume requirement queue from last unfinished item; write `blocker-investigation.json`.
10. **Stop only when** recovery attempts are evidenced and exhausted, or explicit human architecture/product decision required.
11. **Never** `COMPLETE` while any mandatory row is `MISSING`, `PARTIAL`, `BLOCKED`, `SKIPPED`, or `UNVERIFIED`.

**Artifact:** `.cache/feature-delivery/<sessionId>/blocker-investigation.json` — fields: `blockerId`, `category`, `symptoms`, `localEvidence`, `codeAnalysis`, `searches`, `hypotheses`, `commandsRun`, `outcomes`, `decision`, `resumedCheckpoint`.

---

## Autonomy

After **CP1 plan approval**, the agent may execute CP2–CP6 without repeated micro-prompts, subject to mandatory gates.

**Always stop for:**

- Unresolved architecture (`unknown`, reviewer `blocked` / `pivot` without acceptance)
- Shared contract decisions (Prisma, `*-http-contracts`, workspace-sdk exports)
- Product scope changes beyond approved plan
- Migration rewrites ([SC-DATA-02](stop-conditions))
- Security / RLS ambiguity
- Branch mismatch
- Scope creep
- Missing verification evidence
- Staging / production mutation without explicit unlock

---

## Invoking architecture-reviewer

Use the Task tool with subagent instructions from [`.cursor/agents/architecture-reviewer.md`](../../agents/architecture-reviewer.md). Pass: `featureId`, checkpoint (`CP0` | `CP2` | `CP3` | `CP4`), classifier output, consumer list, changed files or plan, and relevant standards links.

Reviewer is **read-only** — it never edits files, commits, or changes git state.

---

## Evidence ledger (session-local)

Per [evidence-ledger-schema](evidence-ledger-schema):

- Session lock: `.cache/feature-delivery/<sessionId>/SESSION.lock`
- Ledger TSV: `.cache/feature-delivery/<sessionId>/evidence.tsv`
- Arch review JSON: `.cache/feature-delivery/<sessionId>/arch-review.json`
- Blocker investigation: `.cache/feature-delivery/<sessionId>/blocker-investigation.json` (or `blocker-<blockerId>.json`)

Phase C may add CLI appenders; until then the agent maintains these files manually.

**Rule:** No claim in the final report without a ledger row (command + exit code + artifact).

---

## Full closure (mandatory work queue)

**Audit completion ≠ feature completion.**

| Rule                | Behavior                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mandatory rows      | Any matrix row `MISSING`, `PARTIAL`, `BLOCKED`, or `UNVERIFIED` blocks `COMPLETE` verdict                                                           |
| SKIP                | Never counts as PASS or COMPLETE                                                                                                                    |
| UNVERIFIED          | Required check could not run (missing env) — continue other work; row stays open                                                                    |
| Blocked sub-feature | Must **not** stop unrelated executable mandatory items — see [blocker-recovery](blocker-recovery)                                                   |
| First failure       | **Never** immediate stop — classify and run recovery lifecycle unless hard stop                                                                     |
| Stop condition      | Only when recovery exhausted **or** explicit architectural/product decision required                                                                |
| Work queue          | Build matrix → process every non-blocked item sequentially → targeted tests + ledger after each slice → re-open queue after every commit/checkpoint |
| Final report        | Forbidden while any mandatory row is open                                                                                                           |

---

## Notification policy (full closure)

- Ticket-only notifications (`ticket_notifications` as final shared design) are **forbidden** when user mandates cross-domain inbox.
- Shared platform capability required for ticketing, booking/tour, payment/debt, wallet.
- [notification-case-study.mdoc](../../../docs/dev/feature-delivery/notification-case-study.mdoc) is a **historical warning**, not permission to accept ticket-only scope.
- User authorization of shared path → doc-first [member-notification-inbox.mdoc](../../../docs/standards/member-notification-inbox.mdoc) + `IMPL-SK2.D+` unlock record.

---

## Final report template

1. Branch, `initialHead`, `currentHead`, working tree
2. Classification and architecture-reviewer verdict(s)
3. Files changed (within `scopePaths`)
4. Test/guard matrix with pass/fail/skip
5. Artifacts (screenshots, logs)
6. Remaining / accepted risks
7. Commit SHAs and push result
8. `Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL].`

---

_FDA-001 Phase B — Skill wiring. Blocker recovery mandatory. Hooks and guard scripts are Phase C._
