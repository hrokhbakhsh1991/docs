# Phase 4 — Subphase completion proof schema

```yaml
schema_version: "2026-06-04"
purpose: "Uniform proof shape for AI agents — every subphase MUST declare completion_proof"
fail_token: FAIL
```

## Modes

| mode | When | `completion_proof.type` | Proof source |
|------|------|-------------------------|--------------|
| **track** | 4.0 only | `track` | `tracks.R0..R3` + `exit_criteria_4_0` |
| **p4_e** | 4.1, 4.2, 4.3, 4.5, 4.6 | `p4_e` | `p4_e_ids` + `ci_commands` + tests in verification-matrix |
| **test_matrix** | 4.4 only | `test_matrix` | `test_matrix_ids` → `appendices/test-matrix.md` → DOD-7 |

## Required fields (all subphases)

```yaml
completion_proof_required:
  subphase: string          # "4.N"
  type: track | p4_e | test_matrix
  prove_with:               # at least one
    - command               # pnpm / docker / test path
    - exit_criteria_id      # E40-* or exit_criteria_4_N
    - test_matrix_id        # TH-1 etc.
  on_subphase_pass: "SET state; advance DAG per phase-4-ai-exec.md"
  on_fail: FAIL
```

## 4.0 track proofs

```yaml
track_proof_template:
  R0: { enforcement: P4-E-AUTH-01, prove: "tenant-kernel.spec dev bearer prod 401" }
  R1: { enforcement: null, prove: "apps/web layout force-dynamic + per-request session" }
  R2: { enforcement: P4-E-SCALE-01, prove: "in-memory-tour.repository.spec Big-O" }
  R3: { enforcement: null, prove: "POST /tours from web server action" }
  report: { path: reports/phase-3.2-red-flag-status-*.md, enforcement: P4-E-RF-40 }
```

## Agent rule

- **FORBIDDEN:** mark subphase PASS without running `prove_with` commands or tests listed in linked subphase file.
- **4.6:** requires **all** of 4.0–4.5 `completion_proof` PASS before `pnpm run phase-4:gate`.
