# Tour Workspace Finance Inbox — Phased Redesign

Status: **planning only**. No UI implementation in this document.

The big-bang workspace finance redesign was reverted. This plan replaces both that attempt and the older four-section card in [`tour-workspace-payment-follow-up-audit.md`](./tour-workspace-payment-follow-up-audit.md) **for presentation**. Finance-core contracts, list inclusion rules, and state precedence in that audit stay valid.

---

## Locked product target

This tab is an **operator work queue**, not a finance report.

Daily jobs (only these):

1. Record money the operator already received
2. Approve or reject a guest-uploaded receipt
3. See remaining balance and whether the guest stays in the queue

Pattern: **one queue + one case + one primary action**.

If the operator cannot answer “what do I do now?” in about three seconds, the phase failed.

### Detail modes (mutually exclusive)

| Mode | When | Surface |
|------|------|---------|
| Review receipt | `payment_under_review` | Inline approve/reject. Collection form hidden. |
| Collect | `needs_payment` / `overdue`, no pending receipt | One “record received amount” form. Suggested amount = remaining. |
| Read-only | settled / no payment required / no access | One sentence + optional history. No collection form. |

Exception tools (obligation override, operator-uploaded receipt, full payment history, Finance hub) live behind **More**. They are not the default view.

### Copy ceiling

| Surface | Max |
|---------|-----|
| Tab title | 3–4 words |
| Card description | counts, not a product paragraph |
| Action title | a verb |
| Action help | one sentence |
| Empty state | one sentence |
| Recommendation essays | **none** — the visible mode *is* the recommendation |

---

## Current state (after revert)

Code ownership is already correct. The gap is presentation and one missing in-tab behavior.

### What already works

- Tour-scoped outstanding list (`unpaid` / `partial`)
- Master–detail layout + mobile sheet
- Detail read-model: invoice, payments, schedule, pending receipts
- State machine: `resolveTourWorkspaceDetailActionMode` (`active` / `review_receipt` / `read_only`)
- Review mode already **hides** collection + receipt-submit forms
- Admin payment card, override, advanced receipt, evidence list, proof preview
- `FinanceReceiptReviewContent` exists on the Finance hub (PATCH `/api/finance/receipts/{id}/review`)

### What the operator actually sees today

**List**

- Name, kind badge, remaining amount
- Plus redundant hints: “select to review…” / “currently open…” / “Open details” / “Selected” (duplicated)

**Chrome**

- Title + long description
- Status strip: awaiting copy + remaining total + receipts link to **Finance hub** + partials copy
- Footer rollup (expected / collected / remaining) **and** the same amounts again in the detail card
- Escape links to payments hub + full Finance hub

**Detail (always expanded)**

1. Status badge + remaining + paragraph
2. Summary section (status card + expected-amount card + three amount cards)
3. Requirement section (source, installment label, due date, installment status)
4. Evidence section (pending count + portal hint + receipt list + recent payments + activity counts)
5. Actions: recommendation essay **plus** either hub CTA or payment form **plus** override **plus** advanced receipt — all visible in `active` mode
6. Ghost “open case” link

**The product gap that matters**

When status is `payment_under_review`, the next action is a link:

> Open receipt review → `/finance?tab=receipts`

Approve/reject does **not** happen in the workspace. That is the only missing capability; everything else is density and hierarchy.

---

## Gap matrix

| # | Current | Target | Phase | Risk |
|---|---------|--------|-------|------|
| G1 | List rows have duplicated instructional copy | Name + one badge + remaining | 1 | Low |
| G2 | Header/status strip are prose | One line of queue counts | 1 | Low |
| G3 | Recommendation essays on every detail | Delete; mode is the cue | 2 | Low |
| G4 | Override + advanced receipt always visible in `active` | Behind **More** | 2 | Low |
| G5 | `review_receipt` is a hub link | Inline `FinanceReceiptReviewContent` | 3 | Medium |
| G6 | After operator receipt submit, banner links to hub | Stay in panel; review appears in-tab | 3 | Medium |
| G7 | Three `DetailSection`s + three amount cards | Remaining-first strip; history collapsed | 4 | Medium |
| G8 | Filter `all / unpaid / partial` | Keep; optional later `pending receipt` | 5 | Low |
| G9 | Mobile sheet dumps the same long detail | Amount + primary action first | 5 | Low |

Out of scope for this program (already owned elsewhere):

- Settlement math, remaining-due, overdue policy, review persistence
- New finance APIs
- Finance hub redesign
- Uploader provenance (`member` vs `operator`) — still a finance-contract gap if product later wants the label

---

## Why the previous attempt failed

It stacked new chrome (hero, history `<details>`, inline review) **on top of** the old sections instead of deleting them. The screen stayed a report. Phases below are **subtractive first**, then one behavior add.

The older audit’s “Section A–D always visible” is the wrong presentation contract for a daily queue. Keep its **state precedence** and **list inclusion** rules; drop the four always-on sections.

---

## Phase 0 — Freeze the contract

**Goal:** Agree what “done” means before any UI diff.

**In**

- This document is the presentation contract
- Confirm: three jobs, exclusive modes, copy ceiling, More for exceptions
- Confirm: no finance-core / API work

**Out**

- Any `apps/web` UI change

**Exit**

- Product/architect yes on the gap matrix and phase order
- Explicit no to another big-bang PR

**Rollback:** N/A (docs only)

---

## Phase 1 — Density only (list + chrome copy)

**Goal:** Same behavior, half the instructional text. Operator can scan the queue.

**In**

- Guest row: name, badge, remaining. Remove open/selected hints
- Shorten tab description; status strip → counts (`N guests · M receipts · remaining`)
- Keep filters, search, rollup, hub escape links

**Out**

- Action section, detail sections, routing, review flow
- New components

**Likely files**

- `apps/web/src/features/tours/tour-workspace-finance-client.tsx` (list + strip only)
- `apps/web/messages/{fa,en}/tours.json` (shorten existing keys; do not add a key forest)

**Tests**

- Static: `tours-workspace.spec.ts` list/hint assertions updated to the new row shape
- E2E scenario1/3: panel, filters, guest list, focus still work
- Do **not** change scenario6 yet (still expects hub review CTA)

**Exit**

- No new actions
- List row readable at a glance
- Existing follow-up and focus flows green

**Rollback:** revert the copy/list commit only

---

## Phase 2 — One primary action (still hub for review)

**Goal:** Detail stops offering three tools at once. Review still leaves the tab.

**In**

- Remove recommendation essay block
- `active`: payment card is the only default action; override + advanced receipt inside **More**
- `review_receipt`: keep hub CTA (temporary); do not show collection form (already true)
- `read_only`: keep compact message

**Out**

- Inline approve/reject (Phase 3)
- Collapsing summary/evidence (Phase 4)

**Likely files**

- `tour-workspace-payment-actions-section.tsx`
- messages: shorten action titles; recommendation keys can stay unused until a later sweep

**Tests**

- Static order: payment card before **More**; **More** contains override + advanced receipt
- scenario4: record payment still works in workspace
- scenario6: **still** hub CTA visible; collection form still absent

**Exit**

- Scroll-to-action is short for `active`
- No operator-facing “recommended next step” paragraph

**Rollback:** revert the actions-section commit only

---

## Phase 3 — Inline receipt review (the real capability)

**Goal:** Admin finishes review without opening Finance hub.

**In**

- Reuse `FinanceReceiptReviewContent` in the workspace detail when `review_receipt`
- After approve/reject: refresh inbox + chrome; guest may leave the list
- After operator-submitted receipt: stay in panel (no “open receipts hub” banner)
- Hide collection form the entire time a pending receipt exists for that registration

**Out**

- New review API
- Redesigning Finance hub
- Visual hero rewrite (Phase 4)

**Likely files**

- New thin wrapper under `apps/web/src/features/tours/` that only mounts existing review content
- `tour-workspace-payment-actions-section.tsx` (`review_receipt` branch)
- `tour-workspace-finance-client.tsx` (pass pending receipts, refresh on review)
- scenario6: expect `FINANCE_RECEIPTS_TEST_IDS.reviewForm` in the workspace detail, **not** the hub link

**Tests**

- Unit/static: review form test id present in review mode; `createForm` / `receiptForm` count 0
- scenario6: inline review visible
- scenario5: submit receipt → review UI appears in-tab (or after refresh), not a hub jump
- Manual: approve one receipt, reject one receipt, list updates

**Exit**

- Gap G5/G6 closed
- Operator can complete the daily review job in the tab

**Rollback:** revert Phase 3 commits; hub CTA from Phase 2 returns

**Dependency:** Phase 2 (exclusive actions). Do not land inline review while override/advanced/collection are still competing on the same canvas.

---

## Phase 4 — Remaining-first detail

**Goal:** Detail looks like a case header + action, not a report.

**In**

- Replace the three always-on `DetailSection`s with: remaining (largest number), one row expected/collected/remaining, optional due date
- Evidence + activity behind **History**
- Keep Phase 3 review / Phase 2 collect as the block directly under remaining

**Out**

- New finance fields
- Filter taxonomy changes

**Tests**

- Static: no `detailSummaryTitle` / `detailRequirementBlockTitle` / `detailEvidenceTitle` as always-visible headings
- scenario1: actions still reachable without scrolling past essays
- Visual check (narrow + desktop): primary action above the fold

**Exit**

- Amount hierarchy is obvious
- History is opt-in

**Rollback:** revert Phase 4 only; review/collect behavior stays

---

## Phase 5 — Queue chrome and mobile (optional)

**Goal:** Polish after the job is possible in-tab.

**In (pick, do not bundle all by default)**

- Filter chip for “receipt waiting” if operators ask (today `partial` is a weak proxy)
- Mobile sheet: remaining + primary action first; More/History after
- Status strip receipts count is no longer a hub link (or is secondary)

**Out**

- Hub deletion (escape links stay)

**Exit**

- Mobile can complete collect and review without a desktop-width dump

---

## Sequencing rules

1. One phase per PR. No “while we’re here.”
2. Subtract copy before adding components.
3. Phase 3 is the only behavior bet; 1–2 are safe density; 4–5 are visual.
4. Fast-track only: targeted `apps/web` tests + the scenario specs named in the phase. No `phase-*:gate` / `test:full` unless Architect YES.
5. Do not revive the reverted big-bang files as a stack. If Phase 3 needs a wrapper, write that wrapper against **current** (post-revert) actions section.
6. Presentation changes stay in `apps/web`. No `platform-core` / `apps/api` / workspace-sdk.

---

## Definition of done for the whole program

1. Pending receipt: approve/reject in the workspace, no hub round-trip
2. Balance due, no receipt: one form, one submit
3. Primary action visible without hunting through summary/evidence/essays
4. Instructional copy on the tab is at most half of today’s keys in active use
5. Finance hub remains an escape hatch, not the daily path
