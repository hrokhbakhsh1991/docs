
## 43. Final Logic Lockdown: Test-Enforced Commits

**Date:** 2026-05-28

### lint-staged integration

`package.json` → `lint-staged` for `*.{js,jsx,ts,tsx,mjs,cjs}` now runs, in order:

1. `eslint --max-warnings 0`
2. `depcruise --config dependency-cruiser.config.js --output-type err-long`
3. `node scripts/precommit-tsc-staged.mjs`
4. **`node scripts/precommit-jest-staged.mjs`** (unit test gate)

The pre-commit script invokes the required Jest contract on staged paths:

```bash
pnpm exec jest --config jest.config.precommit.cjs --findRelatedTests --bail --passWithNoTests <staged files>
```

It also runs colocated **`node:test`** specs (`*.spec.ts` / `*.spec.tsx`), which cover most API/web/package unit tests not executed by Jest.

### Supporting config

| File | Purpose |
|------|---------|
| `jest.config.precommit.cjs` | Jest project root → `apps/web/jest.config.cjs` |
| `scripts/precommit-jest-staged.mjs` | Jest + node:test orchestration for lint-staged |
| `apps/web/jest.config.cjs` | Fixed `@/app/*` mapper + CSS module mock for integration tests |
| `apps/web/jest.styleMock.cjs` | CSS stub for Jest |

### Verification

| Check | Result |
|-------|--------|
| `node scripts/precommit-jest-staged.mjs apps/web/.../DenaliPricingStep.tsx` | **PASS** — 3 related Jest integration tests |
| Staged file + failing test (`expect(true).toBe(false)`) | **FAIL** — Jest exits 1 |
| `pnpm lint-staged` with staged `paths.ts` + failing `paths.spec.ts` | **FAIL** — exit 1, commit blocked |

### Outcome

**Pre-commit now enforces related unit tests.** A failing related test blocks `git commit` via Husky → `pnpm lint-staged` → `precommit-jest-staged.mjs`.

Manual re-run: `pnpm test:precommit -- <paths>` or stage files and commit.
## 44. Test Structure Audit

**Date:** 2026-05-28

Scope: **`apps/web`** and **`apps/api`** only. **No files were moved.**

### Co-location definition

**Co-located**: `__tests__/` adjacent to source, or exact stem sibling (`Foo.spec.ts` + `Foo.ts`).

**Not co-located**: `apps/web/tests/**`, `apps/api/test/**`, spec-only dirs, stem-mismatched specs in `src/`.

### Summary

| Metric | apps/web | apps/api | Total |
|--------|--------:|--------:|------:|
| Test files | 190 | 177 | 367 |
| Co-located | 121 | 79 | 200 |
| **Not co-located** | **69** | **98** | **167** |

### Non-co-located test files (full inventory)

#### `apps/web/tests/smoke/` — 13 files

- `apps/web/tests/smoke/01-tour-wizard-new.spec.ts`
- `apps/web/tests/smoke/02-tour-wizard-cinema-theme-profile.spec.ts`
- `apps/web/tests/smoke/04-tour-wizard-urban-profile.spec.ts`
- `apps/web/tests/smoke/05-tour-wizard-preset-form-profile-filter.spec.ts`
- `apps/web/tests/smoke/07-tour-edit-urban-patch.spec.ts`
- `apps/web/tests/smoke/08-tour-wizard-mix-profile-flip.spec.ts`
- `apps/web/tests/smoke/10-denali-wizard-shell.spec.ts`
- `apps/web/tests/smoke/11-denali-review-participants.spec.ts`
- `apps/web/tests/smoke/12-denali-verification-matrix.spec.ts`
- `apps/web/tests/smoke/13-denali-wizard-map-fields-dom.spec.ts`
- `apps/web/tests/smoke/data-integrity.spec.ts`
- `apps/web/tests/smoke/pre-release-flow.spec.ts`
- `apps/web/tests/smoke/routes.spec.ts`

#### `apps/web/tests/integration/` — 11 files

- `apps/web/tests/integration/tour-detail-catalog-aggregation.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.denali-map-fields.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.denali-preset-settings.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.shell.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-clone.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-preset-in-wizard.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-preset.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-matrix.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-mountain.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-mix-urban.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-urban.spec.ts`

#### `apps/web/tests/auth/` — 2 files

- `apps/web/tests/auth/login-otp-flow.spec.ts`
- `apps/web/tests/auth/session-logout.spec.ts`

#### `apps/web/tests/` root — 5 files

- `apps/web/tests/bookings.spec.ts`
- `apps/web/tests/leader_review_access.test.ts`
- `apps/web/tests/leader_review_rbac.test.ts`
- `apps/web/tests/tours-crud.spec.ts`
- `apps/web/tests/users-optimistic-role.spec.ts`

#### `apps/web/tests/audit/` — 1 files

- `apps/web/tests/audit/corruption-test.spec.ts`

#### `apps/web/tests/e2e/` — 1 files

- `apps/web/tests/e2e/denali-ux-integrity.spec.ts`

#### `apps/web/tests/tenant/` — 1 files

- `apps/web/tests/tenant/workspace-host-rsc.spec.ts`

#### `apps/web/tests/visual/` — 1 files

- `apps/web/tests/visual/ui-playground.spec.ts`

#### `apps/api/test/e2e/` — 28 files

- `apps/api/test/e2e/denali-negative-invariants.e2e-spec.ts`
- `apps/api/test/e2e/finance-cutover-integrity.e2e-spec.ts`
- `apps/api/test/e2e/invite-accept-function.e2e-spec.ts`
- `apps/api/test/e2e/invite-accept-parallel.e2e-spec.ts`
- `apps/api/test/e2e/invite-role-hierarchy.e2e-spec.ts`
- `apps/api/test/e2e/jwt-membership-guard.e2e-spec.ts`
- `apps/api/test/e2e/load-concurrency-registration.e2e-spec.ts`
- `apps/api/test/e2e/manual-receipt-flow.e2e-spec.ts`
- `apps/api/test/e2e/me-profile.e2e-spec.ts`
- `apps/api/test/e2e/ownership-transfer.e2e-spec.ts`
- `apps/api/test/e2e/payments-coexistence.e2e-spec.ts`
- `apps/api/test/e2e/payments-webhook-wrong-tenant.e2e-spec.ts`
- `apps/api/test/e2e/receipt-upload-ownership.e2e-spec.ts`
- `apps/api/test/e2e/registrations.e2e-spec.ts`
- `apps/api/test/e2e/release-gate-journeys.e2e-spec.ts`
- `apps/api/test/e2e/subdomain-comprehensive.e2e-spec.ts`
- `apps/api/test/e2e/subdomain-multi-tenant.e2e-spec.ts`
- `apps/api/test/e2e/tenant-context-leak.e2e-spec.ts`
- `apps/api/test/e2e/tenant-isolation.e2e-spec.ts`
- `apps/api/test/e2e/tour-presets-tenant-isolation.e2e-spec.ts`
- `apps/api/test/e2e/tour-wizard-template-isolation.e2e-spec.ts`
- `apps/api/test/e2e/tours-create-profile-authority.e2e-spec.ts`
- `apps/api/test/e2e/tours-create.e2e-spec.ts`
- `apps/api/test/e2e/tours-leader-integrity.e2e-spec.ts`
- `apps/api/test/e2e/tours-rbac-parity.e2e-spec.ts`
- `apps/api/test/e2e/users-cursor-bulk.e2e-spec.ts`
- `apps/api/test/e2e/users-role-rbac.e2e-spec.ts`
- `apps/api/test/e2e/workspace-users-mutations.e2e-spec.ts`

#### `apps/api/test/registrations/` — 9 files

- `apps/api/test/registrations/booking-state-machine-legacy-transitions.unit-spec.ts`
- `apps/api/test/registrations/payment.e2e-spec.ts`
- `apps/api/test/registrations/peak-experience-placement.unit-spec.ts`
- `apps/api/test/registrations/registration-placement.orchestrator.unit-spec.ts`
- `apps/api/test/registrations/registrations-idempotency.unit-spec.ts`
- `apps/api/test/registrations/registrations-stub-endpoints.unit-spec.ts`
- `apps/api/test/registrations/resolve-initial-registration-placement.unit-spec.ts`
- `apps/api/test/registrations/test-floating-capacity-engine.spec.ts`
- `apps/api/test/registrations/update-registration-status.unit-spec.ts`

#### `apps/api/test/modules/` — 9 files

- `apps/api/test/modules/identity/tenant-audit-events.controller.unit-spec.ts`
- `apps/api/test/modules/identity/users.transfer-ownership.unit-spec.ts`
- `apps/api/test/modules/identity/users.unsupported-operations.unit-spec.ts`
- `apps/api/test/modules/identity/workspace-invites.service.unit-spec.ts`
- `apps/api/test/modules/rbac/workspace-access.helper.unit-spec.ts`
- `apps/api/test/modules/rbac/workspace-membership-rbac.policy.unit-spec.ts`
- `apps/api/test/modules/tenant/tenant-bootstrap.service.unit-spec.ts`
- `apps/api/test/modules/tenant/tenant-host-resolver.service.unit-spec.ts`
- `apps/api/test/modules/tours/tours-clone.service.unit-spec.ts`

#### `apps/api/test/payments/` — 6 files

- `apps/api/test/payments/manual-payment-debt.policy.unit-spec.ts`
- `apps/api/test/payments/manual-payment.service.unit-spec.ts`
- `apps/api/test/payments/payments.service.unit-spec.ts`
- `apps/api/test/payments/postgres-payment-idempotency.integration-spec.ts`
- `apps/api/test/payments/public-registration-flow.e2e-spec.ts`
- `apps/api/test/payments/receipt.service.unit-spec.ts`

#### `apps/api/test/outbox/` — 5 files

- `apps/api/test/outbox/enqueue-domain-event-dedupe.unit-spec.ts`
- `apps/api/test/outbox/outbox-co-commit.unit-spec.ts`
- `apps/api/test/outbox/outbox-retry.spec.ts`
- `apps/api/test/outbox/outbox.processor.unit-spec.ts`
- `apps/api/test/outbox/outbox.service.unit-spec.ts`

#### `apps/api/test/guards/` — 4 files

- `apps/api/test/guards/link-telegram.guard.spec.ts`
- `apps/api/test/guards/payments-webhook-signature.guard.unit-spec.ts`
- `apps/api/test/guards/payments-webhook-skip-throttle.unit-spec.ts`
- `apps/api/test/guards/public-registration-throttle.spec.ts`

#### `apps/api/test/finance/` — 3 files

- `apps/api/test/finance/finance-reports.service.unit-spec.ts`
- `apps/api/test/finance/receipt-pending.policy.unit-spec.ts`
- `apps/api/test/finance/receipt-upload-authorization.unit-spec.ts`

#### `apps/api/test/reconciliation/` — 3 files

- `apps/api/test/reconciliation/reconciliation-job-persistence.unit-spec.ts`
- `apps/api/test/reconciliation/reconciliation.integration-spec.ts`
- `apps/api/test/reconciliation/reconciliation.service.unit-spec.ts`

#### `apps/api/test/security/` — 2 files

- `apps/api/test/security/ownership-access.unit-spec.ts`
- `apps/api/test/security/tenant-jwt-scope.unit-spec.ts`

#### `apps/api/test/` other — 12 files

- `apps/api/test/api.e2e-spec.ts`
- `apps/api/test/common/audit/financial-outbox-event-types.unit-spec.ts`
- `apps/api/test/common/tenant/tenant-resolver.middleware.unit-spec.ts`
- `apps/api/test/config/env.schema.spec.ts`
- `apps/api/test/draft-engine/draft-engine.facade.integration-spec.ts`
- `apps/api/test/idempotency/idempotency-cleanup.job.unit-spec.ts`
- `apps/api/test/idempotency/idempotency.service.unit-spec.ts`
- `apps/api/test/infra/storage-health.service.unit-spec.ts`
- `apps/api/test/jobs/idempotency-cleanup.job.spec.ts`
- `apps/api/test/pricing/create-pricing-snapshot.unit-spec.ts`
- `apps/api/test/rls-guardrail.spec.ts`
- `apps/api/test/tenant-isolation.spec.ts`

#### `apps/web/.../denali/utils/` (spec-only) — 3 files

- `apps/web/src/features/tours/wizard/denali/utils/denaliCanonicalTourModelFullState.spec.ts`
- `apps/web/src/features/tours/wizard/denali/utils/hydration.spec.ts`
- `apps/web/src/features/tours/wizard/denali/utils/projection.spec.ts`

#### `src/**` stem-mismatched (same dir, different basename) — 48 files

- `apps/api/src/modules/auth/auth.service.phone-otp.spec.ts`
- `apps/api/src/modules/draft-engine/postgres-draft-snapshot.store.spec.ts`
- `apps/api/src/modules/finance/ledger/ledger-contract-enforcement.spec.ts`
- `apps/api/src/modules/finance/ledger/persist-ledger-journal.currency.spec.ts`
- `apps/api/src/modules/finance/ledger/post-double-entry-reversal-journal.spec.ts`
- `apps/api/src/modules/finance/payments/domain/payment-transition.spec.ts`
- `apps/api/src/modules/payments/payments-finance-contract-enforcement.spec.ts`
- `apps/api/src/modules/pricing/calculate-quote.finance-parity.spec.ts`
- `apps/api/src/modules/registrations/domain/booking-transition.spec.ts`
- `apps/api/src/modules/registrations/dto/create-registration-transport.dto.spec.ts`
- `apps/api/src/modules/settings-locations/tour-creation-presets-settings.service.drift.spec.ts`
- `apps/api/src/modules/tours/dto/trip-details-denali-fields.dto.spec.ts`
- `apps/api/src/modules/tours/dto/trip-details-participation.dto.spec.ts`
- `apps/api/src/modules/tours/fitness.spec.ts`
- `apps/api/src/modules/tours/policies/denali-publish-geolocation.spec.ts`
- `apps/api/src/modules/tours/policies/tours-lifecycle-transitions.spec.ts`
- `apps/api/src/modules/tours/tours-sync-catalog.unit-spec.ts`
- `apps/web/lib/api-client.request-id.spec.ts`
- `apps/web/lib/services/tours.service.update-body.spec.ts`
- `apps/web/src/features/tours/config/editTripDetailsWizardPathDivergence.spec.ts`
- `apps/web/src/features/tours/config/fieldAccess.spec.ts`
- `apps/web/src/features/tours/edit/DenaliTourEditForm.spec.ts`
- `apps/web/src/features/tours/wizard/denali/rules/denaliUIAdapter.wizard.spec.ts`
- `apps/web/src/features/tours/wizard/denali/rules/denaliWorkspaceFieldOverlay.spec.ts`
- `apps/web/src/features/tours/wizard/denali/rules/evaluateFormRules.conflict-resolution.spec.ts`
- `apps/web/src/features/tours/wizard/denali/rules/evaluateFormRules.train-seat-preference.spec.ts`
- `apps/web/src/features/tours/wizard/denali/rules/integrity.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliApiParity.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliCanonicalRules.integration.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliGhostState.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliNumericSafety.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliPublishFlow.integration.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliRuleValidation.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliTransportPersonalCar.spec.ts`
- `apps/web/src/features/tours/wizard/denali/validation/denaliWizardEdgeCases.spec.ts`
- `apps/web/src/features/tours/wizard/domain/mapDenaliWizardCustomServiceLabels.spec.ts`
- `apps/web/src/features/tours/wizard/domain/mapDenaliWizardNonAttendanceDetails.spec.ts`
- `apps/web/src/features/tours/wizard/domain/wizard-create-tour-wire-contract.spec.ts`
- `apps/web/src/features/tours/wizard/filterFormPatchByActiveGroups.spec.ts`
- `apps/web/src/features/tours/wizard/profileRules/edit-required-parity.spec.ts`
- `apps/web/src/features/tours/wizard/profileRules/migratedSteps.spec.ts`
- `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts`
- `apps/web/src/features/tours/wizard/profileRules/profileRules.spec.ts`
- `apps/web/src/features/tours/wizard/profileRules/submit-required-parity.spec.ts`
- `apps/web/src/features/tours/wizard/schemas/denaliCanonicalTourSchema.spec.ts`
- `apps/web/src/features/tours/wizard/schemas/denaliTourCreateSchema.spec.ts`
- `apps/web/src/features/tours/wizard/tourWizardFormProfile.spec.ts`
- `apps/web/src/lib/form-rule-engine/formRuleEngine.denali.spec.ts`

### Orphaned / unclear-owner test folders

| Folder | Tests | Note |
|--------|------:|------|
| `apps/web/tests/` | 35 | App-level Playwright; no `features/*` parent |
| `apps/web/tests/smoke/` | 13 | Owner: `features/tours/wizard` |
| `apps/web/tests/integration/` | 11 | Owner: `features/tours` |
| `apps/web/tests/auth/` | 2 | No `features/auth/` |
| `apps/web/tests/audit/` | 1 | Owner: `features/tours/wizard/denali` |
| `apps/web/tests/e2e/` | 1 | Denali UX E2E |
| `apps/web/tests/tenant/` | 1 | `packages/tenant-host` |
| `apps/web/tests/visual/` | 1 | `@tour/ui` VRT |
| `apps/api/test/` | 98 | Nest mirror outside `src/` |
| `apps/api/test/e2e/` | 28 | Cross-module E2E |
| `apps/web/.../denali/utils/` | 3 | Spec-only pocket |

### Notes

- 48 stem-mismatched specs under `src/**` (e.g. `auth.service.phone-otp.spec.ts`).
- 5 Denali `__tests__/*.integration.test.tsx` and 4 API `database/__tests__` specs are co-located.

