# Phase 6 — Anti-hollow contract

```yaml
contract_version: "2026-06-04"
fail_token: FAIL
```

## Scoring

| Score                        | Meaning                                                 |
| ---------------------------- | ------------------------------------------------------- |
| **96 doc execution**         | PEK pack + guard                                        |
| **96 critical spec**         | Primary spec all subphases · RULE-P6 · maps             |
| **0 behavioral (current)**   | probe-only                                              |
| **100 behavioral (closure)** | 6.1–6.8 VERIFIED_BEHAVIORAL + HTTP/e2e + `phase-6:gate` |

```yaml
scaffold_contract_warning:
  file: packages/workspaces/denali/test/phase-6.contract.spec.ts
  proves: "Plugin export surface exists"
  does_not_prove: ["6.6 smoke parity", "6.7 MinIO", "6.4 full outbox without 5.4"]
  see: appendices/test-inventory.md
```

## Linear workflow

```yaml
AGENT_WORKFLOW_LINEAR:
  1: READ IMPLEMENTATION-TRUTH.md + blockers.md
  2: Pick FIRST subphase per BOOT-MANIFEST detect_current_subphase
  3: LOAD subphases/{id}.md + req-p6-command-atlas prove_with only
  4: Implement prove_with (code phase — not doc-only task)
  5: RUN verification-commands.md
  6: UPDATE IMPLEMENTATION-TRUTH

forbidden:
  - "Mark 6.9 PASS from phase-6:guard doc-only"
  - "Import legacy/ in trunk apps"
  - "Empty test claiming REQ-P6-* PASS"
  - "Load research monolith for daily coding"
  - "Copy legacy/apps/web wizard/denali registry as SoT"
```

## Spec-driven development

| Artifact   | Phase 6 SoT                                 |
| ---------- | ------------------------------------------- |
| Tasks      | `subphases/{id}.md` + `completion_proof`    |
| Decisions  | `IMPLEMENTATION-DECISIONS.md` DEC-P6-\*     |
| Validation | `verification-matrix.md` + guards           |
| Drift      | `IMPLEMENTATION-TRUTH` + CONSISTENCY-REPORT |
