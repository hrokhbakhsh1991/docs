# DP-1 Test-First Coverage Manifest

```yaml
manifest_id: DP1-TEST-COVERAGE-2026-08-24
authority: docs/dev/dp-1-execution-plan.md
mode: TESTS_ONLY — no production implementation
runner: pnpm run test:dp1-payment-deadline
```

## Verdict

**DP-1 TEST FLOOR READY**

All in-scope scenarios have automated specs. Failures are **EXPECTED_FAIL** (missing DP-1 implementation) except where noted.

---

## Tests added

| Layer | File |
|-------|------|
| **Harness** | `apps/api/test/dp1/dp1-test-harness.ts` |
| **DOMAIN — policy** | `packages/workspaces/denali/test/resolve-denali-payment-deadline-hours.spec.ts` |
| **DOMAIN — capacity** | `packages/workspaces/denali/test/dp1-catalog-capacity-after-expiry.spec.ts` |
| **DOMAIN — occupancy** | `packages/tour-core/test/dp1-approved-unpaid-occupancy.spec.ts` |
| **DOMAIN — quote freeze** | `packages/finance-core/test/commercial-quote-freeze-on-approve.spec.ts` |
| **DOMAIN — hold repo** | `packages/finance-core/test/payment-hold-repository.contract.spec.ts` |
| **INTEGRATION — approve** | `apps/api/test/dp1/booking-approve-payment-hold.spec.ts` |
| **INTEGRATION — expiry** | `apps/api/test/dp1/payment-hold-expiry.spec.ts` |
| **INTEGRATION — financial** | `apps/api/test/dp1/payment-hold-financial.spec.ts` |
| **INTEGRATION — extend** | `apps/api/test/dp1/payment-hold-extend.spec.ts` |
| **INTEGRATION — scheduler** | `apps/api/test/dp1/payment-hold-scheduler.spec.ts` |
| **INTEGRATION — migration** | `apps/api/test/dp1/payment-hold-migration.grandfather.spec.ts` |
| **INTEGRATION — waitlist** | `apps/api/test/dp1/payment-hold-waitlist.spec.ts` |
| **CONCURRENCY — race** | `apps/api/test/dp1/payment-hold-expiry-race.spec.ts` |
| **CONCURRENCY — idempotency** | `apps/api/test/dp1/payment-hold-expiry-idempotency.spec.ts` |
| **API CONTRACT** | `apps/api/test/dp1/payment-hold-api-contract.spec.ts` |
| **PORTAL CONTRACT** | `apps/portal/test/portal-payment-deadline.spec.ts` |
| **OPERATOR CONTRACT** | `apps/web/test/bookings-payment-deadline.spec.ts` |
| **Bundle / map** | `apps/api/test/dp1/payment-hold.integration.spec.ts` |
| **Runner** | `scripts/test-dp1-payment-deadline.sh`, `package.json#test:dp1-payment-deadline` |

---

## Scenario coverage

| Scenario | Spec(s) | Status |
|----------|---------|--------|
| S1 | booking-approve-payment-hold, api-contract, portal, web | EXPECTED_FAIL |
| S2 | payment-hold-financial | EXPECTED_FAIL |
| S3 / S3b | payment-hold-expiry-race | EXPECTED_FAIL |
| S4 | payment-hold-expiry, portal | EXPECTED_FAIL |
| S5 | payment-hold-expiry, dp1-catalog-capacity, tour-core occupancy | PARTIAL PASS (occupancy/catalog math only) |
| S6 | payment-hold-waitlist | EXPECTED_FAIL |
| S7 | payment-hold-expiry | EXPECTED_FAIL |
| S8 | payment-hold-expiry-race | EXPECTED_FAIL |
| S9 | payment-hold-expiry-idempotency | EXPECTED_FAIL |
| S10 / S10b | payment-hold-financial | EXPECTED_FAIL |
| S11 | payment-hold-extend, api-contract, web | EXPECTED_FAIL |
| S12 | — | OUT OF SCOPE (DP-4) |
| S13 | payment-hold-expiry | EXPECTED_FAIL |
| S14 | commercial-quote-freeze, payment-hold-extend | EXPECTED_FAIL |
| S15 | portal-payment-deadline | EXPECTED_FAIL |
| S16 | portal-payment-deadline | EXPECTED_FAIL |
| S17 | payment-hold-api-contract, portal, web | EXPECTED_FAIL |
| S18 | payment-hold-scheduler | EXPECTED_FAIL |
| S19 | payment-hold-scheduler | EXPECTED_FAIL |
| S20 | payment-hold-expiry-idempotency | EXPECTED_FAIL |

---

## Expected failures

### DOMAIN

- `resolve-denali-payment-deadline-hours.ts` — module missing (6 tests)
- `CommercialQuoteService.ensureFrozenOnApprove` — method missing (4 tests)
- `in-memory-payment-hold.repository.ts` — module missing (6 tests)

### INTEGRATION / API

- `PaymentHoldService` / `payment-hold.service.ts` — not implemented (all hold-dependent tests)
- `commercial-quote-approve.service.ts` — not implemented
- `payment-hold-expiry.ts` — not implemented
- `payment-hold-expiry-race.ts` — not implemented
- `start-payment-hold-expiry-scheduler.ts` — not implemented
- `payment-hold-extend.ts` — not implemented
- `payment-hold-migration.fixture.ts` — not implemented
- `payment-hold-http.routes.ts` — not implemented
- `ApproveBookingResponse.paymentDueAt` / `holdStatus` — fields missing

### CONTRACT

- Portal: `paymentDueAt`, `data-portal-member-payment-due-at`, `payment_expired`, `format-payment-due-at.ts`
- Operator: `paymentDueAt` column, `cancelSource`, `booking-payment-deadline-actions.ts`

### PASS (baseline / no DP-1 code required)

- `packages/tour-core/test/dp1-approved-unpaid-occupancy.spec.ts` — 2/2
- `packages/workspaces/denali/test/dp1-catalog-capacity-after-expiry.spec.ts` — 1/1

---

## Unexpected regressions

**None** after waitlist capacity setup fix (S6/S20 create pending guests before approve fills capacity).

---

## Coverage gaps

| Gap | Reason |
|-----|--------|
| S12 member self-cancel | DEN-PROD-09 not approved — deferred DP-4 |
| Playwright E2E (DP1-L) | Browser cert DP1-M — separate increment after API green |
| Postgres advisory-lock proofs | Memory-first; reuse `booking-prisma-approve-concurrency` in implementation PR |
| Notification delivery | DEN-PROD-12 deferred DP-4; events only in DP-1 |

---

## Run

```bash
pnpm run test:dp1-payment-deadline
```

Script exits `0` while layers fail (test floor ready). Individual specs fail until implementation lands.
