# Tenant Stability Audit Protocol

## 1. Baseline

Capture, without mutation:

- repository root, current branch, HEAD, recent log, upstream and divergence;
- `git status --short`, merge/rebase state, modified and untracked paths;
- Node, package manager, workspace packages, and primary scripts;
- active HEAD versus historical refs when provenance is disputed.

Never infer active implementation from `git log`, `legacy/`, generated evidence,
or another branch. Use `git show` read-only to establish provenance.

## 1A. Closed-loop finding lifecycle

Every finding starts as `PROVISIONAL` and moves through:

```text
NEW → PROVISIONAL → UNDER_REVIEW → COUNTER_EVIDENCE_SEARCH
→ INDEPENDENT_REVIEW → BLOCKED | CONFIRMED | REJECTED → READY_FOR_FIX
```

For each material finding, complete these distinct passes:

- Pass A: source inventory and route discovery;
- Pass B: call graph and dependency injection;
- Pass C: active counter-evidence and false-positive search;
- Pass D: tests, config, schema, manifests, and local contracts;
- Pass E: safe runtime/database proof when available;
- Pass F: independent raw-source re-audit without using the previous conclusion.

Each pass must add a different evidence type. Repeating `rg`, static matches,
comments, TODOs, filenames, or mock-only assertions is not a new pass.
After every pass record the current provisional verdict, what changed, new
assumptions, open questions, and the evidence that could falsify it. If a pass
is blocked, perform a local substitute and label it as non-runtime evidence.

Before closure run `SELF-CHALLENGE` for alternate middleware,
public/protected classification, test-only ingress, differently named
implementations, generated/legacy confusion, severity inflation, and source-
only evidence. Any yes or unknown answer opens another pass. Do not stop merely
because the result is `UNVERIFIED`, `PARTIALLY_CONFIRMED`, or
`NEEDS_RUNTIME_PROOF`.

The loop may stop only after confirmation, rejection, saturation across two
independent evidence rounds with all unknowns tied to explicit blockers, or a
real blocker such as unavailable runtime, database, credentials, or product
contract. Record `Why The Loop Stopped` in the finding.

## 2. Route inventory

Start at the active API dispatcher and route registrars. For every route or
route family record method, path, registration file, handler/service,
classification, auth middleware, tenant resolution, membership validation, role
validation, session-version/revocation validation, ALS/RLS binding, explicit
tenant predicates, and whether any client-supplied header is trusted.

Treat these as separate paths:

- public tenant routes;
- authenticated member routes;
- protected operator routes;
- internal/BFF routes;
- test-only header ingress.

Do not label a direct context resolver a vulnerability until route exposure,
middleware path, repository predicate, and exploitability are established.

## 3. Auth and tenant call graph

Trace operator, member, and public paths separately:

```text
ingress → host parsing → JWT/session verification → request context
→ tenant resolution → membership hydration → role/status/sessionVersion
→ ALS → RLS/tenant predicates → service/repository query
```

Distinguish context construction from authorization. Verify whether membership
is read from the database, whether status and session revocation are checked,
and whether test-only header paths bypass production controls.

## 4. Persistence and event validation

For any claimed durability issue, trace construction, dependency injection,
producer, consumer, query, mutation, retry, idempotency, replay, restart, and
multi-process behavior. A process-local store is a design fact, not by itself a
production bug. Product contract or runtime evidence is required to establish
impact.

## 5. Tests and execution safety

Inventory tests before executing anything. Prefer source inspection when a
command may write coverage, reports, generated files, dist, or lockfiles. Mark
such checks `NOT_RUN`. A test file's existence is not execution evidence.

Test execution is one evidence pass, not a substitute for source, wiring, or
counter-evidence review. Never call a mock-only test runtime proof.

## 6. Severity gate

- `P0`/`P1`: only with concrete security, availability, or data-integrity
  impact and the evidence threshold in the main Skill.
- `P2`: confirmed limitation, inconsistent control path, or incomplete contract
  whose production impact is not yet proven.
- `P3`: low-impact quality or documentation issue.
- `UNVERIFIED`: source does not establish behavior or product expectation.

Always include counter-evidence and say what evidence would change the verdict.

## 7. Fix gate

No fix is authorized by discovery, severity, or a clear-looking bug. Require an
explicit user instruction naming the finding and scope. Closure verifies the
authorized change only; newly discovered findings remain separate.

`READY_FOR_FIX` additionally requires a final `CONFIRMED` verdict, exact
affected path, proven impact/exploitability or correctness failure, reviewed
counter-evidence, known acceptance test, bounded scope, and no unresolved
contradiction.

## 8. Finding ledger continuity

Finding IDs are immutable across baseline, audit, validation, reconsideration,
and closure reports. A subject must never move to another ID. Every report
must load the previous finding registry and reconcile every previous ID before
emitting a final report.

Maintain a cumulative ledger. A finding that is absent from the current report
must have an explicit disposition: `CLOSED`, `REJECTED`, `MERGED_INTO:<ID>`,
`SUPERSEDED_BY:<ID>`, or `BLOCKED`. New subjects receive new IDs. Severity or
verdict changes remain attached to the same ID and must include the reason and
evidence added in that round.

Before final output, perform a report-level consistency check:

- every previous ID appears in the current registry or has an explicit
  disposition;
- subject, ID, severity, and verdict continuity are checked independently;
- merges and supersessions name the destination ID and explain the mapping;
- no ID is reused for a different subject;
- no finding disappears silently.

If the previous registry is unavailable, mark reconciliation
`BLOCKED` and do not claim continuity. This ledger check is separate from the
closed-loop evidence audit and does not authorize any application change.

### 8A. Reconciliation algorithm

Execute this algorithm before final output, even when the current audit found
no confirmed bugs:

```text
previous = read_previous_finding_registry()
if previous is unavailable:
    emit ledger disposition BLOCKED
    do not claim continuity

current = build_current_finding_registry()
for each previous finding p:
    candidates = current findings with the same immutable ID
    if candidates has more than one:
        record ID_REUSE_OR_DUPLICATION violation
    if candidates is empty:
        require one explicit disposition for p:
            CLOSED | REJECTED | MERGED_INTO:<ID>
            | SUPERSEDED_BY:<ID> | BLOCKED
    else:
        compare p.subject with candidates[0].subject
        if subject changed:
            record ID_REUSE violation
        preserve p.id and record severity/verdict changes with reasons

for each current finding c:
    if c.id is absent from previous:
        require c.disposition = NEW and a new immutable ID

run report_level_continuity_check()
fail the ledger gate on silent disappearance, ID reuse, or missing disposition
```

The reconciliation output must include a previous-to-current mapping table.
An ID may not be transferred merely because another finding was closed,
merged, or superseded. A merge or supersession must identify the destination ID
and retain the source finding's history.
