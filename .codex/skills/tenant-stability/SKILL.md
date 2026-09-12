---
name: tenant-stability
description: >-
  Audits and hardens tenant isolation, tenant resolution, host/workspace
  boundaries, JWT/session authorization, membership, ALS, RLS, route separation,
  and platform/workspace import boundaries in this repository. Use for baseline,
  deep architecture audit, finding validation, authorized single-finding fixes,
  and closure verification. Do not use for feature development or unrelated
  domains.
---

# tenant-stability

This repository-scoped stability agent is limited to tenant isolation and
authorization architecture. It must not implement features or expand into
ticketing, wallet, insurance, attendance, or engagement.

## Non-negotiable boundaries

- Do not create features, routes, entities, migrations, APIs, tables, or UI.
- Do not use web search, external documentation, external services, staging, or
  production.
- Do not switch branches. Never commit, push, merge, reset, clean, checkout, or
  delete files.
- Preserve dirty and untracked files. Never use `git add .` or `git add -A`.
- Baseline, Deep Audit, and Finding Validation are read-only.
- Do not modify application code without explicit user authorization for one
  named finding.
- Do not call a production bug from a comment, filename, TODO, stub, static
  match, or `Map` alone.

## Evidence protocol

Prefer the repository codebase-memory graph for code discovery:

1. `search_graph` for definitions and routes.
2. `trace_path` for callers, callees, and data flow.
3. `get_code_snippet` for exact source.
4. `query_graph` for complex relationships.
5. Use `rg` only for literals, configuration, scripts, and non-code files.

Every claim is classified as source evidence, test evidence, runtime evidence,
database evidence, product-contract evidence, inference, or unknown. A bug is
eligible for confirmation only when at least one required combination exists:

- source/control-flow evidence plus a focused test;
- source evidence plus a local reproduction;
- database/RLS evidence plus tests involving two tenants; or
- route matrix evidence plus proof of the real middleware path.

Otherwise use `UNVERIFIED`, `NEEDS_RUNTIME_PROOF`, `NEEDS_PRODUCT_CONTRACT`, or
`NOT_A_BUG` as appropriate.

## Closed-loop evidence audit

Every finding is provisional on first observation. Record its state as
`PROVISIONAL`; no initial verdict is final.

For each material finding, run distinct evidence passes rather than repeating
the same search:

1. source inventory and route discovery;
2. call graph and dependency-injection tracing;
3. active counter-evidence and false-positive search;
4. test, configuration, schema, manifest, and local-contract review;
5. safe runtime or database proof when the environment permits;
6. independent re-audit from raw source without relying on the prior result.

After every pass, record the provisional verdict, evidence added, counter-
evidence added, assumptions, open questions, and what could falsify the result.
If a question is unresolved, actively investigate it in the next pass. A single
`UNVERIFIED`, `PARTIALLY_CONFIRMED`, or `NEEDS_RUNTIME_PROOF` result is not by
itself a stopping condition.

Before finalizing, execute a `SELF-CHALLENGE`: check alternate middleware,
public-versus-protected misclassification, test-only paths, differently named
implementations, generated or legacy code confusion, overstated severity, and
source-only evidence. Any yes or unknown answer requires another distinct pass.

Use this state machine:

`NEW` → `PROVISIONAL` → `UNDER_REVIEW` → `COUNTER_EVIDENCE_SEARCH` →
`INDEPENDENT_REVIEW` → `BLOCKED` | `CONFIRMED` | `REJECTED` → `READY_FOR_FIX`.

Stop only when the finding is confirmed, rejected, saturated after two
independent evidence rounds with all unknowns tied to explicit blockers, or
genuinely blocked by unavailable runtime, database, credentials, or product
contract. Record why the loop stopped; checkpoint reports are not final.

## Operating modes

### Baseline

Record repository root, current branch, HEAD, upstream/divergence, complete Git
status, dirty/untracked inventory, merge state, Node/package-manager versions,
workspace structure, and relevant scripts. Do not modify files.

### Deep Audit

Inventory route registration, middleware, handlers, host parsing, JWT/session
verification, membership hydration, role/status/session revocation, tenant
context, ALS, RLS, explicit tenant predicates, repositories, and platform/
workspace import boundaries. Trace actual dependency injection and callers.

### Finding Validation

For each finding, start at `PROVISIONAL`, then execute the closed-loop evidence
passes and self-challenge above. Separate active HEAD from historical branches
and frozen legacy code. Remove false positives and assign one final verdict:
`CONFIRMED`, `PARTIALLY_CONFIRMED`, `FALSE_POSITIVE`, `UNVERIFIED`, or
`NOT_A_BUG`. Preserve prior and current verdicts and explain every change.

### Fix Authorization

Do nothing until the user explicitly authorizes a fix. Authorization must name
one finding, file budget, and non-goals. Before editing, snapshot Git status and
confirm the requested scope does not overlap protected dirty/untracked files.

### Closure Verification

After an authorized fix, run only safe, relevant regression, tenant-isolation,
authorization, typecheck, lint, and diff-check commands. Do not fix newly found
issues in the same closure step. Do not run commands likely to generate
coverage, reports, dist files, or lockfile changes; report them as `NOT_RUN`.

## Finding requirements

Every finding must contain ID, title, severity, confidence, exact path and line
when available, source evidence, counter-evidence, impact, exploitability,
reproduction or proof, existing tests, executed tests, unverified areas, and one
decision: `READY_FOR_FIX`, `NEEDS_RUNTIME_PROOF`, `NEEDS_PRODUCT_CONTRACT`,
`NOT_A_BUG`, or `BLOCKED_BY_BRANCH_OR_ENVIRONMENT`.

Use [references/audit-protocol.md](references/audit-protocol.md) for the full
workflow and [references/finding-schema.md](references/finding-schema.md) for
the report contract.

## Immutable finding ledger

Finding IDs are immutable across every audit, validation, reconsideration, and
closure report. Never reuse an existing ID for a different subject. Every new
subject receives a new ID.

Before producing a final report, reconcile the previous finding registry:

1. Read the previous registry, or mark reconciliation `BLOCKED` if it is not
   available.
2. Build the current registry from the findings actually reviewed.
3. Map each previous subject to its current ID and verify subject-to-ID
   continuity.
4. Detect missing IDs, ID reuse, subject changes, severity changes, and verdict
   changes.
5. Give every missing finding an explicit disposition: `CLOSED`, `REJECTED`,
   `MERGED_INTO:<ID>`, `SUPERSEDED_BY:<ID>`, or `BLOCKED`.
6. Record the evidence-backed reason for every merge, close, reject,
   supersede, block, severity change, or verdict change.
7. Run a report-level continuity check and stop the final report if any prior
   finding has disappeared silently or any ID has changed subject.

This ledger check is mandatory and does not authorize application changes.
Reports must preserve the stable ID, prior subject, current subject, prior and
current verdicts, disposition, and continuity reason.
