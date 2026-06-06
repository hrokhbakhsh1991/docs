# Phase 6 — MAP bridge

> **SOURCE OF TRUTH (narrative):** [`../../MIGRATION-MAP.md`](../../MIGRATION-MAP.md) Phase 6 §11  
> **Execution:** [`../phase-6-agent-router.md`](../phase-6-agent-router.md)

| MAP # | Subphase              | REQ (primary)  | Verification command                             |
| ----- | --------------------- | -------------- | ------------------------------------------------ |
| 6.1   | 6.1-denali-package    | REQ-P6-004     | `pnpm --filter @app-tour/workspace-denali build` |
| 6.2   | 6.2-registry-rules    | REQ-P6-006,007 | `registry-parity.spec.ts`                        |
| 6.3   | 6.3-widgets-theme     | REQ-P6-010     | composites + theme tests                         |
| 6.4   | 6.4-finance-slice     | REQ-P6-011     | `finance-outbox-consumer.spec.ts`                |
| 6.5   | 6.5-bootstrap         | REQ-P6-013     | `denali-workspace-plugin.spec.ts`                |
| 6.6   | 6.6-smoke-parity      | REQ-P6-015     | smoke / Playwright                               |
| 6.7   | 6.7-minio-photos      | REQ-P6-016     | `minio-photo.spec.ts`                            |
| 6.8   | 6.8-migrate-canonical | REQ-P6-017     | migrate integration                              |
| Gate  | 6.9-phase-gate        | REQ-P6-022     | `pnpm run phase-6:gate`                          |

**§12 MAP:** Contract + HTTP e2e — not grep-only (`REQ-P6-018`, `P6-F-004`).
