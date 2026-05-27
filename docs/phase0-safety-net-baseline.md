# Phase 0 Safety Net Baseline

This document defines the behavior baseline that must remain stable before starting the Draft Engine FSM refactor.

## Wizard E2E Baseline (Playwright)

Primary regression suite lives under `apps/web/tests` and currently covers wizard/Denali flows via smoke and integration specs.

### Smoke baseline

- `apps/web/tests/smoke/01-tour-wizard-new.spec.ts`
- `apps/web/tests/smoke/02-tour-wizard-cinema-theme-profile.spec.ts`
- `apps/web/tests/smoke/04-tour-wizard-urban-profile.spec.ts`
- `apps/web/tests/smoke/05-tour-wizard-preset-form-profile-filter.spec.ts`
- `apps/web/tests/smoke/08-tour-wizard-mix-profile-flip.spec.ts`
- `apps/web/tests/smoke/10-denali-wizard-shell.spec.ts`
- `apps/web/tests/smoke/11-denali-review-participants.spec.ts`
- `apps/web/tests/smoke/12-denali-verification-matrix.spec.ts`
- `apps/web/tests/smoke/13-denali-wizard-map-fields-dom.spec.ts`

### Integration baseline

- `apps/web/tests/integration/wizard-real-stack.shell.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-urban.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-mix-urban.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-mountain.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-matrix.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-preset.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-preset-in-wizard.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-clone.spec.ts`
- `apps/web/tests/integration/wizard-real-stack.denali-map-fields.spec.ts`

## Gap Analysis (Phase 0)

Required safety behaviors for draft flow:

1. restore after reload
2. error visibility on save failure
3. retry path after save failure
4. form state persistence while navigating steps

Status before Phase 0 implementation:

- restore after reload: partially covered (`12-denali-verification-matrix`, case 2c)
- error visibility + retry: not explicitly asserted as a dedicated flow
- navigation persistence: covered (`12-denali-verification-matrix`, case 2b)

Phase 0 action:

- extend `apps/web/tests/smoke/12-denali-verification-matrix.spec.ts` with an explicit draft save error + retry regression scenario
- reduce brittle timing by waiting for actual draft PATCH activity before reload in restore scenario

## Draft Engine Unit Baseline

Contract suite: `packages/draft-engine/src/engine.spec.ts`

Core covered behavior:

- initialize/fetch success and failure
- autoApply/manual draft restore
- debounce + single-flight sync
- error/retry flow
- conflict strategies (`SERVER_WINS`, `CLIENT_WINS`, `MERGE`, `REFETCH_REAPPLY`)
- remote hydration semantics

Phase 0 action:

- add missing contract-level cases for guard behavior (blocked updates while `DRAFT_AVAILABLE`) and no-op retry outside `ERROR`.

## Phase 0 Gate Commands

- `pnpm --filter @repo/draft-engine run test`
- `pnpm --dir apps/web exec playwright test tests/smoke/12-denali-verification-matrix.spec.ts`
