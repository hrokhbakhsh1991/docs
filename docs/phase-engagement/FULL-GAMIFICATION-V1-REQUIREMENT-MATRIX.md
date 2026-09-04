# FULL-GAMIFICATION-V1-REQUIREMENT-MATRIX

**Feature:** Member Engagement & Gamification (MEG-001)  
**Branch:** `cursor/gamification-5bda`  
**Authority:** `docs/standards/member-engagement-gamification.mdoc`

---

## Capability matrix

| ID | Capability | Owner | Actor | Entry point | Permission | Status | Evidence |
| -- | ---------- | ----- | ----- | ----------- | ---------- | ------ | -------- |
| G1 | Engagement profile + point ledger | INTERNAL_INFRASTRUCTURE | System | Prisma + RLS | Tenant scope | **COMPLETE** | `engagement-persistence.postgres.spec.ts` |
| G2 | Member summary / history / badges API | MEMBER_INTERACTIVE | Member | `GET /engagement/me/*` | Member session | **COMPLETE** | Portal BFF + `/me/engagement` |
| G3 | Operator overview | ADMIN_MANAGED | Owner/Admin/Viewer | `/engagement` Overview tab | read: all operator roles | **COMPLETE** | `SMK-MEG-OP-01..04` |
| G4 | Badge definition management | ADMIN_MANAGED | Owner/Admin | Badges tab + API | mutate: owner/admin | **COMPLETE** | `engagement-admin-definitions.postgres.spec.ts` + `SMK-MEG-OP-06` |
| G5 | Level definition management | ADMIN_MANAGED | Owner/Admin | Levels tab + API | mutate: owner/admin | **COMPLETE** | postgres spec + UI threshold validation |
| G6 | Award rule management | ADMIN_MANAGED | Owner/Admin | Award Rules tab + API | mutate: owner/admin; allowlisted events | **COMPLETE** | postgres spec + `SMK-MEG-OP-07` |
| G7 | Definition audit history | ADMIN_MANAGED | Owner/Admin/Viewer | Audit tab | read: all operator roles | **COMPLETE** | postgres spec audit rows + Audit tab |
| G8 | Tenant-scoped member search | ADMIN_MANAGED | Owner/Admin | Members tab | owner/admin mutate | **COMPLETE** | `/api/users` + `SMK-MEG-OP-05` |
| G9 | Manual point adjustment | ADMIN_MANAGED | Owner/Admin | Adjust dialog | owner/admin | **COMPLETE** | `POST .../adjust` + `SMK-MEG-OP-05` |
| G10 | Event reversal | ADMIN_MANAGED | Owner/Admin | Reverse on history row | owner/admin | **COMPLETE** | `POST .../reverse` + `SMK-MEG-OP-05` |
| G11 | Profile completion award | SYSTEM_AUTOMATED | Identity | `PATCH /identity/me` | Member | **COMPLETE** | `SMK-MEG-02`, `engagement-awards.postgres.spec.ts` |
| G12 | First registration approved award | SYSTEM_AUTOMATED | Booking outbox | `registration.approved` | System | **COMPLETE** | `engagement-awards.postgres.spec.ts` |
| G13 | Attendance / training / volunteer awards | SYSTEM_AUTOMATED | — | — | — | **MISSING_SOURCE** | No authoritative V1 producer |
| G14 | Badge-earned notification | SYSTEM_AUTOMATED | Engagement processor | `member_notifications` | Member | **COMPLETE** | migration `20260904193000` + `SMK-MEG-05` |
| G15 | Member dashboard engagement panel | MEMBER_INTERACTIVE | Member | `/me/home` | Member + entitlement | **COMPLETE** | `SMK-MEG-01` |
| G16 | Member engagement detail page | MEMBER_INTERACTIVE | Member | `/me/engagement` | Member + entitlement | **COMPLETE** | `SMK-MEG-04` |
| G17 | Engagement ≠ wallet separation | MEMBER_INTERACTIVE | Member | Dashboard | Member | **COMPLETE** | `WALLET-MEG-*`, `SMK-MEG-OP-01` |
| G18 | Cross-tenant isolation | INTERNAL_INFRASTRUCTURE | System | RLS | App role | **COMPLETE** | persistence spec |
| G19 | Operator viewer read-only | ADMIN_MANAGED | Viewer | All GET admin routes | viewer read / mutate denied | **COMPLETE** | `SMK-MEG-OP-03`, `SMK-MEG-OP-08` |
| G20 | Engagement Axe a11y | MEMBER_INTERACTIVE | Member/Operator | Portal + Web a11y suites | Member/Operator | **COMPLETE** | `test:smoke:engagement` a11y specs |

---

## Explicitly out of scope (V1)

- Public leaderboard, challenges, reward marketplace, point-to-money conversion
- Attendance/training/volunteer awards without authoritative producers (G13 `MISSING_SOURCE`)
- Unsupported / wallet-coupled award rules

---

_Matrix tracks operator-managed definitions (G4–G7). G13 remains `MISSING_SOURCE` until domain producers exist._
