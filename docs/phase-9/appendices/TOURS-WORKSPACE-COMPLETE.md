# TOURS-WORKSPACE-COMPLETE — Full operator tour workspace (post-R3)

```yaml
doc_id: TOURS-WORKSPACE-COMPLETE
version: "2026-08-12-v2"
status: COMPLETE
subphase: "9.3+"
continues: TOURS-WORKSPACE-UX.md
hardening: TOURS-WORKSPACE-UX-HARDENING-PLAN.md
authority: >
  TOURS-WORKSPACE-UX.md · BOOKINGS-OPS-UX.md · FINANCE-OPS-UX.md ·
  FINANCE_CASE_OPERATOR_EXPERIENCE.md · DEC-P9-008
scope: >
  Complete (app)/tours/[id]/workspace — header KPIs, Bookings CC embed on
  registrations, waitlist/transport parity, tour-scoped finance tab.
forbidden:
  - Hosting ops/finance inside /tours/[id]/edit
  - Duplicating full /finance hub inside workspace
  - Vehicle/driver assignment UI (deferred)
  - Tenant-wide ledger or reconciliation triage inside workspace
```

> **Problem (R3 gap):** Workspace shipped as thin read-only tables that escape to `/bookings`. Spec already required registrations to **embed the same Command Center with `tourId` preset**. Operators need one tour home for lifecycle ops **and** money rollup without leaving context.

---

## 1. Locked decisions

| ID | Decision |
| -- | -------- |
| TW-C-01 | **Registrations** = embed / reuse Bookings Command Center shell with `lockedTourId` (not thin-table as final UX) |
| TW-C-02 | **Finance** = new workspace tab: tour rollup + scoped queues; detail unit remains **registration** (Financial Case) |
| TW-C-03 | **Edit** stays content-only; Workspace is ops home |
| TW-C-04 | Bookings owns lifecycle mutations; Finance owns money mutations; Workspace **composes** both for one `tourId` |
| TW-C-05 | Finance tab visible only when Denali finance nav/capability allows (`financeNav`). **Gate on the RSC layout** via `ensureFinanceNavSupported` → `includeFinance` prop — do **not** re-resolve by loading the workspace plugin in the browser (client `ALLOW_*` is unavailable; fail-closed cache would hide the tab forever). |
| TW-C-06 | Transport stays roster + modes; assignment out of scope |
| TW-C-07 | Transport intake on Workspace roster via **list scalars** `transportKind` + `personalCarOccupants` (H5-T3); full intake remains detail-only (BK-SAFE-01 / UX-BKG-50) |

---

## 2. Information architecture

```text
(app)/tours/[id]/edit                 ← content (out of workspace scope)
(app)/tours/[id]/workspace            ← registrations (Bookings CC embed, default — no ?tab)
(app)/tours/[id]/workspace?tab=waitlist|transport|finance
(app)/tours/[id]/register             ← manual guest register

/bookings?tourId={id}                   ← multi-tour Command Center (same APIs)
/finance?tourId={id}                    ← multi-registration Finance hub
/finance/case/{registrationId}         ← commercial meaning / encounter
```

Legacy paths `/workspace/waitlist`, `/workspace/transport`, `/workspace/finance` redirect to `?tab=` equivalents.

### Subnav tabs

| Tab | Query | Job |
| --- | ----- | --- |
| registrations | _(default — omit `tab`)_ | Lifecycle inbox + inspection for this tour |
| waitlist | `?tab=waitlist` | Waitlisted guests · approve/reject (CC embed) |
| transport | `?tab=transport` | Modes + approved roster + intake labels |
| finance | `?tab=finance` | Tour AR rollup + outstanding/receipts/payments + case drill-in |

---

## 3. Header slots (always visible)

| Slot | Source | Notes |
| ---- | ------ | ----- |
| Title + publish/ui status | `GET /api/tours/{id}` projection | Required |
| Departure | projection `departureAt` | Format locale |
| Capacity | `acceptedCount` / `totalCapacity` when present | Show open if capacity null |
| Ops counts | `GET /api/bookings?tourId&status={pending\|waitlisted\|approved}&limit=1` → `total` | **Hardening H-01** — not summary `tourChips` |
| Money KPIs | `tour-collections?tourId` + `receipts/pending?tourId` | remaining + receipts (`N` or `N+` if hasMore); click → finance tab |
| Nav actions | Edit · Register (header primary) · one secondary Open Bookings · Open Finance if financeNav | Trim duplicate Register/CC on registrations panel (H-06) |

---

## 4. Ownership boundary

```text
Bookings owns:  pending → approved | rejected | waitlisted | cancelled
Finance owns:   intents, receipts, wallet, schedules, refunds, ledger
Workspace:      composes both for ONE tourId — no second mutation spine
```

Approve registration ≠ financially settled. Settlement meaning comes from invoice/remaining (+ Case encounter when opened).

---

## 5. Deep-link contract

| From | To | Params |
| ---- | -- | ------ |
| Workspace → Bookings CC | `/bookings` | `tourId`, optional `status`, `view=ops` |
| Workspace → Finance hub | `/finance` | `tourId`, optional `tab` |
| Workspace finance row → Case | `/finance/case/{registrationId}` | optional `counterpartyId` |
| Bookings/Finance → Workspace | `/tours/{tourId}/workspace` (+ tab) | when `tourId` known |
| Registrations embed | internal query locked | `tourId` immutable while embedded |

Query helpers must not disagree (e.g. list all statuses vs escape link `status=pending` only) without intentional UX copy.

---

## 6. Registrations embed (TW-C-01)

- **SoT shell:** `apps/web/src/features/bookings/bookings-command-center-shell.tsx` (`BookingsPageClient` / alias `BookingsCommandCenterShell`)
- App `/bookings` entry is a thin re-export: `app/(app)/bookings/bookings-page-client.tsx`
- Embed props:
  - `lockedTourId: string`
  - `embedded?: boolean` (tighter chrome, hide page header / tour-wide KPI strip)
  - `lockedStatus?: BookingStatus` (H4b waitlist)
  - `onOpsMutationSuccess?: () => void` (H-03 chrome reload)
  - Tour chip bar hidden when `lockedTourId` set
- Mount from `tour-workspace-registrations-client.tsx` / waitlist client via `@/features/bookings/...` (I-07 / I-08 — no app→app import)

---

## 7. Waitlist / Transport

### Waitlist
- List `status=waitlisted&tourId=` (**H4b:** embed Bookings CC with `lockedStatus=waitlisted` + capacity strip)
- Admin/owner: approve + reject via same CC shell / BFF as registrations
- Capacity shown above embed; over-capacity warned in strip

### Transport
- Modes from tour canonical via `tour-canonical-transport-modes` adapter (I-06)
- Roster `status=approved&tourId=`
- Intake transport via **list scalars** `transportKind` + `personalCarOccupants` (H5-T3) — **not** full `registrationIntake` on list (BK-SAFE-01 / UX-BKG-50)
- Detail/inspection still returns full intake blob when needed
- **Non-goal:** vehicle/driver assignment

---

## 8. Finance tab (TW-C-02)

Tour is a **filter + money inbox**; Financial Case remains per registration.

| Zone | Content |
| ---- | ------- |
| Inbox hero | **Needs attention** (actionable now) · **Awaiting payment** (follow-up) — ordered by actionability |
| Secondary rollup | expected · collected · remaining (compact; not page hero — header KPIs already show amounts) |
| Escape | Payments / receipts hub deep-links · Open Finance hub |
| Drill-in | Case / commercial meaning per `registrationId` |
| Gate | Hide tab when finance capability off. Panel landmarks: chrome `operator-tour-workspace-finance-panel` (card) · inbox body `operator-tour-workspace-finance-inbox` (content) — must stay distinct for Playwright strict mode. |

### H-10 — Money Inbox presentation (2026-08-12)

**Problem:** Tab felt like a mini accounting dashboard (`Outstanding: N` + amount cards) instead of answering post-approve: “who still owes, and what should I do?”

**Locked model** (presentation only — no ownership / API spine change):

| Queue | Includes | Operator job |
| ----- | -------- | ------------ |
| **Needs attention** | Pending receipts · outstanding with `bookingPaymentStatus=partial` | Do now — review receipt / inspect partial |
| **Awaiting payment** | Outstanding with `unpaid` (or null + remaining) | Follow up — guest still owes |
| Section order | If Needs attention has rows → show it first; else Awaiting payment first | Actionability, not fixed receipt-over-unpaid |
| Language | “N guests still owe” + remaining total — not bare `Outstanding: N` | Product copy |
| Row CTA | Receipt → review receipt (hub/case) · Unpaid/partial → follow up payment / case | Human status + verb |
| Empty | Success when both queues empty (“all settled for this tour”) | Not a blank accounting void |

**Phases (tech lead):**

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| P0 | This H-10 lock in COMPLETE | Done |
| P1 | Hierarchy + demote rollup + inbox helpers | Done |
| P2 | Human status + CTA copy (en/fa) | Done |
| P3 | Actionability order + empty/success states | Done |
| P4 | Unit tests for partition/order helpers | Done |

**Forbidden:** second mutation spine · duplicating full `/finance` hub · inventing new money APIs for this UX.

### H-11 — Tour Money Inbox polish (≠ Finance Hub) (2026-08-12)

**Distinction (locked):**

| Surface | Job |
| ------- | --- |
| **Finance Hub** (`/finance`) | Cross-tour AR / receipts / payments product |
| **Tour workspace `?tab=finance`** | Money inbox for **this tour only** — who still owes, what to do now |

Page model: **Money status → Money actions → Guest list**.  
Rollup (`Expected · Collected · Remaining`) stays useful but **never page hero**.

Operator question: “Of this tour’s guests, who hasn’t paid / which receipts need review, and what do I do?”

**In scope**

| Priority | Change |
| -------- | ------ |
| P0 | Receipt primary CTA = **Review receipt** (tour-scoped receipts hub / preselect) — not Case-only |
| P0 | Pending receipt vs Outstanding/Partial clearly distinct |
| P0 | Case = secondary only; Hub link = escape only (never primary row CTA) |
| P1 | Status strip: `N guests awaiting payment` · `M receipts need review` · remaining total |
| P1 | Local filters: All / Unpaid / Partial / Receipt pending / Paid |
| P1 | Guest name search on loaded list (large roster) |
| P1 | Compact non-hero rollup; preserve H-04 `N+` on receipts hasMore |
| P1/P2 | Post-approve → `?tab=finance&focusRegistrationId=` with simple highlight or one-guest filter; `replace` after apply; fail-soft → case |

**Explicitly out of scope (Forbidden for this tab)**

- Priority / sort by nearest departure (all rows share this tour)
- Complex time-based multi-tour sorting
- Turning the tab into an AR dashboard / mini Finance product
- Header-wide unpaid badge solely for this concern when tab counts are clear
- Hub as primary row CTA

**Delivery order:** P0 docs (this section) → P0 CTAs → P1 status/filter/search/rollup → P2 focus → P3 unit/i18n/docs Done.

| Wave | Status |
| ---- | ------ |
| P0 docs + CTAs + distinction + Case secondary + Hub escape | Done |
| P1 status strip · filters · search · compact rollup · H-04 N+ | Done |
| P2 post-approve `focusRegistrationId` highlight/filter + replace + fail-soft | Done |
| P3 unit/i18n | Done |
| P3 Playwright smoke `denali-workspace-finance-inbox.spec.ts` | Done |
| H-11 polish (focus by registrationId + scroll · no false miss before load · hide filters when settled empty · `data-finance-registration-id` · paid row amount = paidMinor) | Done |

### Server list scope (hardening 2026-08-12)

| Route | `tourId` query |
| ----- | ------------- |
| `GET /finance/reports/outstanding-balances` | Optional — filter after identity enrich, before pagination |
| `GET /finance/reports/tour-collections` | Optional — return only that tour’s rollup row(s) |
| `GET /finance/receipts/pending` | Already supported via `parseFinanceListScope` |

Client-side filter of a truncated `limit=50` page is **forbidden** for Workspace KPIs — always pass `tourId`.

### UX hardening (2026-08-12)

| Rule | Behavior |
| ---- | -------- |
| H-01 | Ops KPI from list `total` only (pending / waitlisted / approved) |
| H-02 | Header KPIs + subnav badges click through to the matching workspace tab (approved → transport) |
| H-03 | Waitlist **and registrations embed** mutations call workspace chrome reload (`onOpsMutationSuccess`) |
| H-04 | Pending-receipt count shows `N+` when `hasMore` |
| H-05 | Finance rollup shows expected · collected · remaining |
| H-06 | One primary Register (header); one secondary Open Bookings (header); finance hub single secondary |
| H-07 | Waitlist = Bookings CC embed with `lockedStatus=waitlisted` + capacity strip (H4b) |
| H-08 | Embedded CC lifecycle success notices include deep links: approve → transport tab; unpaid/partial → finance tab; reject/cancel → history CC query. Waitlist embed passes `tourCapacityGuard` — approve at capacity requires confirm dialog (H2-T2) |
| H-09 | **Client-side tab navigation:** single route `/workspace` + `?tab=`; subnav + header KPI use `<button>` + `router.replace(buildWorkspaceTabReplacePath, { scroll: false })` (FINANCE-OPS-UX §5 parity). Lazy keep-alive panels mount tab clients on first visit. Legacy segment routes redirect only. Waitlist/transport capacity + modes use shared `fetchTourDetailCached`. Embedded CC action-notice tab links call `navigateWorkspaceTab` when workspace chrome context is active (no `<Link ?tab=` remount). Invalid `?tab=finance` when finance disabled → replace to registrations |
| H-10 | **Finance tab = Money Inbox:** Needs attention (pending receipts + partial) vs Awaiting payment (unpaid); actionability section order; human copy + row CTAs; amount rollup demoted to secondary |
| H-11 | **Tour Money Inbox ≠ Finance Hub:** Status→Actions→List; Review receipt CTA; local filter/search; compact rollup; simple post-approve focus. Forbidden: departure priority, AR dashboard, hub-as-primary-CTA, header unpaid badge-only |
| Isolation | Host-owned tour workspace + capability gates — see HARDENING-PLAN list I-01…I-10 |
| I-06 | Thin adapter `tour-canonical-transport-modes.ts` for tour offered modes |
| I-07/I-08 | CC shell in `features/bookings/bookings-command-center-shell`; workspace embeds import features only |
| Shared finance fetch | Header KPIs + Finance tab share TTL/in-flight cache for `tour-collections` + pending receipts (`tour-workspace-finance-fetch-cache.ts`); outstanding stays tab-only |
| H5-T3/T4 | List scalars `transportKind` + `personalCarOccupants` (no intake blob); transport tab single list fetch |

Plan: [`TOURS-WORKSPACE-UX-HARDENING-PLAN.md`](./TOURS-WORKSPACE-UX-HARDENING-PLAN.md)

**Non-goals:** tenant ledger browser, reconciliation triage, duplicate installments engine UI (reuse panel only if manifest enables).

---

## 9. Web / API touch map

| Layer | Paths |
| ----- | ----- |
| Shell | `tour-workspace-layout-client.tsx` · `tour-workspace-tab-panels.tsx` · `tour-workspace-logic.ts` · `tour-workspace-types.ts` · `tour-route-cache.ts` |
| Registrations | `tour-workspace-registrations-*` · `features/bookings/bookings-command-center-shell*` |
| Waitlist/Transport | `workspace/waitlist/*` · `workspace/transport/*` · `tour-canonical-transport-modes*` · list scalars `transportKind` |
| Finance tab | `workspace/finance/*` · `tour-workspace-finance-fetch-cache*` · reuse `apps/web/src/finance/*` |
| API (additive only) | `apps/api/src/bookings/*` · `apps/api/src/workspace-finance/*` · OpenAPI |
| i18n | `messages/fa|en/tours.json` |

---

## 10. Delivery phases (implementation order)

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| 0 | This doc + UX cross-links (docs-only) | Done 2026-08-12 |
| 1 | Header ops KPIs + nav links | Done |
| 2 | Registrations = Bookings CC embed (`lockedTourId` / `embedded`) | Done |
| 3 | Waitlist ops + transport intake list scalars (no N+1) | Done |
| 4 | Finance tab tour-scoped | Done |
| 5 | Header money KPIs + bidirectional deep links + UX hardening (H0–H5) | Done |
| 6 | Cleanliness: I-06 adapter · I-07/I-08 shell extract · shared finance cache | Done |

---

## 11. Verification (fast-track)

```bash
# Prefer after each phase — no full gate without Architect YES
pnpm run pre-commit:fast
# Targeted when behavior changes:
cd apps/web && node --import tsx --test test/tours-workspace.spec.ts
```

Cross-refs: [`TOURS-WORKSPACE-UX.md`](./TOURS-WORKSPACE-UX.md) · [`TOURS-WORKSPACE-UX-CRITIQUE.md`](./TOURS-WORKSPACE-UX-CRITIQUE.md) · [`TOURS-WORKSPACE-UX-HARDENING-PLAN.md`](./TOURS-WORKSPACE-UX-HARDENING-PLAN.md) · [`BOOKINGS-OPS-UX.md`](./BOOKINGS-OPS-UX.md) · [`FINANCE-OPS-UX.md`](./FINANCE-OPS-UX.md)
