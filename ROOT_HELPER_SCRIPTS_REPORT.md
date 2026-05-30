# Root Helper Scripts Audit Report

**Generated:** 2026-05-30  
**Scope:** Repository root (`/`) only — loose `.js`, `.mjs`, and `.cjs` files  
**Action taken:** Inventory only; no files deleted or modified.

---

## Scan Methodology

1. Listed all `*.js`, `*.mjs`, and `*.cjs` files at the repository root (max depth 1).
2. Excluded official framework / tooling configuration files (see allowlist below).
3. Read each remaining script’s source to infer intent from logic and inline comments.
4. Searched for invocations in:
   - Root `package.json` scripts
   - `.husky/` hooks
   - `scripts/ci-integrity-check.sh`
   - Full-repo grep for each filename

**Result:** 19 ephemeral helper scripts discovered. **0** are wired into CI, Husky, or `package.json`.

---

## Excluded (Official Tooling — Not Audited Here)

| File | Role |
|------|------|
| `jest.config.cjs` | Jest root config |
| `jest.config.precommit.cjs` | Jest pre-commit config |
| `jest.pbt.config.js` | Property-based testing config |
| `dependency-cruiser.config.js` | Dependency-cruiser rules |
| `commitlint.config.js` | Commit message linting |
| `.eslintrc.cjs` | ESLint configuration |

No root-level `test*.js`, `*.mjs`, or loose `*.cjs` helper scripts were found beyond the inventory below.

---

## Migration Context (Shared Background)

These scripts cluster around a single architectural refactor: **decouple the registrations module from direct TypeORM `TourEntity` / `TourDepartureEntity` access** by introducing `RegistrationsTourCatalogPort`, then update unit/e2e tests to pass an 11th constructor argument (`registrationsTourCatalogPort` stub).

Evidence the migration is **already applied** in source:

- `registration.entity.ts` — no `TourEntity` imports or `@ManyToOne` tour relations.
- `typeorm-registrations-application.service.ts` — uses `registrationsTourCatalogPort` throughout; no `TourEntity` references.
- `apps/api/test/registrations/stub-registrations-tour-catalog.port.ts` — dedicated test stub exists.

Re-running most of these scripts against the current tree would be **unsafe** (duplicate stubs, broken regex replacements, or stripped production logic).

---

## Script Inventory (Line-by-Line)

---

### 1. `fix_catalog_port.js`

**File Name & Path:** `fix_catalog_port.js` (repository root)

**Code Intent & Purpose:** One-off codemod for `apps/api/src/modules/registrations/repositories/typeorm-registrations-application.service.ts`. Removes direct imports of `TourEntity`, `TourDepartureEntity`, and `TourDetails`. Injects `REGISTRATIONS_TOUR_CATALOG_PORT` into the constructor. Replaces every `manager.findOne(TourEntity, …)`, `manager.find(TourEntity, …)`, pessimistic lock query, and `manager.save(tour)` call with equivalent `registrationsTourCatalogPort` methods (`getTourSnapshot`, `getTourTitles`, `lockTourSnapshot`, `syncTourDepartureCapacity`, `applyAcceptedCounterDelta`). Rewrites type annotations from `TourEntity` to `TourCatalogSnapshot`. Contains an incomplete/broken replacement for `manager.save(tour)` (placeholder comment about delta calculation).

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Migration already landed; regex-based replacements are fragile and re-execution would corrupt the service file.

---

### 2. `fix_delta.js`

**File Name & Path:** `fix_delta.js` (repository root)

**Code Intent & Purpose:** Follow-up codemod on the same `typeorm-registrations-application.service.ts` after `fix_catalog_port.js`. Replaces broken `applyAcceptedCounterDelta` port calls left by the first script. Converts inline `tour.acceptedCount += 1` + `manager.save(tour)` patterns to explicit port calls with delta `1`. Refactors status-transition blocks to use `calculateAcceptedCounterDelta()` instead of mutating via `applyAcceptedCounterDelta()`. Renames the private method from `applyAcceptedCounterDelta` to `calculateAcceptedCounterDelta` (pure delta computation).

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Second-pass fix for an already-applied migration; redundant and unsafe to re-run.

---

### 3. `fix_delta2.js`

**File Name & Path:** `fix_delta2.js` (repository root)

**Code Intent & Purpose:** Simpler variant of `fix_delta.js` targeting the same service file. Replaces remaining `tour.acceptedCount += 1` / `manager.save(tour)` and `applyAcceptedCounterDelta(lockedTour, …)` / `manager.save(lockedTour)` blocks with port-based `applyAcceptedCounterDelta(manager, tourId, tenantId, delta)` calls. Does **not** include the `calculateAcceptedCounterDelta` rename from `fix_delta.js`.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Superseded iteration; obsolete given current source state.

---

### 4. `strip_relations.js`

**File Name & Path:** `strip_relations.js` (repository root)

**Code Intent & Purpose:** Strips TypeORM cross-module relations from registration entities. For `registration.entity.ts` and `waitlist-item.entity.ts`: removes `TourEntity` / `TourDepartureEntity` imports, `@ManyToOne` + `@JoinColumn` `tour` and `tourDeparture` property declarations via regex.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Relations already removed from target entities; re-run is a no-op at best.

---

### 5. `strip_relations_2.js`

**File Name & Path:** `strip_relations_2.js` (repository root)

**Code Intent & Purpose:** Narrower follow-up to `strip_relations.js`. Only removes `TourEntity` and `TourDepartureEntity` import lines from `waitlist-item.entity.ts` and `registration.entity.ts` (does not touch relation decorators).

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Redundant subset of `strip_relations.js`; imports already absent.

---

### 6. `fix_test_catalog_port.js`

**File Name & Path:** `fix_test_catalog_port.js` (repository root)

**Code Intent & Purpose:** First iteration of test-fix script. Appends a `registrationsTourCatalogPort` stub object (with `getTourSnapshot`, `lockTourSnapshot`, `getTourTitles`, `applyAcceptedCounterDelta`, `syncTourDepartureCapacity`) as the 11th argument to `new TypeOrmRegistrationsApplicationService(...)` calls. Targets:
- `apps/api/test/registrations/registrations-stub-endpoints.unit-spec.ts`
- `apps/api/test/registrations/update-registration-status.unit-spec.ts`
- `apps/api/test/security/tenant-jwt-scope.unit-spec.ts`

Uses regex on trailing `pricingCatalogPort as never`, `{} as never`, or `undefined as never` before closing `)`.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Superseded by later iterations and dedicated `stub-registrations-tour-catalog.port.ts`; re-run would duplicate stubs.

---

### 7. `fix_test_catalog_port2.js`

**File Name & Path:** `fix_test_catalog_port2.js` (repository root)

**Code Intent & Purpose:** Second iteration; same stub object and same three test files. Uses slightly different closing-paren regex patterns (`pricingCatalogPort as never);` without newline before `)`).

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Duplicate effort in the iterative fix chain.

---

### 8. `fix_test_catalog_port3.js`

**File Name & Path:** `fix_test_catalog_port3.js` (repository root)

**Code Intent & Purpose:** Third iteration with smarter logic: skips files that already contain `getTourSnapshot`, then uses `matchAll` on every `new TypeOrmRegistrationsApplicationService(...)` expression to append the catalog port stub when missing.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Improved but still superseded; tests already updated.

---

### 9. `fix_test_catalog_port4.js`

**File Name & Path:** `fix_test_catalog_port4.js` (repository root)

**Code Intent & Purpose:** Intended follow-up with targeted replacements for `{} as never // PricingEngineService stub`, `pricingCatalogPortStub as never`, and `undefined as never` closings. **Incomplete:** defines `fixServiceInstantiations()` but never invokes it on any file path; script is a no-op if executed as-is. Inline comment references frustration that `fix_test_catalog_port_final.js` did not fix everything.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Broken/incomplete draft; no runtime effect.

---

### 10. `fix_test_catalog_port5.js`

**File Name & Path:** `fix_test_catalog_port5.js` (repository root)

**Code Intent & Purpose:** Targets `apps/api/test/registrations/payment.e2e-spec.ts` only. Appends catalog port stub after `{} as never // PricingEngineService stub` closing pattern.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Single-file variant; e2e spec already updated.

---

### 11. `fix_test_catalog_port6.js`

**File Name & Path:** `fix_test_catalog_port6.js` (repository root)

**Code Intent & Purpose:** Updates stub behavior in the three unit-spec files from no-op `applyAcceptedCounterDelta: async () => {}` to a mock that mutates a closure-scoped `tour.acceptedCount` when `tourId` matches.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Test mock refinement already reflected in source or dedicated stub module.

---

### 12. `fix_test_catalog_port_final.js`

**File Name & Path:** `fix_test_catalog_port_final.js` (repository root)

**Code Intent & Purpose:** “Final” iteration combining stub injection (same object as earlier scripts) with replacements for `PricingEngineService stub`, `pricingCatalogPortStub`, and `undefined as never` closings across the three main unit-spec files.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Labelled final but still regex-fragile; migration complete.

---

### 13. `fix_with_ts_morph.js`

**File Name & Path:** `fix_with_ts_morph.js` (repository root)

**Code Intent & Purpose:** Compiled output of `fix_with_ts_morph.ts`. Uses **ts-morph** AST traversal over `apps/api/test/**/*.ts` to find `new TypeOrmRegistrationsApplicationService(...)` expressions. If fewer than 11 arguments, pads with `{} as never` until 10, then appends the catalog port stub as argument 11. If 11 args exist but the last lacks `getTourSnapshot`, replaces it. Saves all modified files via `project.saveSync()`.

**Dependency Check:** No

**Lifecycle Verdict:** `[RETAIN_TEMPORARILY]` — Most robust codemod in the set; documents the correct AST-based approach for bulk constructor-argument injection. Useful historical reference if similar port-injection refactors recur. Prefer the TypeScript source (`fix_with_ts_morph.ts`) over this compiled artifact if retaining one file.

---

### 14. `fix_accepted_counter_delta_mock.js`

**File Name & Path:** `fix_accepted_counter_delta_mock.js` (repository root)

**Code Intent & Purpose:** Refines catalog port stub mocks in `registrations-stub-endpoints.unit-spec.ts` and `update-registration-status.unit-spec.ts`. Replaces inline `applyAcceptedCounterDelta` mock implementation so it mutates a test-scoped `tour.acceptedCount` when IDs match (guards with `typeof tour !== "undefined"`).

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Narrow test mock tweak; already applied or superseded by `stub-registrations-tour-catalog.port.ts`.

---

### 15. `fix_request_context_mock.js`

**File Name & Path:** `fix_request_context_mock.js` (repository root)

**Code Intent & Purpose:** Patches `apps/api/test/security/tenant-jwt-scope.unit-spec.ts`. Replaces bare `requestContextService as never` with an inline mock providing `getRole`, `resolveEffectiveTenantId`, `getTenantId`, `getUserId`, and `getRequestId` for JWT scope tests.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — One-off test fix; no ongoing utility.

---

### 16. `fix_idempotency.js`

**File Name & Path:** `fix_idempotency.js` (repository root)

**Code Intent & Purpose:** Despite the filename, targets `apps/api/test/security/ownership-access.unit-spec.ts` (not idempotency tests). Removes injected ledger-related constructor dependencies (`noopPaymentRefundLedgerForTests`, `paymentCaptureLedger` emit stub, `noopRegistrationPaymentPort`) from `PaymentsService` instantiations via a multiline regex, leaving `noopPaymentGatewayFactoryForTests` and `invalidateSummaryCache` stub.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Misnamed one-off; overlaps with `fix_ownership_access.js`; already applied.

---

### 17. `fix_ownership_access.js`

**File Name & Path:** `fix_ownership_access.js` (repository root)

**Code Intent & Purpose:** Sibling to `fix_idempotency.js` with a broader regex. Trims excess stub arguments between `resolverStub as never` and `stubPaymentGatewayFactoryForTests` in `ownership-access.unit-spec.ts`, removing ledger/refund/capture/port stubs from `PaymentsService` constructor calls.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Duplicate purpose with `fix_idempotency.js`; obsolete.

---

### 18. `update_payments.js`

**File Name & Path:** `update_payments.js` (repository root)

**Code Intent & Purpose:** **Destructive production-code codemod** on `apps/api/src/modules/payments/payments.service.ts`. Removes constructor injections for `PaymentRefundLedgerAuthorityService`, `PaymentCaptureLedgerAuthorityService`, and `REGISTRATION_PAYMENT_PORT`. Strips runtime calls: `lockTourRowForUpdate`, refund ledger reversal, capture-at-paid ledger emission, and `transitionRegistrationForPayment`. Appears aimed at simplifying payments during an incomplete refactor.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Dangerous if re-run against current source; would strip live payment/ledger integration. No historical utility beyond documenting a reverted/abandoned approach.

---

### 19. `update_unit_test.js`

**File Name & Path:** `update_unit_test.js` (repository root)

**Code Intent & Purpose:** Updates `apps/api/test/payments/payments.service.unit-spec.ts`. Collapses five `ledgerDeps[n]` constructor arguments to two (`ledgerDeps[2]` gateway factory, `ledgerDeps[4]` finance reports) after payments service constructor signature shrank.

**Dependency Check:** No

**Lifecycle Verdict:** `[SAFE_TO_DELETE]` — Paired with `update_payments.js`; one-off test alignment already applied.

---

## Summary Table

| # | File | Target area | Dependency wired? | Verdict |
|---|------|-------------|---------------------|---------|
| 1 | `fix_catalog_port.js` | Registrations service → catalog port | No | `[SAFE_TO_DELETE]` |
| 2 | `fix_delta.js` | Accepted-count delta port calls | No | `[SAFE_TO_DELETE]` |
| 3 | `fix_delta2.js` | Accepted-count delta (variant) | No | `[SAFE_TO_DELETE]` |
| 4 | `strip_relations.js` | Entity relation removal | No | `[SAFE_TO_DELETE]` |
| 5 | `strip_relations_2.js` | Entity import removal | No | `[SAFE_TO_DELETE]` |
| 6 | `fix_test_catalog_port.js` | Test constructor stub (v1) | No | `[SAFE_TO_DELETE]` |
| 7 | `fix_test_catalog_port2.js` | Test constructor stub (v2) | No | `[SAFE_TO_DELETE]` |
| 8 | `fix_test_catalog_port3.js` | Test constructor stub (v3, matchAll) | No | `[SAFE_TO_DELETE]` |
| 9 | `fix_test_catalog_port4.js` | Test stub (incomplete no-op) | No | `[SAFE_TO_DELETE]` |
| 10 | `fix_test_catalog_port5.js` | payment.e2e-spec stub | No | `[SAFE_TO_DELETE]` |
| 11 | `fix_test_catalog_port6.js` | Mock delta behavior | No | `[SAFE_TO_DELETE]` |
| 12 | `fix_test_catalog_port_final.js` | Test stub (“final”) | No | `[SAFE_TO_DELETE]` |
| 13 | `fix_with_ts_morph.js` | AST-based test codemod | No | `[RETAIN_TEMPORARILY]` |
| 14 | `fix_accepted_counter_delta_mock.js` | Test mock delta | No | `[SAFE_TO_DELETE]` |
| 15 | `fix_request_context_mock.js` | tenant-jwt-scope mock | No | `[SAFE_TO_DELETE]` |
| 16 | `fix_idempotency.js` | ownership-access ledger deps | No | `[SAFE_TO_DELETE]` |
| 17 | `fix_ownership_access.js` | ownership-access ledger deps | No | `[SAFE_TO_DELETE]` |
| 18 | `update_payments.js` | payments.service stripping | No | `[SAFE_TO_DELETE]` |
| 19 | `update_unit_test.js` | payments unit test args | No | `[SAFE_TO_DELETE]` |

**Totals:** 19 scripts · 18 `[SAFE_TO_DELETE]` · 1 `[RETAIN_TEMPORARILY]` · 0 wired to CI/Husky

---

## Appendix A — Root TypeScript Siblings (Out of Scope, Noted for Completeness)

These `.ts` files live at root alongside the audited `.js` scripts but were **excluded** from this report per the `.js`/`.mjs`/`.cjs` scope constraint:

| File | Notes |
|------|-------|
| `fix_with_ts_morph.ts` | Source for `fix_with_ts_morph.js`; retain if keeping one codemod reference |
| `fix_idempotency.ts` | Actually targets `registrations-idempotency.unit-spec.ts` (controller/CQRS migration) — unlike misnamed `.js` sibling |
| `update_unit_test.ts` | Targets `registrations-stub-endpoints.unit-spec.ts` write-repo migration — different from `update_unit_test.js` |

Recommend a follow-up audit or batch deletion of both `.js` and `.ts` ephemeral pairs once stakeholders confirm.

---

## Appendix B — Recommended Next Steps (Non-Destructive Until Approved)

1. **Archive then delete** the 18 `[SAFE_TO_DELETE]` scripts in a single cleanup PR (optionally move to `docs/archive/phase-XX-codemods/` first).
2. **Keep or relocate** `fix_with_ts_morph.ts` (source) under `scripts/codemods/` if the team wants a reusable ts-morph template; delete the compiled `.js` duplicate.
3. **Do not execute** any script in this inventory against the current tree without manual review — several use greedy regex and one (`update_payments.js`) removes production payment logic.

---

*End of report.*
