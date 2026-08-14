# TOURS-WORKSPACE-UX — Operator tour workspace shell (9.3-R3)

```yaml
doc_id: TOURS-WORKSPACE-UX
subphase: "9.3"
round: R3
scope: "(app)/tours/[id]/workspace layout + subnav + stub tabs; register → TOURS-REGISTER-UX.md R4"
authority: subphases/9.3-tours-operator.md · DEC-P9-008
prerequisite: TOURS-EDIT-UX.md R1
complete_spec: TOURS-WORKSPACE-COMPLETE.md
```

> **Complete workspace (post-R3):** Header KPIs, Bookings Command Center embed on registrations, waitlist/transport parity, and tour-scoped finance tab are specified in [`TOURS-WORKSPACE-COMPLETE.md`](./TOURS-WORKSPACE-COMPLETE.md). This file remains the R3 baseline + tab BFF notes.

---

## 1. Behavioral objective

Provide the **workspace chrome** operators use to manage tour registrations, waitlist, and transport — without porting legacy tables in R3.

| Surface | Route | R3 scope |
| ------- | ----- | -------- |
| Registrations (default) | `(app)/tours/[id]/workspace` | **Complete** — Bookings CC embed with `lockedTourId` (not thin pending table). See TOURS-WORKSPACE-COMPLETE |
| Waitlist | `…/workspace?tab=waitlist` | **Complete** — Bookings CC embed `lockedStatus=waitlisted` + capacity strip (H4b) |
| Transport | `…/workspace?tab=transport` | **Complete** — modes + approved roster + intake labels |
| Finance | `…/workspace?tab=finance` | **Complete** — Tour Money Inbox (H-10/H-11): status→actions→guest list for **this tour only**; not Finance Hub. See TOURS-WORKSPACE-COMPLETE §8 |
| Operator register | `(app)/tours/[id]/register` | **R4** — out of R3 |

Legacy segment paths (`/workspace/waitlist`, `/transport`, `/finance`) **redirect** to the canonical `?tab=` query (deep-link compatibility only).

---

## 2. Information architecture

```text
(app)/tours/[id]/edit          ← edit R1 (link → workspace)
(app)/tours/[id]/workspace     ← registrations tab (default) — ?tab omitted
(app)/tours/[id]/workspace?tab=waitlist|transport|finance
(app)/tours/[id]/register      ← R4
```

Subnav tabs: registrations · waitlist · transport · finance (finance capability-gated).

**Tab navigation (H-09):** Subnav and header KPI clicks use `<button type="button">` + `router.replace(buildWorkspaceTabReplacePath(...), { scroll: false })` — same pattern as [`FINANCE-OPS-UX.md`](./FINANCE-OPS-UX.md) §5. Avoid raw `<Link href="?tab=…">` for in-shell tab switches (prevents heavy RSC re-fetch under `(app)/layout` `force-dynamic`).

**Lazy keep-alive panels:** `tour-workspace-tab-panels.tsx` mounts each tab client on **first visit**, then toggles `hidden` — not all four eagerly on initial load.

---

## 3. Web artifacts

| Artifact | Path |
| -------- | ---- |
| Subnav + tab resolver | `apps/web/src/features/tours/tour-workspace-logic.ts` (`buildWorkspaceTabReplacePath`, `hrefForWorkspaceTab`) |
| Layout shell + tab buttons | `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-layout-client.tsx` |
| Lazy keep-alive panels | `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-tab-panels.tsx` |
| Legacy segment redirects | `workspace/waitlist/page.tsx` · `transport/page.tsx` · `finance/page.tsx` → `?tab=` |
| Entry from list/edit | `tour-card.tsx` · `tour-edit-page-client.tsx` |

Tour header reuses `GET /api/tours/{id}` projection (same BFF as edit).

---

## 4. Completion proof (workspace R3)

| ID | Check | Proof |
| -- | ----- | ----- |
| CP-9.3-W01 | Workspace layout renders post-login | WEB-9.3-W01 |
| CP-9.3-W02 | Subnav highlights active tab | WEB-9.3-W02 |
| CP-9.3-W03 | Edit + list link to workspace | WEB-9.3-W03 |
| CP-9.3-W04 | Register route not in R3 | doc scope |
| CP-9.3-W05 | Waitlist tab lists tour-scoped waitlisted rows | WEB-9.3-W04 · `tour-workspace-waitlist-logic.ts` |
| CP-9.3-W06 | Transport tab shows modes + approved guest roster | WEB-9.3-W06 · `tour-workspace-transport-logic.ts` |
| CP-9.3-W07 | Registrations tab lists tour-scoped pending rows | WEB-9.3-R04 · `tour-workspace-registrations-logic.ts` |

---

## 6. Waitlist tab (9.3 · 9.5 tie-in)

**BFF:** `GET /api/bookings?status=waitlisted&tourId={tourId}` → operator registrations queue filtered in `bookings.service.ts`.

**Web:** `TourWorkspaceWaitlistClient` renders guest · party · departure · submitted · approve (admin/owner only via `POST /api/bookings/{id}/approve`).

Empty state links to Command Center (`/bookings?status=waitlisted&tourId=…`).

---

## 7. Transport tab (9.3 · read-only R3)

**No dedicated transport API in 9.x** — roster is derived from existing surfaces:

| Data | Source |
| ---- | ------ |
| Transport modes | `GET /api/tours/{id}` → `canonical.data` paths: `details.tripDetails.transportModes`, top-level `tripDetails.transportModes`, or `transportModes` |
| Guest roster | `GET /api/bookings?status=approved&tourId={tourId}&view=ops` |

**Web:** `TourWorkspaceTransportClient` renders mode badges + read-only table (guest · party · departure · status). Vehicle/driver assignment UI is **post-9.3** (legacy port deferred).

Empty roster links to Command Center (`/bookings?status=approved&tourId=…`).

---

## 8. Registrations tab (9.3 · 9.5 tie-in)

**SoT (Complete / hardening):** Embed Bookings Command Center from `features/bookings/bookings-command-center-shell` with `lockedTourId` + `embedded` (+ waitlist: `lockedStatus=waitlisted`). See [`TOURS-WORKSPACE-COMPLETE.md`](./TOURS-WORKSPACE-COMPLETE.md) §6.

**BFF:** same `GET /api/bookings` ops list as Command Center (`tourId` locked). Thin pending table is **not** the product UX.

Empty / register CTA: primary Register lives on workspace header (H-06).

---

## 9. Finance tab (Complete)

Tour-scoped outstanding / receipts / payments + rollup + case drill-in. Spec: [`TOURS-WORKSPACE-COMPLETE.md`](./TOURS-WORKSPACE-COMPLETE.md) §8. Cross-ref: [`FINANCE-OPS-UX.md`](./FINANCE-OPS-UX.md).

---

## 5. Verification

```bash
cd apps/web && node --import tsx --test test/tours-workspace.spec.ts
```
