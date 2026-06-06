# Phase 7 — Adversarial matrix (7.8)

> **REQ:** REQ-P7-024..026 · **Re-run:** Phases 3–6 paths on **both** denali and urban tenants

## P0 — must pass before 7.9

| ID           | Source phase   | Spec / command                               | Urban tenant             | Denali tenant        |
| ------------ | -------------- | -------------------------------------------- | ------------------------ | -------------------- |
| ADV-P7-P0-01 | 4 RLS          | `apps/api/test/rls-tenant-isolation.spec.ts` | no cross-tenant read     | no cross-tenant read |
| ADV-P7-P0-02 | 4 RLS          | `apps/api/test/rls-write-boundary.spec.ts`   | write scoped             | write scoped         |
| ADV-P7-P0-03 | 5 validation   | plugin `validateCanonical` golden fixtures   | urban golden pass        | denali golden pass   |
| ADV-P7-P0-04 | 7.2 genericity | `phase-7.contract.spec.ts`                   | platform-core diff empty | N/A                  |
| ADV-P7-P0-05 | 7.3 resolve    | `urban-workspace-plugin.spec.ts`             | urban bound              | denali still bound   |
| ADV-P7-P0-06 | 7.4 E2E        | `urban-create-publish.integration.spec.ts`   | create→publish           | N/A                  |
| ADV-P7-P0-07 | ci             | `pnpm run ci:integrity`                      | full chain green         | full chain green     |

## P1 — should pass; waiver documents in TRUTH

| ID           | Source phase   | Spec / command                     | Note                            |
| ------------ | -------------- | ---------------------------------- | ------------------------------- |
| ADV-P7-P1-01 | 5 outbox       | outbox relay integration           | if 5.4 still SPEC — stub waiver |
| ADV-P7-P1-02 | 7.6 rate limit | `rate-limit-tenant.spec.ts`        | skip if REDIS_URL unset         |
| ADV-P7-P1-03 | 7.7 silo       | `tenant-connection-router.spec.ts` | enterprise fixture only         |
| ADV-P7-P1-04 | 7.5 obs        | `audit-log-fields.mjs`             | §10.2 complete                  |

## Run bundle

```bash
pnpm run ci:integrity
pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-create-publish.integration.spec.ts
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/phase-7.contract.spec.ts
```

## Forbidden closure

- 7.9 PASS with only `phase-7:guard` green (P7-F-005)
- Skip ADV-P7-P0-04 genericity proof
