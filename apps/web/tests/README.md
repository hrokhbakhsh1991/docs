# Web app testing layers

Three intentional layers keep Denali/wizard tests fast, focused, and maintainable.

## Structural guards

**What:** Pure config/registry validation — no React tree, no auth, no network.

**Where:**

- Shared helpers: `src/features/tours/wizard/testing/wizard-testing-utils.ts`, `structural-guard.ts`
- Denali workspace config: `src/features/tours/wizard/denali/wizardTestConfig.denali.ts`
- Specs: `src/features/tours/wizard/denali/__tests__/guards/*.guard.test.ts`

**Run:**

```bash
pnpm --filter @apps/web exec vitest run src/features/tours/wizard/denali/__tests__/guards
```

**Patterns:**

| Kind | Example | Runner |
|------|---------|--------|
| Config guard | `describeConfigStructuralGuard(..., denaliTestConfig, [{ verify }])` | Vitest |
| Domain guard | Registry ↔ template keys (`@repo/denali-domain`) | Vitest |
| Filesystem guard | Header plugin registration (`readFileSync` + `assert`) | Vitest |
| Perf guard | `denali-section-mount.perf.spec.tsx` | Jest (jsdom benchmark) |

See `src/features/tours/wizard/denali/__tests__/guards/README.md` for the file index.

## Integration harness

**What:** Component and wizard flows under a real app shell (theme, React Query, auth hydration).

**Where:**

- `lib/test/AppTestProviders.tsx` — production-shaped provider stack
- `tests/utils/denali-integration-harness.tsx` — `DenaliFormHarness`, `DenaliNavigationHarness`, …
- `tests/utils/denali-flat-edit-mount-target.tsx` — perf guard mount (no auth shell)
- `*.integration.test.tsx` under `src/features/tours/wizard/denali/`

**Run:**

```bash
pnpm --filter @apps/web exec jest --config jest.config.cjs --runInBand
```

Jest setup stubs `GET /api/auth/session` via `lib/test/install-auth-fetch-mock.jest.ts` and `auth-jest-mocks.ts`.

## Auth hydration

**What:** Session bridge, hydrate timeouts, transient failures, theme vs auth ordering.

**Where:**

- `tests/auth-hydration.spec.tsx`
- `lib/test/session-fixtures.ts` — JWT builders, storage keys, hydrate response helpers
- `tests/utils/render-with-auth.tsx` — Vitest `renderWithAuth()`

**Run:**

```bash
pnpm --filter @apps/web run test:auth-hydration
```

## Quick reference

| Concern | Use | Avoid |
|---------|-----|--------|
| Registry ↔ focus map | Structural guard + `WizardTestConfig` | RTL + mocked auth |
| Step UI behaviour | Jest integration + `DenaliFormHarness` | Duplicating provider stacks |
| Cookie / `isHydrated` | `renderWithAuth` / `session-fixtures` | Mocking `useAuth` in integration tests |
| E2E wizard + cookie | `tour-wizard-smoke-helpers.ts` + Playwright | Vitest for full browser flows |
