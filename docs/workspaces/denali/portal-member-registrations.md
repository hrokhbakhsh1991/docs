# Denali portal member registrations — workspace delta

```yaml
doc_id: DENALI-PORTAL-MEMBER-REGISTRATIONS
version: "2026-08-18-v10"
extends: platform-portal-member.mdoc
workspace: denali
apps: [portal]
phase: P6-3
authority: platform-portal-member.mdoc · portal-registration-ui.md · registration-payment-orchestration.mdoc · registration-self-other-uniqueness.mdoc
```

## Scope

**Platform shell (workspace-agnostic):** [platform-portal-member.mdoc](../../phase-19/platform-portal-member.mdoc) — session, BFF routes, receipt upload chain.

**Orchestration:** [registration-payment-orchestration.mdoc](./registration-payment-orchestration.mdoc) — Denali default `approve_then_offline_pay` (club approve → then offline receipt).

**This doc:** Denali portal skin for `/me/registrations` list + detail + receipt upload. Business rules stay in API bookings/finance; portal **must not** static-import `@app-cloud/workspace-denali`.

### Mine list default (active only)

`GET /api/me/registrations` → `GET /bookings?view=mine` returns **active** member rows by default: statuses ∈ `{pending, waitlisted, approved}`. Terminal `cancelled` / `rejected` are omitted unless the client explicitly passes `status` / `statuses`. Prevents cancelled probe/history rows from drowning the trips list after reclassify or abandoned attempts.

### Registrant-target filter (self vs other)

List SSR reads optional query `?target=` (URL SoT — bookmarkable, no client-only state):

| `target` | Meaning |
| -------- | ------- |
| omitted / `all` | Every active mine row (`self` + `other`) |
| `self` | Only registrations where `registrantTarget !== "other"` (includes missing/null → self) |
| `other` | Only guest registrations (`registrantTarget === "other"`) |

**Filter is presentation-only** on the already-fetched mine list. Upstream `GET /bookings?view=mine` still returns both targets; portal does **not** add a booking query param for target (keeps BFF one-shot and avoids ops/list contract churn).

UI:

```text
nav[data-portal-member-registrations-filter][data-active-target]
  a[data-portal-member-registrations-filter-tab][data-target=all|self|other][aria-current=page when active]
    label + count[data-portal-member-registrations-filter-count]
```

Empty copy is **filter-aware**:

- No rows at all → existing `empty` + browse-tours CTA
- Rows exist but active tab filters to zero → `emptyFiltered` (no browse CTA; stay on list with other tabs)

Each row keeps `data-portal-member-registrant-target` and shows a badge:

- `other` → `forOtherBadge` (+ guest label when present)
- `self` → `forSelfBadge` (makes “mine vs guest” obvious when tab is **all**)

---

## Route → component tree

```text
app/me/layout.tsx
  └── app/me/registrations/page.tsx  (?target=all|self|other)
        GET /api/me/registrations (SSR via fetchMemberRegistrations — includes tourId)
        main[data-portal-member-registrations][data-registrant-filter]
          nav[data-portal-member-registrations-filter]
          ul → li[data-portal-member-registration-row][data-portal-member-registrant-target] → link

  └── app/me/registrations/[id]/page.tsx
        SSR: GET /api/me/registrations/[id] (owned detail — not list scan)
             GET /api/me/registrations/[id]/receipt → receiptStatus
        main[data-portal-member-registration-detail]
          MemberReceiptPanel (client) — gated by booking.status + receiptStatus
```

**Deep-link invariant:** Register-page CTA `/me/registrations/{id}` must resolve via owned GET.
Scanning `GET /api/me/registrations` (mine list) alone is insufficient — empty/failed list previously
mapped to Next `notFound()` (404) even when the booking existed (for-tour / DB).

### HTTP service modules (portal registration reads + amend)

| Module | Route responsibility |
| ------ | -------------------- |
| `registration-for-tour.service.ts` | `GET …/for-tour` — active self row gate before register |
| `registration-get.service.ts` | `GET …/{id}` — owned detail + optional due breakdown |
| `registration-amend.service.ts` | `PATCH …/{id}/intake` — transport-only amend while pending/waitlisted |

Wired from `product.routes.ts`. Tests: `packages/workspaces/denali/test/registration-read-services.spec.ts`.

---

## Member panel stages (2026-08-18 — remaining + waive + preview)

Detail `/me/registrations/{id}` is the **only** member money surface. It combines **booking.status** with Finance **invoice remaining** (not booking `paymentStatus` ratchet, not “any Paid payment”).

`GET /bookings/{id}/receipts` (portal BFF `GET /api/me/registrations/{id}/receipt`) returns:

| Field | Meaning |
| ----- | ------- |
| `status` | `none` \| `pending` \| `rejected` \| `paid` \| `waived` |
| `remainingMinor` | Invoice `balanceDueMinor` — amount still to transfer |
| `obligationMinor` | Resolved obligation (override wins over tour list price) |
| `paidMinor` | Already captured |
| `currency` | ISO currency |
| `previewUrl` / `previewKind` | Signed (or fallback) proof for the **latest** receipt; `image` \| `pdf` \| `unknown` |

**Money SoT:** if `remainingMinor > 0`, status is **never** `paid` or `waived`. Latest receipt then decides `pending` / `rejected` / `none` (Approved-but-remaining → `none`, upload the rest).

**Settled (`remainingMinor` is 0):** `waived` when collection is `free` or resolved obligation is zero (ops override / club guest — **no** “receipt confirmed” copy). Otherwise `paid` (money actually captured).

Do **not** set portal `initialStatus` from `row.paymentStatus === "paid"`.

| Condition | UI |
| --------- | -- |
| `status` = `pending` | Awaiting club approval (`data-portal-member-receipt-awaiting-approval`); optional intake amend |
| `status` = `waitlisted` | Same awaiting card; KPI says waitlisted |
| `status` = `rejected` | Closed — club rejected (`data-portal-member-receipt-closed` `data-closed-reason=rejected`) |
| `status` = `cancelled` | Closed — cancelled (`data-portal-member-receipt-closed` `data-closed-reason=cancelled`) |
| approved ∧ receipt `waived` | No-pay panel (`data-portal-member-receipt-waived`) — «نیازی به پرداخت نیست» |
| approved ∧ receipt `paid` | Payment confirmed (`data-portal-member-receipt-paid`) — only when remaining is 0 |
| approved ∧ receipt `pending` | Waiting + **proof preview** + remaining due |
| approved ∧ receipt `rejected` | Upload + retry hint + remaining due + last-proof preview |
| approved ∧ receipt `none` ∧ remaining > 0 | Upload + remaining due (partial leftover uses remaining, not catalog list price) |
| approved ∧ remaining = 0 ∧ waived/paid | settled panels above |

Due block (`data-portal-member-receipt-due`): headline is **remaining**, not catalog `obligationMinor`. Optional `data-portal-member-receipt-due-paid` when `paidMinor > 0`. Catalog `dueLines` (trip/dong/transport) only when remaining equals unresolved list-price obligation (first unpaid slip).

**Receipt preview:** file input shows a client object-URL preview **before** POST. After POST, waiting panel keeps that blob and/or `previewUrl` from GET (`data-portal-member-receipt-preview`). Image → `<img>`; PDF → `<iframe>` / object. Member stays on this URL (no redirect).

**Intake amend** (pending/waitlisted): hydrate from saved `transportKind` + `personalCarOccupants` — never default radios to club-transport / occupants `1` when intake already stored `personal_car`. KPI `[data-portal-member-registration-transport]` shows the same choice.

Server gate: `POST` member receipt still fails with `FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING` when booking is not `approved`. `FINANCE_RECEIPT_NOT_REQUIRED` when remaining is already 0 (paid or waived).

**Auto-approve tours (phase 3 / 3.1):** Operator wizard checkbox `requiresManualAdminApproval` off → resolver `auto` (also writes `pricing.registrationApproval: auto` on persist). Capacity OK → create returns `approved` → upload/waived/paid from remaining. Checkbox on, or both fields missing → `pending` until club approve. Capacity fail stays `pending`. Authority: [registration-payment-orchestration.mdoc](./registration-payment-orchestration.mdoc) Phase 3.

**Free collection (phase 4):** `pricing.paymentCollection: free` → remaining 0 → **waived** panel (not paid/receipt copy).

**Obligation override (phase 5):** `PUT /finance/registrations/:id/obligation-override`. Zero on an approved booking → waived. Non-zero remaining uses the override amount, not the catalog list price.

After upload, member **stays** on `/me/registrations/{id}` (no auto-redirect).

CTAs on waiting / paid / awaiting-approval / closed:

| CTA | Target |
| --- | ------ |
| Back to trips | `resolveMemberPortalTripsListPath` |
| View tour | marketing `resolveMarketingTourDetailUrl(host, tourId)` |

`tourId` is forwarded from API `BookingListItem` through portal list/detail BFF.

---

## `data-*` hooks (E2E)

Stable selectors — **do not rename** without updating smoke specs.

| Hook | Location |
| ---- | -------- |
| `data-portal-member-registrations` | List page root (`main`); also `data-registrant-filter={all\|self\|other}` |
| `data-portal-member-registrations-filter` | Target filter nav; `data-active-target` mirrors query |
| `data-portal-member-registrations-filter-tab` | Tab link; `data-target` + `aria-current="page"` when active |
| `data-portal-member-registrations-filter-label` | Tab visible label |
| `data-portal-member-registrations-filter-count` | Per-tab active count |
| `data-portal-member-registrations-empty-state` | Empty shell; `data-empty-reason="filtered"` when tab has zero rows but mine list is non-empty |
| `data-portal-member-registration-row` | Each list item |
| `data-portal-member-registrant-target` | `self` \| `other` on each row |
| `data-portal-member-registrant-self-badge` | Self badge copy |
| `data-portal-member-registrant-other-badge` | Other badge copy |
| `data-portal-member-registration-detail` | Detail page root (`main`) |
| `data-portal-member-receipt-awaiting-approval` | Club approval pending / waitlisted |
| `data-portal-member-receipt-closed` | rejected / cancelled — no upload (`data-closed-reason`) |
| `data-portal-member-receipt-waived` | Free / zero override — no transfer |
| `data-portal-member-receipt-preview` | Member proof preview (img / pdf) |
| `data-portal-member-receipt-upload` | Receipt form shell (only when approved) |
| `data-portal-member-receipt-submit` | Upload button |
| `data-portal-member-receipt-success` | Brief post-POST flash (optional) |
| `data-portal-member-receipt-error` | Error alert |
| `data-portal-member-receipt-waiting` | Waiting-for-finance-admin panel |
| `data-portal-member-receipt-paid` | Payment confirmed panel |
| `data-portal-member-receipt-view-tour` | Marketing tour CTA |
| `data-portal-member-receipt-back-trips` | Trips list CTA |
| `data-portal-member-intake-amend` | Pending/waitlisted transport amend panel (feature `memberPendingIntakeAmend`) |
| `data-portal-member-registration-transport` | Detail KPI — current saved `transportKind` (BUG-18) |
| `data-portal-member-intake-amend-saved` | Amend success status |
| `data-portal-member-intake-amend-error` | Amend error alert |

Existing smokes: **SMK-PTL-02** (list) · **SMK-PTL-04** (receipt → waiting panel; requires approved booking) · **SMK-PTL-05** (home redirect) · **SMK-PTL-06** (logout).

---

## Styling

| Rule | Detail |
| ---- | ------ |
| Scope | `body[data-app-surface="portal"][data-workspace-plugin="denali"]` |
| Skin file | `packages/workspaces/denali/theme/denali-portal.css` |
| List | `main[data-portal-member-registrations]` — card rows, tour title links, status badge (PS-M2 · 2026-07-12) |
| Detail | `main[data-portal-member-registration-detail]` — metadata + receipt panel |
| Receipt | `[data-portal-member-receipt-upload]` — file input + primary submit |
| Awaiting / closed | `[data-portal-member-receipt-awaiting-approval]` · `[data-portal-member-receipt-closed]` |
| Waiting / paid / waived | `[data-portal-member-receipt-waiting]` · `[data-portal-member-receipt-paid]` · `[data-portal-member-receipt-waived]` |
| Preview | `[data-portal-member-receipt-preview]` |
| Status badge | `[data-portal-member-registration-status-badge][data-status]` — `approved` · `pending` · `waitlisted` · `rejected` · `cancelled` |
| Row meta | `[data-portal-member-registration-meta]` — payment + departure |
| Empty state | `[data-portal-member-registrations-empty-state]` — message + CTA (PS-M2 · 2026-07-12) |
| Empty CTA | `[data-portal-member-registrations-empty-cta]` — egress to marketing `/tours` via `resolveMarketingToursUrl` |
| Target filter | `[data-portal-member-registrations-filter]` · `[data-portal-member-registrations-filter-tab][data-target]` — Denali primary underline/pill for `aria-current` |

Design SoT: `design-system/denali-club/MASTER.md` (primary `#059669`).

---

## Verification

| ID | Assert |
| -- | ------ |
| DEN-REG-01 | List page renders `data-portal-member-registrations` with Denali skin |
| DEN-REG-02 | Detail renders upload hooks only when `status=approved`, remaining > 0, and receipt `none`/`rejected` |
| DEN-REG-03 | Receipt submit disabled while upload in flight |
| DEN-REG-05 | `status=pending` shows `data-portal-member-receipt-awaiting-approval`; no upload control |
| DEN-REG-08 | Amend radios initialize from owned-detail `transportKind` / `personalCarOccupants` (not tour-mode defaults). Reload after PATCH keeps the saved kind. No `registrationIntake` blob on the member BFF item. |
| DEN-REG-06 | List filter tabs render with counts; `?target=other` shows only `data-portal-member-registrant-target="other"` rows |
| DEN-REG-07 | Self rows show `data-portal-member-registrant-self-badge`; other rows keep `forOtherBadge` |

### Detail chrome

`data-portal-member-back` label is **only** `portalMember.detail.backToList` (includes one leading `←` in fa/en). Do not also render a hardcoded `←` in JSX — that doubles the chevron.

Specs: `apps/portal/test/portal-member-registrations.spec.ts` (**MEM-BFF-03/04** · **MEM-SKIN-01**) · `apps/portal/tests/e2e/portal-member-smoke.spec.ts` (**SMK-PTL-02/04**) · `apps/api/test/denali-catalog.spec.ts` (**DCAT-07** · tour `…212` flags).

---

## References

- [registration-payment-orchestration.mdoc](./registration-payment-orchestration.mdoc) — approve-then-pay gate
- [platform-portal-member.mdoc](../../phase-19/platform-portal-member.mdoc)
- [portal-registration-ui.md](./portal-registration-ui.md) — registration success → `/me/registrations`
- [portal-member-profile.md](./portal-member-profile.md) — sibling `/me/profile` skin
