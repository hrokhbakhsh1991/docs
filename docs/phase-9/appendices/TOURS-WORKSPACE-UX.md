# TOURS-WORKSPACE-UX — Operator tour workspace shell (9.3-R3)

```yaml
doc_id: TOURS-WORKSPACE-UX
subphase: "9.3"
round: R3
scope: "(app)/tours/[id]/workspace layout + subnav + stub tabs; register → TOURS-REGISTER-UX.md R4"
authority: subphases/9.3-tours-operator.md · DEC-P9-008
prerequisite: TOURS-EDIT-UX.md R1
```

---

## 1. Behavioral objective

Provide the **workspace chrome** operators use to manage tour registrations, waitlist, and transport — without porting legacy tables in R3.

| Surface | Route | R3 scope |
| ------- | ----- | -------- |
| Registrations (default) | `(app)/tours/[id]/workspace` | **R3+** — pending roster from `GET /bookings?status=pending&tourId={id}` + register link |
| Waitlist | `…/workspace/waitlist` | **R3+** — table from `GET /bookings?status=waitlisted&tourId={id}` (9.5 API) |
| Transport | `…/workspace/transport` | **R3+** — modes from tour canonical + approved roster (`GET /bookings?status=approved&tourId={id}`) |
| Operator register | `(app)/tours/[id]/register` | **R4** — out of R3 |

---

## 2. Information architecture

```text
(app)/tours/[id]/edit          ← edit R1 (link → workspace)
(app)/tours/[id]/workspace     ← registrations tab (default)
(app)/tours/[id]/workspace/waitlist
(app)/tours/[id]/workspace/transport
(app)/tours/[id]/register      ← R4
```

Subnav tabs mirror legacy `WorkspaceSubnav`: registrations · waitlist · transport.

---

## 3. Web artifacts

| Artifact | Path |
| -------- | ---- |
| Subnav + tab resolver | `apps/web/src/features/tours/tour-workspace-logic.ts` |
| Layout shell | `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-layout-client.tsx` |
| Tab pages | `workspace/page.tsx` · `waitlist/page.tsx` · `transport/page.tsx` |
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

**BFF:** `GET /api/bookings?status=pending&tourId={tourId}` → operator pending queue.

**Web:** `TourWorkspaceRegistrationsClient` renders guest · party · departure · submitted + register guest CTA.

Empty state links to `(app)/tours/[id]/register`.

---

## 5. Verification

```bash
cd apps/web && node --import tsx --test test/tours-workspace.spec.ts
```
