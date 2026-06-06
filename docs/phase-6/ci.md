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
  workflow: .github/workflows/phase-6-gate.yml#full-gate
```

## Local vs GitHub (tiered)

| Tier   | Command                                         | Where              | ~Time               | When                  |
| ------ | ----------------------------------------------- | ------------------ | ------------------- | --------------------- |
| **L0** | `pnpm run pre-commit:fast`                      | **Local**          | &lt;2 min           | Every commit          |
| **L1** | `pnpm run test:changed`                         | **Local**          | 1–5 min             | Before push           |
| **L2** | `pnpm run phase-6:guard`                        | Local or CI        | ~30 s               | Doc-only changes      |
| **C1** | `phase-4-gate` + `phase-5-gate`                 | **GitHub PR**      | ~30–45 min          | Every PR              |
| **C2** | `fast-closure` · `minio-photo` · `smoke-denali` | **GitHub PR/main** | ~15–45 min parallel | PR + merge            |
| **C3** | `phase-6:gate` (full)                           | **GitHub only**    | ~60–90 min          | Sunday cron or manual |

**Rule:** Do not run **C2/C3** locally unless explicitly debugging — use GitHub as source of truth.

**Local recipe (fast coding loop):**

```bash
nvm use
pnpm run pre-commit:fast
pnpm run test:changed
git push
# Read failing CI logs; fix; repeat
```

## GitHub Actions (`phase-6-gate.yml`)

| Job            | Proves                         | Services / infra                                            |
| -------------- | ------------------------------ | ----------------------------------------------------------- |
| `fast-closure` | REQ-P6-022 fast-track closure  | Postgres 16 · migrate deploy · app role                     |
| `minio-photo`  | REQ-P6-016 round-trip          | `workspace-denali...` build · MinIO `:9002` · bucket ensure |
| `smoke-denali` | SMK-P6-01..06 Playwright smoke | Postgres · build · Playwright Chromium                      |
| `full-gate`    | REQ-P6-022 nested closure      | Postgres · `pnpm run phase-6:gate`                          |

**Triggers:**

| Event               | Jobs that run                                         |
| ------------------- | ----------------------------------------------------- |
| `pull_request`      | fast-closure · minio-photo · smoke-denali             |
| `push` → `main`     | fast-closure · minio-photo · smoke-denali             |
| `schedule` daily    | fast-closure · minio-photo · smoke-denali             |
| `schedule` Sunday   | above + **full-gate**                                 |
| `workflow_dispatch` | behavioral jobs + optional **full-gate** (default on) |

**PR cross-phase:** `phase-4-gate` + `phase-5-gate` still run on every PR (Postgres resilience + Phase 5 closure).

**Env (CI jobs with Postgres):**

```bash
DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32
DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db
STORAGE_DRIVER=prisma
NODE_ENV=test
```

**MinIO job:** `test:minio-photo` imports `@app-tour/workspace-denali` from `dist/` — run `pnpm --filter @app-tour/workspace-denali... run build` before the spec (wired in root `package.json` and CI).

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
