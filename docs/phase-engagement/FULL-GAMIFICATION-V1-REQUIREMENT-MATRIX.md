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
| G3 | Operator overview | ADMIN_MANAGED | Owner/Admin | `/engagement` | `owner` \| `admin` | **COMPLETE** | `SMK-MEG-OP-01..04` |
| G4 | Operator policy catalog (levels/badges/rules) | ADMIN_MANAGED | Owner/Admin | `/engagement` policy card | `owner` \| `admin` | **COMPLETE** | `GET /engagement/operator/policy` + `SMK-MEG-OP-05` |
| G5 | Tenant-scoped member search | ADMIN_MANAGED | Owner/Admin | Name/phone search → directory | `owner` \| `admin` | **COMPLETE** | `/api/users` + `SMK-MEG-OP-05` |
| G6 | Manual point adjustment | ADMIN_MANAGED | Owner/Admin | Adjust dialog | `owner` \| `admin` | **COMPLETE** | `POST .../adjust` + `SMK-MEG-OP-05` |
| G7 | Event reversal | ADMIN_MANAGED | Owner/Admin | Reverse on history row | `owner` \| `admin` | **COMPLETE** | `POST .../reverse` + `SMK-MEG-OP-05` |
| G8 | Profile completion award | SYSTEM_AUTOMATED | Identity | `PATCH /identity/me` | Member | **COMPLETE** | `SMK-MEG-02`, `engagement-awards.postgres.spec.ts` |
| G9 | First registration approved award | SYSTEM_AUTOMATED | Booking outbox | `registration.approved` | System | **COMPLETE** | `engagement-awards.postgres.spec.ts` |
| G10 | Attendance / training / volunteer awards | SYSTEM_AUTOMATED | — | — | — | **MISSING_SOURCE** | No authoritative V1 producer |
| G11 | Badge-earned notification | SYSTEM_AUTOMATED | Engagement processor | `member_notifications` | Member | **COMPLETE** | migration `20260904193000` + `SMK-MEG-05` |
| G12 | Member dashboard engagement panel | MEMBER_INTERACTIVE | Member | `/me/home` | Member + entitlement | **COMPLETE** | `SMK-MEG-01` |
| G13 | Member engagement detail page | MEMBER_INTERACTIVE | Member | `/me/engagement` | Member + entitlement | **COMPLETE** | `SMK-MEG-04` |
| G14 | Engagement ≠ wallet separation | MEMBER_INTERACTIVE | Member | Dashboard | Member | **COMPLETE** | `WALLET-MEG-*`, `SMK-MEG-OP-01` |
| G15 | Cross-tenant isolation | INTERNAL_INFRASTRUCTURE | System | RLS | App role | **COMPLETE** | persistence spec |
| G16 | Operator permission denied | ADMIN_MANAGED | Viewer | `/engagement` API | `viewer` | **COMPLETE** | `SMK-MEG-OP-03` |
| G17 | Engagement Axe a11y | MEMBER_INTERACTIVE | Member/Operator | Portal + Web a11y suites | Member/Operator | **COMPLETE** | `test:smoke:engagement` a11y specs |
| G18 | Badge/level CRUD | ADMIN_MANAGED | — | — | — | **EXPLICITLY_OUT_OF_SCOPE** | V1 system-managed via `engagement-policy.ts`; read-only catalog |

---

## Event producer proof

| Source | Producer | Processor | Ledger | Badge/level | Notification | Evidence |
| ------ | -------- | --------- | ------ | ----------- | ------------ | -------- |
| Profile complete | `processProfileEngagementAward` | `processEngagementAward` | immutable event | `trailhead_ready` | `engagement.badge.earned` | `SMK-MEG-02`, `SMK-MEG-05`, awards spec |
| First registration approved | `dispatchEngagementFromOutbox` | `processEngagementAward` | dedupe per user | `first_expedition` | `engagement.badge.earned` | awards spec |
| Manual adjustment | Operator UI | `adjustMemberPoints` | immutable event | threshold badges | optional badge notify | `SMK-MEG-OP-05` |
| Reversal | Operator UI | `reversePointEvent` | compensating event | level recompute | — | `SMK-MEG-OP-05` |

---

## Verification ledger

| Command | Exit | Result |
| ------- | ---- | ------ |
| `pnpm --filter @app-tour/engagement-http-contracts test` | 0 | 4/4 pass |
| `pnpm --filter @app-tour/engagement-http test` | 0 | 3/3 pass |
| `apps/web` `engagement-ops-logic.spec.ts` | 0 | 9/9 pass |
| `engagement-awards.postgres.spec.ts` | 0 | 3/3 pass |
| `pnpm --filter @apps/web run test:smoke:engagement` | 0 | 7/7 pass (incl. OP-05 adjust/reverse) |
| `pnpm --filter @apps/portal run test:smoke:engagement` | 0 | 8/8 pass (incl. SMK-MEG-05 notification) |
| `pnpm --filter @apps/web run build` | 0 | pass |
| `pnpm run pre-commit:fast` | 0 | pass |

---

## Explicitly out of scope (V1)

- Public leaderboard, challenges, reward marketplace, point-to-money conversion
- Attendance/training/volunteer awards without authoritative producers (G10 `MISSING_SOURCE`)
- Workspace-configurable badge/level/rule CRUD (G18 read-only policy catalog only)

---

_Matrix closed for FDA-001 Gamification Operational V1 — mandatory interactive capabilities COMPLETE with browser evidence._
