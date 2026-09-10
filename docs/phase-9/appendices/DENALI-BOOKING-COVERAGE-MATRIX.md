# Denali Booking Coverage Matrix

This is the test-design source of truth for the Denali booking journey. A row is
covered only when the expected state is asserted at the owning boundary; a UI
label alone is not proof of a persisted booking or financial state.

## Scope boundary

Denali v1 is intentionally `offline_receipt` only. Gateway checkout and PSP
settlement are optional platform capabilities deferred until a second customer
and are blocked by the P5-D activation guard; they are not counted as Denali
booking coverage. Gateway rows below remain a separate conditional platform
track and must not be reported as implemented merely because the ingress route
accepts a signed webhook.

## Axes

| Axis                  | Values                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Tour lifecycle        | `DRAFT`, `OPEN`, `CANCELLED`, past departure                                                                                                   |
| Payment collection    | `free`, `paid`                                                                                                                                 |
| Registration approval | `manual`, `auto`, missing (defaults to `manual`)                                                                                               |
| Member discount       | gate off, gate on/member eligible, gate on/member absent, wrong tenant                                                                         |
| Capacity              | available, exact-full, over-capacity, waitlist enabled/disabled                                                                                |
| Booking state         | `pending`, `waitlisted`, `approved`, `rejected`, `cancelled`                                                                                   |
| Payment state         | Booking projection: `unpaid`, `partial`, `paid`; finance workflow: `under_review`; free collection: `waived`; payment hold terminal: `expired` |
| Actor                 | guest, authenticated member, owner/admin, support, wrong tenant                                                                                |
| Collection path       | no payment, manual payment/receipt, gateway, refund/cancel                                                                                     |

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

| Area                                       | Evidence                                                                                                                                                                  | Boundary                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Manual/auto + free/paid registration       | `packages/workspaces/denali/test/registration-auto-approve.spec.ts` (`DN-P3-R04`), `apps/api/test/denali-registration.spec.ts` (`DREG-20-02`)                             | service + real HTTP + persistence                      |
| Approval → payment projection              | `apps/api/test/denali-registration.spec.ts` (`DREG-20-03`)                                                                                                                | real HTTP + member list + operator reload              |
| Rejection/cancellation financial safety    | `apps/api/test/denali-registration.spec.ts` (`DREG-20-04`)                                                                                                                | real HTTP + operator reload                            |
| Partial/full manual payment                | `apps/api/src/workspace-finance/finance.service.spec.ts` (`PR20-B`), `apps/api/test/finance-ops.spec.ts` (`API-9.7-03`, `API-9.7-03d`)                                    | service + HTTP + PostgreSQL persistence                |
| Booking transitions and operator actions   | `apps/api/test/tour-booking-management-http-matrix.spec.ts`, `apps/web/test/tour-booking-management-matrix.spec.ts`                                                       | API + admin logic                                      |
| Capacity release and waitlist promotion    | `apps/api/test/dp1/payment-hold-expiry.spec.ts`, `apps/api/test/dp1/payment-hold-waitlist.spec.ts`                                                                        | expiry + capacity + hold + quote                       |
| Payment hold after approval                | `apps/api/test/dp1/booking-approve-payment-hold.spec.ts`                                                                                                                  | finance domain                                         |
| Gateway activation boundary                | `apps/api/test/workspace-commerce-gateway-blocked.spec.ts`, `apps/api/test/tour-create-commerce-gateway-blocked.spec.ts`, `apps/api/test/integrations-plane-mock.spec.ts` | intentional fail-closed; no Denali callback activation |
| Member discount and quote freeze           | `packages/finance-core/test/commercial-quote-member-discount-*.spec.ts`                                                                                                   | finance-core                                           |
| Denali member discount on approve          | `apps/api/test/denali-registration.spec.ts` (`DREG-20-05`)                                                                                                                | real Denali booking + identity + quote freeze          |
| Denali member discount with auto approval  | `apps/api/test/denali-registration.spec.ts` (`DREG-20-06`)                                                                                                                | real Denali booking + auto approval + quote comparison |
| Member portal status/deadline              | `apps/portal/test/tour-booking-management-matrix.spec.ts`, `apps/portal/test/portal-payment-deadline.spec.ts`                                                             | portal logic/contract                                  |
| Portal purchase → member reservations list | `apps/portal/tests/e2e/portal-member-smoke.spec.ts` (`SMK-PTL-02`, local trace)                                                                                           | OTP + profile + Denali POST 201 + member list 200      |
| Browser operator journeys                  | `apps/web/tests/e2e/scenario*.spec.ts`                                                                                                                                    | manual/ad-hoc browser E2E                              |

The Denali dev smoke bootstrap exposes dedicated, non-production fixture tours
for browser evidence of the core pricing/approval cross-product: paid+auto,
free+manual, free+auto, and paid+auto with a member discount. These fixtures
are tenant-scoped, idempotent, and use the existing `offline_receipt`/free
collection paths; they are not gateway fixtures.

### Current browser evidence (local only)

The confidence suite was executed against a built production Next server with
the DB-backed operator smoke stack: E02 (over-capacity rejection), E03
(operator reject), and E04 (waitlist → approve) all passed in one run (3/3).
The earlier dev-server run remains non-certifying: Next dev exited cleanly
(`exit 0`) during E04 before the action request, so dev runtime stability is
tracked separately from booking behavior. This is local evidence, not staging
or production deployment proof.

The portal member smoke trace also reached the Denali purchase boundary: OTP
verification and profile completion returned 200, the Denali registration POST
returned 201, and `/me/registrations` returned 200 with the created booking.
After correcting the production SSR self-fetch origin and forwarded-host
handling, a built Production-like portal run passed the member list, member
detail, and cancellation-panel checks (API/list/detail/cancellation all 200;
the browser evidence specs passed for desktop/mobile list and detail).

The Denali operator evidence also passed the registrations workspace tab, and
the confidence suite passed E02 over-capacity rejection, E03 operator reject,
and E04 waitlist-to-approve (3/3). These are local browser runs, not staging or
production deployment proof.

The official portal smoke configuration also passed fourteen dedicated core
browser journeys against the Denali operator tenant (14/14): free/manual reached
pending with no receipt upload, free/auto reached approved with a waived
receipt state, free/auto with a member discount remained waived, an approved
free booking cancelled by the admin reached the member terminal state, an
admin-rejected free booking reached the member rejected terminal state,
free/manual approved by the admin reached the member waived state, and
paid/manual rejected by the admin reached the member rejected state before any
payment CTA,
paid/auto reached approved with an uploadable receipt and a payment due block,
paid/auto with an eligible member discount froze the 80%-price invoice, completed
receipt review, and returned to the member as paid,
an eligible member on a closed discount gate and a non-member on an open gate
both received the canonical invoice amount,
an admin from the wrong tenant received `404` for the Denali invoice,
paid/manual crossed operator approval before payment, and waitlist promotion
was visible as `waitlisted` in the member BFF before reaching approved/waived.
The paid paths exercised the offline receipt handoff to finance.

On the same local Denali tour, the member detail showed `pending` + unpaid and
the operator registrations page rendered the matching `Portal Member Smoke`
row with `در انتظار` + unpaid, alongside the other seeded member booking. This
proves cross-surface read consistency for that state only; it is not a proof of
every post-mutation state.

A focused cross-surface run then created a fresh paid/manual member booking,
approved it from the operator registrations workspace, and verified the same
member detail after reload as `تأیید شده` + unpaid with the receipt panel. A
second run rejected a fresh booking in the operator workspace and verified the
member detail as `رد شده` with the receipt panel closed.

The dedicated cross-surface confidence run passed all six Denali core
pricing/approval fixtures (6/6): paid/auto was visible as approved and unpaid,
free/auto was visible as approved with no financial-display debt,
free/manual remained pending, and the member-discounted paid/auto booking
produced a frozen invoice at 80% of the canonical amount and remained visible
in the admin reservations page. A fifth free/auto member-discount fixture
produced invoice total and balance zero and remained approved without debt.
The sixth paid/manual member-discount fixture was first observed as pending,
then approved in the admin workspace; after approval its frozen invoice was
also 80% of the canonical amount.
The free-collection projection regression was fixed and the final rerun asserted
`data-financial-display-state=WAIVED` for both free/auto rows; the focused run
passed 6/6 after restarting the API with the final source.
The complete Denali member-portal smoke then passed 20/20 after making the smoke
fixture tenant-aware (`denali` uses tour `…0220`, operator uses `…0210`) and
starting the Denali marketing egress required by the logout flow. This covers
member list/detail, approval-waiting, free/manual, free/auto, free/auto discount,
admin cancellation, admin rejection, free/manual approval, paid/manual rejection,
waitlist promotion, paid/auto, paid/auto discount, paid/manual,
wrong-tenant isolation, logout, and
entitled navigation. The paid/auto
discount case uses the seeded Denali member identity, a unique other-guest
record, verifies the frozen 80%-price invoice, submits a receipt, approves it
from the finance queue, and asserts the paid state after member reload.

PostgreSQL-backed Denali finance verification also passed: `finance-ops.spec.ts`
ran 29/29 with real Prisma storage after applying the three pending local
migrations, covering receipt approval, partial settlement, rollback,
idempotency, concurrent approval, IDOR/cross-tenant rejection, and reclaim;
`finance-invoice.spec.ts` passed 1/1 for invoice balance projection. This is
strong persistence evidence for the finance paths, but not a claim that every
booking-matrix row has been reloaded from PostgreSQL.
The production-storage booking HTTP certification then passed 16/16 against
PostgreSQL, including create/validation/capacity, approve/reject/waitlist/cancel,
bulk approve, list/summary, receipt ownership, and cross-tenant/RLS checks.
The Denali payment-hold boundary suite passed 11/11 in memory, including
approval deadline creation, expiry, idempotency, waitlist promotion, and the
payment-vs-expiry race.
The PostgreSQL dev bootstrap was then hardened to carry the Denali workspace
context into tour projection and to reconcile existing deterministic fixture
rows, not only insert missing ones. A fresh bootstrap/reload verified all six
booking-matrix tour IDs (`223`–`228`) under the Denali tenant with
`publishStatus=published`. This proves fixture publication persistence, but it
does not replace the broader matrix rows outside these six combinations.
The corrected cross-surface confidence run then passed 6/6 against that
PostgreSQL-backed Denali tenant using `admin.denali.localhost`: paid/free,
manual/auto, and member-discount approval paths agreed between member API,
admin reservations, and invoice projection. The full Denali portal smoke also
passed 20/20 against PostgreSQL, including member reservations and the
free/manual, free/auto, free/auto discount, admin cancellation, admin rejection,
waitlist promotion, paid/auto, paid/auto discount, and paid/manual state
assertions, plus the manual approval/rejection terminal states. The paid/auto deadline assertion
was executed with `PAYMENT_HOLD_ENABLED=true`, matching the Denali payment-hold
contract rather than silently accepting a missing deadline.
During a strict rerun, the member receipt-status read path exposed a real
runtime defect: concurrent tenant-RLS reads could exceed the per-tenant DB
budget and crash the API through an unhandled sibling rejection. The reads are
now serialized at the finance boundary, with a regression asserting no
fan-out; after restarting the API, the same full PostgreSQL portal run passed
20/20 without the crash.
After making the legacy capacity/reject/waitlist fixture tenant-aware, the
Denali admin browser suite passed E02–E04 3/3 on PostgreSQL: over-capacity
rejection, operator rejection to terminal state, and waitlist-to-approve. The
same suite also passed the free/auto cancellation path with a terminal status
that remained visible after an admin-page reload. A prior E03 timeout was
caused by seeding the operator tenant while viewing the Denali tenant; it is
not counted as product evidence. That harness issue is
now prevented by deriving the Denali tenant and member workspace from the
Denali admin hostname when the browser suite is run without extra environment
overrides.
The complete Denali admin confidence suite now passes 10/10 on PostgreSQL,
including the six pricing/discount projections above plus those four
capacity, rejection, waitlist, and cancellation journeys. The free/manual
journey now covers both the pending pre-approval row and the post-approval
`paid` + `WAIVED` row after a real operator UI mutation. The companion
member smoke remains 20/20 on PostgreSQL after making each rerun identity unique
by phone-derived national ID and display-name suffix; the discounted auto-payment
case separates the seeded member authentication phone from the unique guest phone.
The paid/auto and paid/manual member journeys now submit a real PNG through the
portal receipt form, receive HTTP 201, render the pending-review state, and
retain that state after reload. Each test then opens a separate operator
context, filters the finance queue by the exact `registrationId`, approves that
receipt, and reloads the member detail to assert
`data-portal-member-receipt-paid`. This closes the single-registration browser
proof for both auto-approval and manual-approval paid paths in the Denali
offline-receipt handoff. Finance PostgreSQL evidence separately covers
partial-to-full
settlement, idempotency, rollback, concurrency, and authorization (29/29).
The paid/auto cross-surface test also reloads the operator `/bookings` page after
finance approval and asserts the same registration's payment badge is `paid`,
closing the member-versus-admin projection boundary that previously could show
conflicting payment states.
For the free/manual case, the raw booking
`paymentStatus=unpaid` is retained while no `financialDisplayState` or payment
CTA is projected; this is the intentional pre-approval no-obligation contract,
not an outstanding debt. The supporting Denali HTTP registration suite passed
18/18 and the admin booking-management matrix passed 3/3 HTTP cases plus 6/6
admin-surface logic cases in the same verification cycle.
The PostgreSQL overlay rerun also passed 7/7: the concurrent guest-duplicate
race yielded exactly one `201` and one `409`, member-discount quote metadata
survived repository reload and tenant-isolation checks, payment won the
expiry race when the balance reached zero, expiry won when balance remained,
and expiry promoted exactly one waitlisted guest with a new hold and quote.
The focused deadline rerun passed 9/9 on PostgreSQL (shared `paymentDueAt`,
deadline extension, expiry, payment-vs-expiry winner, and waitlist promotion),
and the portal deadline contract passed 5/5, including the client-side
deadline watcher that re-reads the BFF state before reloading the member detail.
The discount persistence overlay also passed 3/3 for quote creation, metadata
reload, and tenant isolation.
The final built rerun also exposed and fixed a missing `paymentDueLabel` key in
both portal locale bundles; without that key, the paid member detail emitted a
server-rendering `MISSING_MESSAGE` error even though the booking API state was
valid.
The final rebuilt Portal smoke passed 20/20 on PostgreSQL. Its external-server
harness now separates `SMOKE_PORTAL_BASE_URL` (warmup ingress) from
`PORTAL_INTERNAL_URL` (server self-fetch), and reuses an operator session only
within the same host; this prevents protocol/tenant-resolution false negatives
without weakening wrong-tenant coverage or the production OTP rate limit.
The finance-core discount matrix passed 25/25 across domain, flow, end-to-end,
and persistence suites, including gate-off, missing membership, wrong-tenant,
free-collection override, quote freeze, and tenant-isolated reload behavior.
The admin booking-management matrix covers every booking-list payment projection
(`unpaid`, `partial`, `paid`) across every lifecycle status and separately maps
`WAIVED`; `under_review` is owned by the finance receipt queue, while `expired`
is owned by the payment-hold terminal state. They must not be added as fake
booking-list payment statuses.
The combined admin booking-management and finance follow-up state run passed
24/24; it covers lifecycle action availability, capacity/waitlist/cancel
permutations, role denial, localized list/timeline payment labels, partial and
settled balances, receipt review, overdue holds, and zero-balance waiver state.
The focused Denali workspace policy/domain/finance run passed 67/67, covering
booking lifecycle and exit paths, capacity and waitlist decisions, free/paid
obligations, manual/auto approval, discount-gate resolution, payment mode and
deadline rules, and the Denali finance journey.
The complete Denali workspace suite then passed 790/790 tests across 197
suites; this is supporting package-level evidence for wizard, catalog,
transport, location, equipment, publish, mutation-policy, booking, and finance
contracts, but is not substituted for runtime browser or PostgreSQL evidence.

## Not yet proven by this matrix

- All B-01..B-08 core outcomes now have real member browser → API → admin browser
  evidence at the applicable boundary, including free/manual approval and
  paid/manual rejection; free rows intentionally stop before finance, while paid
  rows exercise the offline receipt handoff where payment is applicable.
- Discount cross-product combined with every approval and payment state is not
  represented by a separate browser fixture for every cell; its gate-off,
  eligible-member, non-member, wrong-tenant, free-collection, and quote-freeze
  rules are covered by the core/API/persistence suites and the applicable
  Denali browser journeys.
- Browser-level deadline race against payment, cancellation, and waitlist promotion;
  the member watcher now has a direct browser reload assertion, and the domain
  race and waitlist overlay are proven, but the combined member/admin browser
  race for every terminal winner is not yet executed.
- PostgreSQL persistence/reload for every row and every discount cross-product;
  the quote metadata and tenant-isolation persistence overlay is proven, but
  not every booking row has a dedicated database reload assertion.

The release claim is complete only when every required row has an executed test
at the relevant boundary and the three surfaces agree after reload.
