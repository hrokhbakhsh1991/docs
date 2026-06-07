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
