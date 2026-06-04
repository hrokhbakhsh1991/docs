# Phase 4 — Anti-hollow contract (docs + code honesty)

```yaml
contract_version: "2026-06-04"
purpose: "Prevent spec-only PRs, empty tests, and false PASS — path to execution score 100"
fail_token: FAIL
binding: REPO_SCRIPTS_OVER_STALE_MD
```

## Problem this solves

| Anti-pattern | Symptom | Contract response |
|--------------|---------|-------------------|
| Doc-only PR | Files added, no behavior | `implementation_status != VERIFIED` → **FAIL** closure |
| Hollow test | `it()` empty body or skip-only passes in CI | `p4_anti_hollow_tests` guard **FAIL** |
| Threshold gaming | Tests exist only to hit count 6/2 | Tests must assert P4-E claim in name or comment |
| Analysis spiral | Agent reads monolith + overview before coding | **Linear workflow** below — **FAIL** if skipped |

---

## Scoring model (honest)

| Score | Meaning |
|-------|---------|
| **96** | Modular docs: agent can navigate (readability pass) |
| **100** | Docs **+** [`audits/IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md) all subphases `VERIFIED` **+** no hollow mechanisms **+** `phase-4:gate` green |

**Rule:** Do not claim documentation score **100** while `IMPLEMENTATION-TRUTH` lists `HOLLOW` or `SPEC_ONLY` for active P4-E-*.

---

## Linear agent workflow (no wasted analysis)

```yaml
AGENT_WORKFLOW_LINEAR:
  step_1_truth:
    action: READ audits/IMPLEMENTATION-TRUTH.md
    rule: "Do not read phase-4-tenant-kernel.md body"
  step_2_pick_subphase:
    action: FIRST row where status in [SPEC_ONLY, PARTIAL, HOLLOW]
    source: IMPLEMENTATION-TRUTH.md
  step_3_load_spec:
    action: LOAD subphases/{id}.md + completion_proof.prove_with ONLY
  step_4_implement:
    action: "Code + tests for prove_with only — no scope outside subphase"
  step_5_verify:
    action: RUN appendices/verification-commands.md commands
    rule: "FORBIDDEN mark VERIFIED without command exit 0"
  step_6_update_truth:
    action: UPDATE IMPLEMENTATION-TRUTH.md row when VERIFIED
  step_7_next:
    action: REPEAT until 4.6 → phase-4:gate

forbidden_before_step_4:
  - "Repo-wide semantic search unrelated to current prove_with"
  - "Rewriting docs for narrative polish mid-subphase"
  - "Creating new packages not listed in subphase file"
```

---

## Hollow test definition (machine)

```yaml
hollow_test_patterns:
  - pattern: "test body with zero assertions (only comments)"
  - pattern: "it(..., { skip: !ENV }, async () => {}) with empty body when ENV can be set in CI"
  - pattern: "comment 'ships when' / 'TODO closure' as sole proof"
  - pattern: "assert.true(true) or equivalent noop"

enforcement:
  guard: scripts/guards/lib/anti-hollow-phase4.mjs
  guard_id: p4_anti_hollow_tests
  on_fail: "Fix test or downgrade IMPLEMENTATION-TRUTH — never fake P4-E PASS"
```

---

## PR reviewer checklist

- [ ] `IMPLEMENTATION-TRUTH.md` updated for touched subphase(s)
- [ ] Every new test maps to `P4-E-*` or `TH-1` in name/comment
- [ ] No new file in `verification-matrix` without non-hollow test body
- [ ] `completion_proof.prove_with` commands run in PR description or CI log

**Cross-ref:** [`subphase-completion-schema.md`](subphase-completion-schema.md) · [`verification-commands.md`](verification-commands.md)
