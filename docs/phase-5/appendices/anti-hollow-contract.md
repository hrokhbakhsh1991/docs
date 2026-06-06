# Phase 5 — Anti-hollow contract

```yaml
contract_version: "2026-06-04"
fail_token: FAIL
```

## Scoring

| Score                        | Meaning                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **100 doc**                  | PRECISION pack + router — pre-code navigation complete                          |
| **43 scaffold**              | 5.1 files + guard + existence contract                                          |
| **29 behavioral (current)**  | 5.2 VERIFIED — 5.3–5.5 pending                                                  |
| **100 behavioral (closure)** | 7/7 VERIFIED with **behavioral** tests + `phase-5:gate` + nested `phase-4:gate` |

```yaml
scaffold_contract_warning:
  file: apps/api/test/phase-5.contract.spec.ts
  proves: "DEL-P5-001 artifacts exist"
  does_not_prove: ["5.3 projection", "5.4 outbox relay", "5.5 audit"]
  note_5_2: "5.2 has dedicated behavioral specs — see IMPLEMENTATION-MAP.md §5.2"
  see: appendices/test-inventory.md
```

## Linear workflow

```yaml
AGENT_WORKFLOW_LINEAR:
  1: READ IMPLEMENTATION-TRUTH.md + blockers.md
  2: Pick FIRST subphase not VERIFIED (respect BLOCKER)
  3: LOAD subphase + completion_proof only
  4: Implement prove_with — no layer4 bulk read
  5: RUN verification-commands
  6: UPDATE IMPLEMENTATION-TRUTH

forbidden:
  - "Create migration DDL without phase-5-canonical-schema.md (BLOCKER-P5-001)"
  - "Empty integration test claiming REQ-P5-* PASS"
  - "Mark 5.6 PASS while only phase-5:guard scaffold passes"
  - "Mark 5.4 PASS from phase-5.contract.spec.ts file-existence tests"
  - "Load research monolith for daily coding"
```

## Spec-driven development (2026 alignment)

Per industry SDD practice: **spec → plan → atomic tasks → implement → CI validate**.

| Artifact     | Phase 5 SoT                                           |
| ------------ | ----------------------------------------------------- |
| Spec (tasks) | `subphases/{id}.md` + `completion_proof`              |
| Plan         | `phase-5-canonical-schema.md` (required before DDL)   |
| Validation   | `verification-matrix.md` + guards when `p5_*` exist   |
| Drift        | `IMPLEMENTATION-TRUTH` + `REPO_SCRIPTS_OVER_STALE_MD` |
