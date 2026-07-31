# Root Command Remediation Plan

**Status:** Analysis complete — implementation requires staged approval  
**Captured:** 2026-07-29  
**Last compacted:** 2026-07-31 (PSR-2c — satellite docs archived)  
**Scope:** Root `package.json` command surface  
**Baseline:** [`ROOT_COMMAND_BASELINE.md`](./ROOT_COMMAND_BASELINE.md)  
**Classification:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)  
**Archived worksheets:** [`docs/archive/psr-001/root-command/`](../archive/psr-001/root-command/)

## Outcome

The root command problem is now bounded and decision-ready:

- 311 `scripts` keys exist;
- six `//...` keys are deprecation metadata;
- all 305 executable commands have exactly one classification row and owner;
- no executable command is missing or assigned in two cohorts;
- all 117 root guard commands are represented;
- no command has been approved for deletion;
- the full documentation gate is green.

The dominant problem is not dead code. It is a large public control surface
formed by accumulated phase gates, diagnostic leaves, compatibility names, CI
contracts, and manual operations. Safe improvement therefore starts with
consumer migration and runner consolidation, not bulk deletion.

## Root causes

1. **Historical command accumulation:** phase and product gates remain public
   after their delivery window because no archival lifecycle exists.
2. **Compatibility without expiry:** aliases preserve old terminology but
   rarely carry an enforced removal date.
3. **Direct CI coupling:** workflows and required checks depend on root command
   names, making apparently trivial renames risky.
4. **Diagnostic leaves are mixed with public entry points:** targeted guards are
   valuable for path-gated CI and failure isolation, but root discovery exposes
   all of them equally.
5. **Repeated orchestration:** many gates encode long `pnpm run ...` chains or
   separate shell runners instead of sharing a declarative execution model.
6. **Operations share the same namespace:** deploy, database, staging, and
   pull-request creation commands look like verification commands despite
   different authority and side effects.

## Safety invariants

Every implementation phase must preserve:

- command behavior and exit semantics;
- required-check names and branch-protection expectations;
- lifecycle and dynamically constructed consumers;
- path-gated diagnostic execution;
- environment and secret requirements;
- the separation between verification and externally mutating operations;
- the architecture/import boundaries in `AGENTS.md`.

No command can be removed solely because static textual references are zero.

## Delivery path

### R0 — Inventory and ownership

**State:** Complete, approval pending.

Evidence:

- 305 of 305 executable commands classified;
- zero missing and zero duplicate assignments;
- lifecycle, dynamic, CI, operations, and compatibility risks recorded;
- Doc-Gate passes.

Exit still required:

- platform owner/architect accepts the inventory as the migration baseline.

### R1 — Compatibility-alias pilot

**Target:** `phase-3:doc-scaffold` → `doc-gate`  
**Risk:** Low  
**Purpose:** Prove the complete deprecation workflow on one behavior-identical
wrapper before touching CI or phase chains.

Current evidence:

- the alias body is exactly `pnpm run doc-gate`;
- the only active consumer outside the definition is one example in
  `AGENTS.md`;
- no workflow, hook, application, package, or script invokes the alias;
- CI already invokes `pnpm run doc-gate` directly;
- `doc-gate` passes.

Implementation sequence:

1. replace the `AGENTS.md` example with the canonical name;
2. keep the alias for one declared compatibility window;
3. add a zero-consumer assertion or inventory check;
4. run `doc-gate`, architecture guards, and import-boundary guards;
5. obtain explicit removal approval;
6. remove the alias and its adjacent metadata only after the window;
7. retain a rollback patch or restore the one-line wrapper if an unknown
   consumer appears.

R1 must not alter the implementation of `doc-gate`.

### R2 — Alias-chain cleanup

**Risk:** Low to medium.

Process the remaining exact wrappers one at a time:

- `guard:documentation-sync`;
- `test:contract`;
- `test:contract:foundation`;
- `contract:test`;
- `phase-0:covenant-gate`;
- `phase-0:trunk-gate`.

CI-bound `phase-0:foundation-gate` is excluded until workflow and
branch-protection consumers are migrated deliberately.

Exit:

- every removed alias has zero active consumers, an elapsed compatibility
  window, owner approval, and a tested canonical replacement.

### R3 — Family runner consolidation

**Risk:** Medium.

Consolidate implementation behind stable public names:

- marketing guard family;
- workspace guard family;
- field-exposure family;
- guest guard family;
- control packs and mode-matrix smoke commands.

The first change should reduce duplicated runner code while retaining public
command names and targeted leaves. Parameterization is acceptable only when
mode, environment, ordering, exit code, and diagnostic parity are tested.

Exit:

- shared runners have parity tests;
- path-gated consumers still select the correct leaf;
- command count may remain unchanged in this phase.

### R4 — CI orchestration consolidation

**Risk:** High.

Move repeated setup and command selection into reusable workflow/composite
infrastructure. Do not rename required checks in the first cut.

Sequence:

1. choose a non-required or already documented pilot workflow;
2. prove cache, Node, pnpm, environment, artifact, and failure parity;
3. preserve job/check display names;
4. migrate one workflow at a time;
5. inspect branch protection after each migration;
6. retain rollback to the previous workflow revision.

Exit:

- fewer duplicated workflow bodies;
- identical protected-check coverage and failure semantics.

### R5 — Declarative phase-gate runner

**Risk:** High.

Model numbered gates as data: ordered steps, prerequisites, environment
contracts, optional integration requirements, and report artifacts. Initially,
existing `phase-*` and `pN:*` names become compatibility front doors to the
shared runner.

Do not merge:

- fast and full variants;
- adversarial and ordinary guards;
- local and live/staging smoke;
- verification and `create-pr` operations.

Exit:

- graph/parity tests cover every migrated gate;
- public names remain stable for one release window;
- nested duplicate work is measured before any flattening.

### R6 — Operations namespace and archival

**Risk:** High.

Separate discoverability for staging, database, deploy, seed, sync, and
pull-request creation commands without silently changing authority. Then review
historical phase names with their owners.

Archival requires:

- no active CI, runbook, dynamic, or manual consumer;
- historical evidence retained in documentation;
- explicit owner and architecture approval;
- a rollback/recovery path.

## Progress model

| Stage                | Definition                                  | Current     |
| -------------------- | ------------------------------------------- | ----------- |
| Diagnose             | Baseline, root causes, risks                | Complete    |
| Classify             | 305 commands, owner, class                  | Complete    |
| Select pilot         | Evidence-backed first migration             | Complete    |
| Approve baseline     | Owner/architect decision                    | Pending     |
| Execute pilot        | Consumer migration and compatibility window | Not started |
| Consolidate families | Shared runners with parity                  | Not started |
| Consolidate CI       | Reusable orchestration, check parity        | Not started |
| Consolidate gates    | Declarative graph with stable front doors   | Not started |
| Archive safely       | Approved removals only                      | Not started |

The analysis/design path is complete. Implementation should start at R1 only
after approval; skipping directly to bulk script removal would violate the
evidence gathered in R0.

## Verification record

At plan closure:

- executable inventory: 305;
- classified: 305;
- missing: zero;
- duplicate assignments: zero;
- `git diff --check`: pass for the final cohort;
- `pnpm run doc-gate`: pass, including 172 Markdoc files and
  `audit-boundary`.
