# Denali Booking Coverage Matrix

This is the test-design source of truth for the Denali booking journey. A row is
covered only when the expected state is asserted at the owning boundary; a UI
label alone is not proof of a persisted booking or financial state.

## Axes

| Axis                  | Values                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| Tour lifecycle        | `DRAFT`, `OPEN`, `CANCELLED`, past departure                           |
| Payment collection    | `free`, `paid`                                                         |
| Registration approval | `manual`, `auto`, missing (defaults to `manual`)                       |
| Member discount       | gate off, gate on/member eligible, gate on/member absent, wrong tenant |
| Capacity              | available, exact-full, over-capacity, waitlist enabled/disabled        |
| Booking state         | `pending`, `waitlisted`, `approved`, `rejected`, `cancelled`           |
| Payment state         | `unpaid`, `partial`, `paid`, `under_review`, `waived`, expired         |
| Actor                 | guest, authenticated member, owner/admin, support, wrong tenant        |
| Collection path       | no payment, manual payment/receipt, gateway, refund/cancel             |

## Required journey outcomes

Each applicable combination must verify all of these outputs:

1. HTTP status and stable error code.
2. Persisted booking status and tenant/tour ownership.
3. Persisted payment/quote state and payable amount.
4. Capacity reservation or waitlist effect.
5. Allowed and forbidden operator actions.
6. Member-facing status, amount, deadline, and CTA.
7. Operator-facing status, finance state, and CTA.
8. Refresh/reload consistency and idempotent retry behavior.

## Core acceptance matrix

| ID   | Collection | Approval         | Expected registration | Expected finance                                 |
| ---- | ---------- | ---------------- | --------------------- | ------------------------------------------------ |
| B-01 | free       | manual           | `pending`             | zero obligation; no payment CTA after approval   |
| B-02 | free       | auto             | `approved`            | zero obligation; no payment CTA                  |
| B-03 | paid       | manual           | `pending`             | no approval-derived payment state until approval |
| B-04 | paid       | auto             | `approved`            | payable obligation and deadline                  |
| B-05 | paid       | manual → approve | `approved`            | `unpaid`/payment required                        |
| B-06 | paid       | manual → reject  | `rejected`            | no actionable payment                            |
| B-07 | paid       | auto → pay       | `approved`            | `partial` then `paid`                            |
| B-08 | free       | auto → cancel    | `cancelled`           | no financial debt or payment CTA                 |

## Discount cross-product

For B-01 through B-07, repeat the applicable rows with:

- discount gate off + eligible member: canonical price, no discount;
- discount gate on + eligible active member: frozen member-discount quote;
- discount gate on + non-member: canonical price, no discount;
- discount gate on + member from another tenant: canonical price, no discount;
- free collection + eligible member: zero payable, discount metadata must not create debt.

## Capacity and concurrency overlay

For each applicable registration row, exercise:

- available capacity;
- exact last seat;
- simultaneous last-seat requests;
- full capacity with waitlist disabled;
- full capacity with waitlist enabled;
- cancellation/expiry releasing a seat;
- one and only one waitlist promotion after a released seat.

## Current evidence map

| Area                                     | Evidence                                                                                                            | Boundary                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Manual/auto + free/paid registration     | `packages/workspaces/denali/test/registration-auto-approve.spec.ts` (`DN-P3-R04`)                                   | service + obligation resolver |
| Booking transitions and operator actions | `apps/api/test/tour-booking-management-http-matrix.spec.ts`, `apps/web/test/tour-booking-management-matrix.spec.ts` | API + admin logic             |
| Payment hold after approval              | `apps/api/test/dp1/booking-approve-payment-hold.spec.ts`                                                            | finance domain                |
| Member discount and quote freeze         | `packages/finance-core/test/commercial-quote-member-discount-*.spec.ts`                                             | finance-core                  |
| Member portal status/deadline            | `apps/portal/test/tour-booking-management-matrix.spec.ts`, `apps/portal/test/portal-payment-deadline.spec.ts`       | portal logic/contract         |
| Browser operator journeys                | `apps/web/tests/e2e/scenario*.spec.ts`                                                                              | manual/ad-hoc browser E2E     |

## Not yet proven by this matrix

- All B-01..B-08 rows through real member browser → API → admin browser → finance.
- Discount cross-product combined with every approval and payment state.
- Free registration persisted through the real HTTP path with operator reload.
- Gateway success/failure callback behavior for Denali production policy.
- Deadline race against payment, cancellation, and waitlist promotion.
- PostgreSQL persistence/reload for every row; skipped tests are not passing evidence.

The release claim is complete only when every required row has an executed test
at the relevant boundary and the three surfaces agree after reload.
