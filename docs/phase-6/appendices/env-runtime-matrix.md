# Phase 6 — Environment matrix

> **Decisions:** [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) DEC-P6-005, DEC-P6-006  
> **Phase 5 base:** [`../../phase-5/appendices/env-runtime-matrix.md`](../../phase-5/appendices/env-runtime-matrix.md)  
> **Phase 4 base:** [`../../phase-4/appendices/env-runtime-matrix.md`](../../phase-4/appendices/env-runtime-matrix.md)

```yaml
extends: docs/phase-5/appendices/env-runtime-matrix.md
node: "24.x per .nvmrc"
prerequisite_gate: pnpm run phase-5:gate
```

## Variables (Phase 6 additive)

| Variable                       | Required when            | Default dev             | Default prod       | Notes                                   |
| ------------------------------ | ------------------------ | ----------------------- | ------------------ | --------------------------------------- |
| `MINIO_ENDPOINT`               | 6.7 e2e / photo features | `http://127.0.0.1:9000` | **required**       | S3-compatible API                       |
| `MINIO_ACCESS_KEY`             | MinIO tests              | `minioadmin`            | secret             | Never commit prod keys                  |
| `MINIO_SECRET_KEY`             | MinIO tests              | `minioadmin`            | secret             | —                                       |
| `MINIO_BUCKET`                 | uploads                  | `app-tour-dev`          | per env            | **Prefix** `{tenantId}/` in object keys |
| `MINIO_USE_SSL`                | prod                     | `false`                 | `true`             | —                                       |
| `SHADOW_VALIDATE_DENALI`       | dual validate diff       | `false`                 | **forbidden true** | REQ-P6-024 — non-prod only              |
| `MIGRATE_CANONICAL_TENANT_IDS` | 6.8 execution            | empty                   | allowlist UUIDs    | Controlled migration only               |

**Legacy names (stable where possible):** align with `legacy/` MinIO compose when porting 6.7 — document drift in IMPLEMENTATION-TRUTH if renamed.

## Required by subphase

| Subphase | Env / infra                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| **6.0**  | `phase-5:gate` · `reports/phase-6-entry-verified.yaml`                             |
| **6.1**  | Node 24 · pnpm workspace includes `@app-tour/workspace-denali`                     |
| **6.2**  | `denali:codegen` in package scripts (CI optional)                                  |
| **6.4**  | Phase 5 `OUTBOX_RELAY_ENABLED` when full parity; stub OK per BLOCKER-P6-OUTBOX-5.4 |
| **6.5**  | `DATABASE_URL` + `STORAGE_DRIVER=prisma` for integration                           |
| **6.6**  | smoke host / Playwright base URL (e.g. denali tenant host)                         |
| **6.7**  | `MINIO_*` all set · bucket seeded                                                  |
| **6.8**  | `MIGRATE_CANONICAL_TENANT_IDS` non-empty only in migration job                     |
| **6.9**  | full `phase-6:gate` recipe below                                                   |

## CI recipe (copy-paste)

```bash
nvm use
export STORAGE_DRIVER=prisma
export DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev}"
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
export MINIO_BUCKET="${MINIO_BUCKET:-app-tour-dev}"
pnpm run phase-5:gate
pnpm run phase-6:guard
pnpm --filter @app-tour/workspace-denali test
```

## Forbidden env

```yaml
forbidden:
  - SHADOW_VALIDATE_DENALI=true in NODE_ENV=production
  - MIGRATE_CANONICAL_TENANT_IDS=* in production without runbook
  - public-read MinIO bucket ACL
```
