# Phase 7 — Guards reference

```yaml
guard_version: "2026-06-04-v2"
```

## Commands

| Script                                              | Role                                    |
| --------------------------------------------------- | --------------------------------------- |
| `pnpm run phase-7:guard`                            | Doc pack + urban absence honesty        |
| `pnpm run phase-7:adversarial-gate`                 | 7.8 P0 matrix (+ optional ci:integrity) |
| `pnpm run phase-7:gate`                             | `phase-6:gate` + `phase-7:guard`        |
| `node scripts/guards/lib/phase-7-doc-hardening.mjs` | Semantic PEK checks (target ≥96)        |
| `node scripts/guards/lib/anti-hollow-phase7.mjs`    | Scaffold honesty                        |

## GitHub Actions (7.8)

Workflow [`.github/workflows/phase-7-gate.yml`](../../../.github/workflows/phase-7-gate.yml):

| Job              | Command                                                | Postgres |
| ---------------- | ------------------------------------------------------ | -------- |
| `adversarial-p0` | `PHASE_7_SKIP_CI_INTEGRITY=1 phase-7:adversarial-gate` | yes      |
| `ci-integrity`   | `pnpm run ci:integrity`                                | yes      |
| `platform-dod`   | `phase-7:platform-gate` (needs both jobs green)        | yes      |

Postgres service uses `mirror.gcr.io/library/postgres:16` (not `docker.io` directly) to reduce Hub pull flakes on GitHub-hosted runners.

`adversarial-p0` runs `prisma:generate` and `pnpm build` after migrate deploy — API specs import `@prisma/client` via `bootstrap-outbox-test-env.ts`, and `ADV-P7-P0-04` resolves `@app-tour/workspace-sdk/dist` from the urban workspace. `ci-integrity` already builds via `phase-0:integration-gate`.

`verify-phase-7-genericity-proof-rev` (proof rev **5**) rejects `HEAD` before `b046bdb` and the bf6c9f4 `registry smoke` title. **Re-run failed jobs** replays the same SHA (`bf6c9f488ef0…` in logs) — open the workflow run created by the latest push to `phase-7/entry-gate` (`529bb2f+` tip).

Pre-commit stays `pre-commit:fast` — do not run full `ci:integrity` locally before every commit.

## Behavioral guards (implementation phase)

| Guard                                      | Subphase | Target                            |
| ------------------------------------------ | -------- | --------------------------------- |
| `phase-7.contract.spec.ts`                 | 7.2, 7.9 | zero platform-core diff for urban |
| `urban-workspace-plugin.spec.ts`           | 7.3      | API resolve                       |
| `urban-create-publish.integration.spec.ts` | 7.4      | E2E                               |
| `tenant-connection-router.spec.ts`         | 7.7      | silo routing                      |

## Report output

`reports/phase-7-gate-YYYY-MM-DD.json`
