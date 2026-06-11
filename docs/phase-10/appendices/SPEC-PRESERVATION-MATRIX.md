# Spec preservation matrix — Phase 10 remediation

> هر فاز باید این specها را **سبز** نگه دارد مگر DEC صریح waiver.

## P0 — Baseline (قبل از فاز ۱)

```bash
pnpm run guard:architecture
pnpm run guard:import-boundary
```

## Phase 1 — Events (اجباری)

| Spec | مسیر | رفتار محافظت‌شده |
| ---- | ---- | ----------------- |
| Denali finance outbox | `apps/api/test/denali-finance-outbox.integration.spec.ts` | idempotency `domainEventId`؛ ledger enqueue |
| Outbox relay integration | `apps/api/test/outbox-relay.integration.spec.ts` | claim → publish → done |
| TourCreated envelope | `apps/api/src/events/tour-created-envelope-guard.ts` + specs مرتبط | tenant parity |

## Phase 2 — Registry (اجباری)

| Spec | مسیر |
| ---- | ---- |
| API plugin resolve | `apps/api/src/workspace/resolve-workspace-plugin.spec.ts` |
| Denali binding | `apps/api/test/denali-workspace-plugin.spec.ts` |
| Urban binding | `apps/api/test/urban-workspace-plugin.spec.ts` |
| SDK denali binding | `packages/workspace-sdk/test/denali-workspace-binding.contract.spec.ts` |
| SDK urban binding | `packages/workspace-sdk/test/urban-workspace-binding.contract.spec.ts` |
| SDK plugin binding invariant | `packages/workspace-sdk/test/invariants/plugin-binding.contract.ts` |
| Web boundary | `apps/web/test/workspace-boundary.spec.ts` |
| Denali workspace contract | `packages/workspaces/denali/test/phase-6.contract.spec.ts` |
| Urban phase 7 | `packages/workspaces/urban/test/phase-7.contract.spec.ts` |

## Phase 3 — Urban HTTP (اجباری)

| Spec | مسیر |
| ---- | ---- |
| Urban catalog + registration | `apps/api/test/urban-catalog-registration.spec.ts` |
| Urban settings | `apps/api/test/urban-settings-patch.spec.ts` |
| Urban owner ability | `apps/api/test/urban-owner-ability.spec.ts` |
| Urban e2e HTTP | `apps/api/test/urban-e2e-http.spec.ts` |
| Phase 8 contract | `apps/api/test/phase-8.contract.spec.ts` (urban 403 rows) |
| OpenAPI parity guard | `apps/api/scripts/guard-openapi-dispatch-parity.mjs` |

## Foundation (همیشه)

| Guard | دستور |
| ----- | ------ |
| platform-core isolation | `pnpm run guard:architecture` — `platform-core-no-workspaces` |
| import boundary | `pnpm run guard:import-boundary` |
| platform-core tests | `pnpm --filter @app-tour/platform-core run test` |

## Fast-track پیشنهادی پس از هر sub-phase

```bash
pnpm run pre-commit:fast
pnpm run test:changed
```

**Full gate:** فقط با تأیید صریح کاربر (`phase-5:gate` / `test:full`).
