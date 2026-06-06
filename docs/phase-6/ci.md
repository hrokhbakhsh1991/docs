# Phase 6 — CI

```yaml
phase_6_guard:
  command: pnpm run phase-6:guard
  entrypoint: scripts/guards/phase-6-guard.mjs

fast_closure:
  command: pnpm run phase-6:fast-closure
  chain: "pnpm build && pnpm test && denali test && phase-5:guard && phase-6:guard"
  workflow: .github/workflows/phase-6-gate.yml#fast-closure

closure_gate:
  command: pnpm run phase-6:gate
  chain: "pnpm build && pnpm test && pnpm run phase-5:gate && pnpm run phase-6:guard"
  note: "Full nested gate (~60 min) — run locally or extend nightly workflow"
```

## GitHub Actions (`phase-6-gate.yml`)

| Job            | Proves                         | Services / infra                           |
| -------------- | ------------------------------ | ------------------------------------------ |
| `fast-closure` | REQ-P6-022 fast-track closure  | Postgres 16 · migrate deploy · app role    |
| `minio-photo`  | REQ-P6-016 round-trip          | MinIO container on `:9002` · bucket ensure |
| `smoke-denali` | SMK-P6-01..06 Playwright smoke | Postgres · build · Playwright Chromium     |

**Triggers:** `push` to `main`, nightly cron `0 5 * * *`, `workflow_dispatch`.

**PR path:** Phase 6 product closure is not on every PR — `phase-4-gate` + `phase-5-gate` cover cross-phase postgres guards. Merge to `main` runs `phase-6-gate` and clears `BLOCKER-P6-MINIO-ENV` CI waiver.

**Env (CI jobs with Postgres):**

```bash
DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32
DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db
STORAGE_DRIVER=prisma
NODE_ENV=test
```

**MinIO job env:**

```bash
MINIO_ENDPOINT=http://127.0.0.1:9002
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=app-tour-dev
```

## Doc validation (no Postgres)

```bash
pnpm run phase-6:guard
node scripts/guards/lib/anti-hollow-phase6.mjs
```

**Note:** `phase-6:guard` proves **doc execution system ≥ 96** — not Denali product closure alone.
