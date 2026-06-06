# Phase 6 — Test matrix (REQ ↔ spec)

> **Authoritative REQ list:** [`../audits/verification-matrix.md`](../audits/verification-matrix.md)

| REQ-P6      | Subphase | Spec file                                   | Type        | Status |
| ----------- | -------- | ------------------------------------------- | ----------- | ------ |
| 005,018     | 6.1,6.9  | `phase-6.contract.spec.ts`                  | contract    | TARGET |
| 006,023     | 6.2,6.6  | `registry-parity.spec.ts`                   | unit        | TARGET |
| 011,012,028 | 6.4      | `finance-outbox-consumer.spec.ts`           | unit+stub   | TARGET |
| 013,026     | 6.5      | `denali-workspace-plugin.spec.ts`           | integration | TARGET |
| 015         | 6.6      | smoke / Playwright                          | e2e         | TARGET |
| 016         | 6.7      | `minio-photo.spec.ts`                       | e2e         | TARGET |
| 017         | 6.8      | `migrate-canonical-denali.spec.ts`          | integration | TARGET |
| 021         | —        | `denali-coupling.contract.spec.ts`          | contract    | EXISTS |
| 026         | 6.5      | `denali-workspace-binding.contract.spec.ts` | contract    | EXISTS |

**Honesty:** STATUS `TARGET` until IMPLEMENTATION-TRUTH row is VERIFIED_BEHAVIORAL.
