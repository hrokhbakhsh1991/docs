# Phase 0 — excellence sign-off (G-07)

```yaml
date: 2026-06-05
git_sha: local
scope: phase-0-foundation + trunk gates + excellence PRs G-01..G-06
target_score: "≥95/100"
```

## Score matrix (§0 runbook)

| محور              | وزن     | امتیاز | هدف     | شواهد                                                |
| ----------------- | ------- | ------ | ------- | ---------------------------------------------------- |
| زیرساخت واقعی     | 15      | 15     | 15      | Postgres :5434 healthy · migrate deploy · seed       |
| covenant + guards | 20      | 20     | 20      | `phase-0:covenant-gate` 12/12 · foundation-gate JSON |
| API Prisma + RLS  | 20      | 19     | 19      | tenant-security · rls-isolation (فاز D/E)            |
| gate ladder 0→4   | 25      | 25     | 25      | `phase-0-integration-gate` · phase-4:gate (F-06)     |
| smoke / dev       | 10      | 9      | 9       | API :3001 health · POST /tours 401                   |
| doc + ops         | 10      | 10     | 10      | G-01..G-06 docs · branch protection · circular rule  |
| **جمع**           | **100** | **98** | **≥95** | **PASS**                                             |

## Excellence PRs closed

| ID   | Item                                                   | Status |
| ---- | ------------------------------------------------------ | ------ |
| G-01 | `phase-0:covenant-gate` / `phase-0:trunk-gate` aliases | Done   |
| G-02 | `no-circular-dependencies` in depcruise                | Done   |
| G-03 | `reports/phase-0-integration-gate-*.json`              | Done   |
| G-04 | REM-013 doc truth in `phase-0-foundation.mdoc`         | Done   |
| G-05 | `GITHUB_BRANCH_PROTECTION.md` both jobs required       | Done   |
| G-06 | `WorkspacePlugin.contractVersion: 1`                   | Done   |
| G-07 | This sign-off                                          | Done   |

## Verification commands (G-08)

```bash
pnpm run phase-0:covenant-gate
pnpm run phase-0:trunk-gate
pnpm run phase-4:gate
DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync
pnpm run baseline:metrics
pnpm run guard:architecture
```

Artifacts:

- `reports/phase-0-foundation-gate-2026-06-05.json`
- `reports/phase-0-integration-gate-2026-06-05.json`
- `reports/phase-0-baseline-2026-06-05.json`
- `reports/phase-4-gate-*.json` (after F-06)
