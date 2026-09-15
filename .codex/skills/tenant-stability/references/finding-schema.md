# Finding Schema

Use this record for every finding:

```yaml
id: DISC-000
title: "Short evidence-based title"
state: NEW | PROVISIONAL | UNDER_REVIEW | COUNTER_EVIDENCE_SEARCH | INDEPENDENT_REVIEW | BLOCKED | CONFIRMED | REJECTED | READY_FOR_FIX
severity: P0 | P1 | P2 | P3
confidence: HIGH | MEDIUM | LOW
verdict: CONFIRMED | PARTIALLY_CONFIRMED | FALSE_POSITIVE | UNVERIFIED | NOT_A_BUG
decision: READY_FOR_FIX | NEEDS_RUNTIME_PROOF | NEEDS_PRODUCT_CONTRACT | NOT_A_BUG | BLOCKED_BY_BRANCH_OR_ENVIRONMENT
paths:
  - file: /absolute/or/repository-relative/path
    lines: "1-2"
source_evidence:
  - "Exact symbol, control flow, or configuration evidence"
counter_evidence:
  - "Evidence limiting or contradicting the claim"
impact: "Observed or explicitly bounded impact"
exploitability: "Proven, disproven, or unverified; include conditions"
reproduction_or_proof: "Safe command, focused test, or source proof; otherwise NOT_RUN"
existing_tests:
  - "Path and what it actually covers"
executed_tests:
  - "Command and result, or NOT_RUN with reason"
unverified:
  - "Runtime, DB, staging, or product-contract unknown"
Round: 0
Previous Verdict: "NONE"
Current Verdict: "PROVISIONAL"
What Changed: "Initial hypothesis or change since the previous round"
Evidence Added This Round:
  - "Evidence added in this round and its type"
Counter-Evidence Added This Round:
  - "Counter-evidence added in this round and its type"
Assumptions:
  - "Explicit assumption, if any"
Questions That Could Falsify This Finding:
  - "Question whose answer would disprove or materially weaken the finding"
Questions Still Open:
  - "Unresolved question and its blocker"
Independent Review Result: "Not yet performed"
Evidence Diversity: "Distinct evidence types used; repeated static searches do not count"
Saturation Status: "NOT_SATURATED | SATURATED_AFTER_TWO_INDEPENDENT_ROUNDS | BLOCKED"
Why The Loop Stopped: "Confirmation, rejection, saturation, or explicit blocker"
ledger:
  previous_id: DISC-000 | null
  disposition: NEW | ACTIVE | CLOSED | REJECTED | MERGED_INTO:<ID> | SUPERSEDED_BY:<ID> | BLOCKED
  subject_continuity: UNCHANGED | RENAMED_WITH_SAME_ID | MERGED | SUPERSEDED | NEW
  continuity_reason: "Why the ID and subject mapping is valid"
  previous_severity: P0 | P1 | P2 | P3 | null
  previous_verdict: CONFIRMED | PARTIALLY_CONFIRMED | FALSE_POSITIVE | UNVERIFIED | NOT_A_BUG | null
  severity_change_reason: "Evidence-backed reason for any severity change"
  verdict_change_reason: "Evidence-backed reason for any verdict change"
```

Rules:

- Keep source facts separate from inference.
- Cite exact paths and line numbers where possible.
- Do not upgrade severity because a file is named `repository`, `security`, or
  `durable`.
- Do not treat historical branches or `legacy/` as active implementation.
- `READY_FOR_FIX` requires a confirmed finding and explicit user authorization;
  otherwise use the appropriate blocked or evidence-needed decision.
- The first record for every finding must use `state: PROVISIONAL` and
  `Current Verdict: PROVISIONAL`; later verdicts must preserve the previous
  verdict and explain what changed.
- `READY_FOR_FIX` requires completed counter-evidence and independent review,
  proven impact or exploitability/correctness failure, an exact affected path,
  an acceptance test, bounded scope, and no unresolved contradiction.
- `Why The Loop Stopped` is mandatory for any final report. `UNVERIFIED` alone
  is not a valid reason to stop.
- `id` is immutable. Never reuse an old ID for a different subject.
- Every report must reconcile its `previous_id` registry before final output.
- A missing prior finding requires an explicit ledger disposition; silent
  disappearance is invalid.
- New findings receive new IDs, and merges/supersessions must name the target
  ID and preserve the source finding's history.
- `disposition: NEW` is only valid for an ID absent from the previous registry;
  existing IDs must be `ACTIVE` or have an explicit terminal disposition.
- Before final output, emit a previous-to-current mapping and fail the ledger
  gate on ID reuse, subject transfer, silent disappearance, or missing
  disposition.
