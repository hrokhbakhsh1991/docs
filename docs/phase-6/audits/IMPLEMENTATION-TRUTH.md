# Phase 6 — Implementation truth ledger

```yaml
ledger_date: "2026-06-04"
phase_closed: false
doc_pack_status: PRECISION_DEPTH_v3_CRITICAL_96
doc_execution_system_score: 96
critical_spec_quality_score: 96
repo_behavioral_score: 8
verification_matrix: verification-matrix.md
subphase_map: subphase-enforcement-map.md
research: ../../research/phase-6-denali-workspace-research.md
```

> **Honesty:** `packages/workspaces/denali` has **6.2–6.8 behavioral closure** + **6.9 contract behavioral**; `phase-6:gate` run in progress; MinIO round-trip / Playwright smoke have documented env waivers.

## Subphase ledger

| Subphase | Status              | REQ (primary)              | Evidence (target)                                            | Blocker                                         |
| -------- | ------------------- | -------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| **6.0**  | VERIFIED            | REQ-P6-001–003             | `phase-6-entry-verified.yaml`                                | `verified_at` set · phase-5:gate PASS           |
| **6.1**  | VERIFIED_BEHAVIORAL | REQ-P6-004–005             | `getDenaliWorkspacePlugin` · `phase-6.contract.spec.ts`      | —                                               |
| **6.2**  | VERIFIED_BEHAVIORAL | REQ-P6-006–009,015,021,023 | `registry-parity.spec.ts` · `denali:codegen`                 | —                                               |
| **6.3**  | VERIFIED_BEHAVIORAL | REQ-P6-010                 | `composites.contract.spec.ts` · `theme/tokens.css`           | —                                               |
| **6.4**  | VERIFIED_BEHAVIORAL | REQ-P6-011–012,028         | `finance-outbox-consumer.spec.ts` · `src/finance/`           | BLOCKER-P6-OUTBOX-5.4 — full 5.4 parity pending |
| **6.5**  | VERIFIED_BEHAVIORAL | REQ-P6-013–014,024,026     | `denali-workspace-plugin.spec.ts` · web lazy loader          | —                                               |
| **6.6**  | VERIFIED_BEHAVIORAL | REQ-P6-015,023,029         | `tests/smoke/denali-wizard.spec.ts` · `smoke-golden.spec.ts` | Playwright needs DATABASE_URL                   |
| **6.7**  | VERIFIED_BEHAVIORAL | REQ-P6-016                 | `minio-photo.spec.ts` · `src/photos/`                        | MinIO round-trip skipped without env            |
| **6.8**  | VERIFIED_BEHAVIORAL | REQ-P6-017                 | `migrate-canonical-denali.spec.ts` · ACL migrate             | —                                               |
| **6.9**  | IN_PROGRESS         | REQ-P6-018–022             | `phase-6.contract.spec.ts` behavioral · `phase-6:gate`       | awaiting gate exit 0                            |

## Phase 5 cross-dependency

| Phase 5 item   | Required for    | Truth at ledger date                    |
| -------------- | --------------- | --------------------------------------- |
| 5.2 validate   | 6.2, 6.5        | VERIFIED_BEHAVIORAL (expected)          |
| 5.3 projection | 6.6 list parity | SPEC_ONLY — document in 6.0 yaml        |
| 5.4 outbox     | 6.4 full parity | SPEC_ONLY — stub allowed per REQ-P6-028 |
| 5.5 audit      | 6.4+ compliance | SPEC_ONLY                               |

## Agent rules

```yaml
forbidden:
  - "Phase 6 done because denali package exists"
  - "Import legacy in apps/api"
  - "Closure from build-only without REQ-P6-015/018"
required:
  - "getDenaliWorkspacePlugin exported and registered"
  - "phase-6.contract.spec.ts behavioral at 6.9"
  - "verification-matrix row has test path or BLOCKER"
```

## Status transitions

```text
SPEC_ONLY → VERIFIED_SCAFFOLD → VERIFIED_BEHAVIORAL
```

Update this table when subphase `completion_proof` commands pass in CI.
