# TOURS-REGISTER-UX — Operator tour registration (9.3-R4)

```yaml
doc_id: TOURS-REGISTER-UX
subphase: "9.3"
round: R4
scope: "(app)/tours/[id]/register — tour-scoped manual booking create"
authority: subphases/9.3-tours-operator.md · BOOKINGS-OPS-UX.md · CP-9.3-08
prerequisite: TOURS-WORKSPACE-UX.md R3 · bookings-create API (9.5)
```

---

## 1. Behavioral objective

Operators register a guest on a **specific tour** without picking tour from a dropdown — reuses `POST /bookings` (manual create) with `tourId` locked from the route.

| Capability | Detail |
| ---------- | ------ |
| Route | `(app)/tours/[id]/register` |
| API | `POST /bookings` via BFF `/api/bookings` |
| ACL | admin/owner only (same as `(app)/bookings/new`) |
| Success | redirect `/bookings?status=pending&tourId={id}` |

---

## 2. Web artifacts

| Artifact | Path |
| -------- | ---- |
| Form logic | `apps/web/src/features/tours/tour-register-logic.ts` |
| Page | `apps/web/app/(app)/tours/[id]/register/` |
| Entry links | workspace layout · edit page · registrations panel |

Tour metadata loaded via `GET /api/tours/{id}` projection (title + departure prefill).

---

## 3. Completion proof (register R4)

| ID | Check | Proof |
| -- | ----- | ----- |
| CP-9.3-R01 | Register page renders post-login | WEB-9.3-R01 |
| CP-9.3-R02 | Payload uses route tourId | WEB-9.3-R02 |
| CP-9.3-R03 | Member sees locked state | WEB-9.3-R03 |
| CP-9.3-R04 | Workspace registrations tab lists tour pending rows | WEB-9.3-R04 · `tour-workspace-registrations-logic.ts` |
| CP-9.3-08 | Operator register page ties 9.5 schema | API bookings-create |

---

## 4. Verification

```bash
cd apps/web && node --import tsx --test test/tours-register.spec.ts
```
