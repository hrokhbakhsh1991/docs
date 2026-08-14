# Denali Booking Payment Vocabulary — PR21-H1

```yaml
doc_id: DENALI_FINANCE_BOOKING_PAYMENT_VOCAB_PR21_H1
version: "2026-08-09-v2"
status: READY_FOR_REVIEW
phase: PR21-H1
continues:
  - DENALI Finance Cross-Surface Audit PR21-H0 (H0-01, H0-02)
locks:
  - booking.paymentStatus remains booking settlement SoT (no API/DB change)
  - payment row status remains payment-scoped (finance.payments.status.*)
  - No N+1 / redesign / new workflows
  - Do not start H2 until H1 review
scope: apps/web bookings i18n + label field wording for inbox/inspection/timeline/filters
```

## 1. UX audit — before / after

### Before

| Surface | Key | FA (before) | Problem |
| ------- | --- | ----------- | ------- |
| Inbox + inspection badge | `payment.partial` | جزئی | Too short; not booking-scoped |
| Timeline | `timeline.paymentValue.partial` | پرداخت جزئی | Same status, different words (H0-02) |
| Badge paid | `payment.paid` | پرداخت‌شده | Collides with payment-row «ثبت‌شده» / sounds settled |
| Field label | `fields.payment` / `timeline.payment` | پرداخت / وضعیت پرداخت | Reads as payment instrument |

**H0-01:** Inbox and inspection shared `payment.*`, but short «جزئی» / bare «پرداخت‌شده» collided with Finance payment-row vocabulary.

**H0-02:** `payment.partial` ≠ `timeline.paymentValue.partial`.

### After

| Surface | Key | FA (after) | EN (after) |
| ------- | --- | ---------- | ---------- |
| Inbox / inspection / filters | `payment.*` | … (رزرو) | … (booking) |
| Timeline values | `timeline.paymentValue.*` | **aligned** to `payment.*` | **aligned** |
| Field labels | `fields.payment`, `timeline.payment` | تسویه رزرو | Booking settlement |
| Payment rows (unchanged) | `finance.payments.status.*` | ثبت‌شده (این پرداخت) / در انتظار (این پرداخت) | Recorded (this payment) / … |

Rule preserved: recorded payment ≠ booking settled. Booking badge uses `booking.paymentStatus`; strip rows stay payment-scoped.

## 2. Exact files changed (H1)

| File | Change |
| ---- | ------ |
| `docs/phase-20/p7/appendices/DENALI_FINANCE_BOOKING_PAYMENT_VOCAB_PR21_H1.md` | This pack |
| `apps/web/messages/fa/bookings.json` | Settlement labels + field wording |
| `apps/web/messages/en/bookings.json` | Settlement labels + field wording |
| `apps/web/src/features/bookings/bookings-command-center-types.ts` | `paymentBadgeInbox` / `paymentBadgeInspection` |
| `apps/web/src/features/bookings/booking-inbox-row.tsx` | Stable test ids + `data-payment-status` |
| `apps/web/src/features/bookings/booking-inspection-details.tsx` | Stable test ids + `data-payment-status` |
| `apps/web/test/bookings-payment-vocab-pr21h1.spec.ts` | H0-01/H0-02 + safety |

No API, DB, finance-core, SoT, or state-machine edits in H1 scope.

## 3. Vocabulary mapping

| Concept | Source of truth | i18n key | FA | EN |
| ------- | --------------- | -------- | -- | -- |
| Booking unpaid | `booking.paymentStatus=unpaid` | `bookings.payment.unpaid` (= `timeline.paymentValue.unpaid`) | پرداخت‌نشده (رزرو) | Unpaid (booking) |
| Booking partial | `booking.paymentStatus=partial` | `bookings.payment.partial` (= `timeline.paymentValue.partial`) | پرداخت جزئی (رزرو) | Partially paid (booking) |
| Booking paid | `booking.paymentStatus=paid` | `bookings.payment.paid` (= `timeline.paymentValue.paid`) | پرداخت‌شده (رزرو) | Paid (booking) |
| Filter “all” | UI filter | `bookings.payment.all` | همه وضعیت‌های تسویه | All settlement states |
| Field label | UI | `fields.payment` / `timeline.payment` | تسویه رزرو | Booking settlement |
| Payment row Paid | payment.status | `finance.payments.status.Paid` | ثبت‌شده (این پرداخت) | *(payment-scoped; unchanged)* |
| Payment row Pending | payment.status | `finance.payments.status.Pending` | در انتظار (این پرداخت) | *(payment-scoped; unchanged)* |

## 4. Safety verification

| Check | Result |
| ----- | ------ |
| No new data fetching | Pass — i18n + test ids only |
| No FinanceService / finance-core in badge modules | Pass (spec) |
| Payment-row labels unchanged | Pass — `finance.payments.status.*` untouched |
| Never imply recorded == settled | Pass — strip hint still: «ثبت‌شدن پرداخت به‌معنای تسویه کامل رزرو نیست» |
| `booking.paymentStatus` still drives badges | Pass — `t(\`payment.${paymentStatus}\`)` |

## 5. Tests

```text
node --import tsx --test \
  test/bookings-payment-vocab-pr21h1.spec.ts \
  test/bookings-debt-closure.spec.ts \
  test/finance-booking-strip-pr21f.spec.ts \
  test/finance-payments-panel-pr21e.spec.ts
→ 24/24 pass
```

## 6. Live FA scenarios (denali.admin.localhost)

| ID | Fixture | Inbox badge | Inspection badge | Strip / rows |
| -- | ------- | ----------- | ---------------- | ------------ |
| **A** | `3cc22ba7…` partial + Paid+Pending payments | پرداخت جزئی (رزرو) | پرداخت جزئی (رزرو) | ثبت‌شده (این پرداخت) + در انتظار (این پرداخت); settlement hint distinguishes |
| **B** | `d6794466…` paid | پرداخت‌شده (رزرو) | پرداخت‌شده (رزرو) | «رزرو کاملاً پرداخت شده است.» |
| **C** | `f194dcdc…` unpaid + Pending payment | پرداخت‌نشده (رزرو) | پرداخت‌نشده (رزرو) | در انتظار (این پرداخت); booking still unpaid |
| **D** | `00000000…0520` multi payments, partial | پرداخت جزئی (رزرو) | پرداخت جزئی (رزرو) | payment-scoped row statuses; booking stays partial |
| **E** | inbox → inspection | پرداخت جزئی (رزرو) | پرداخت جزئی (رزرو) | **match: true** |

Bare «جزئی» filter label removed. Field label «تسویه رزرو» on inspection header + timeline.

## Out of scope (H2+)

H0-03…H0-07 remain for later slices. Do not start H2 until H1 review.
