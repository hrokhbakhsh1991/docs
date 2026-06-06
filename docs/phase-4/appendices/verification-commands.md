# Appendix — Phase 4 verification commands

> **SoT:** copy-paste block for agents. Bind to [`ci.md`](../ci.md) `P4-CMD-*` — if drift, **package.json wins**.

```yaml
appendix_meta:
  phase_id: "4"
  binding: REPO_SCRIPTS_OVER_STALE_MD
  load_tier: T0_execution
```

## Prerequisites

```bash
nvm use && corepack enable   # Node 24 required — engines in package.json
pnpm install
pnpm run phase-3:gate    # required before 4.0+ work
```

## Per-subphase (during development)

```bash
# 4.0 — red flags + report
pnpm run phase-3:gate
# report (required): reports/phase-3.2-red-flag-status-YYYY-MM-DD.md
# template: reports/phase-3.2-red-flag-status-TEMPLATE.md
pnpm --filter @apps/api test -- src/tenant-kernel/tenant-kernel.spec.ts
pnpm --filter @apps/api test -- src/tenant-kernel/auth-env.spec.ts
pnpm --filter @apps/api test -- src/storage/in-memory-tour.repository.spec.ts

# 4.1 — tenant kernel package
pnpm --filter @app-tour/tenant-kernel run build
pnpm --filter @app-tour/tenant-kernel run test
pnpm --filter @app-tour/tenant-kernel run test:phase-4

# 4.2 — Postgres + RLS (see appendices/storage-driver-truth.md)
export STORAGE_DRIVER=prisma DATABASE_URL=postgresql://...
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @apps/api test -- rls-isolation.integration.spec

# 4.3 — two-tenant security
pnpm --filter @apps/api test -- tenant-security.spec

# 4.4 — theme (test matrix TH-1 — not P4-E-*)
# run web e2e / integration per subphases/4.4-tenant-theme.md

# 4.5 — platform events
pnpm --filter @app-tour/platform-events run build
pnpm --filter @app-tour/platform-events run test

# 4.6 — closure
pnpm run phase-4:gate
pnpm run guard:doc-sync
```

## Full closure chain (`phase-4:gate`)

```bash
pnpm build
pnpm test
pnpm run phase-3:gate      # embeds phase-2, doc-gate, architecture guards
pnpm run phase-4:guard     # p4_* → reports/phase-4-gate-YYYY-MM-DD.json
```

## Guard-only (debug — not merge proof)

```bash
pnpm run phase-4:guard
```

## Pre-commit note

`pnpm run ci:integrity` runs **phase-0 + phase-1 only** — does **not** replace `phase-4:gate` (see DRIFT-P4-03).
