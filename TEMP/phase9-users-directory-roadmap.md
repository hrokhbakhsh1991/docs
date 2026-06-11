# Phase 9 — Users Directory & Owner-Only Admin Panel Roadmap

```yaml
roadmap_id: P9-USERS-DIRECTORY-ROADMAP
version: "2026-06-11-v1"
status: DRAFT — TEMP (pre-doc-lock)
authority: docs/phase-9/appendices/USERS-DIRECTORY-UX.md · legacy/apps/web/app/(app)/users/
legacy_reference:
  - legacy/apps/web/app/(app)/users/
  - legacy/apps/api/src/modules/identity/users.controller.ts
  - legacy/apps/api/src/modules/identity/workspace-users.service.ts
  - legacy/packages/shared/rbac/workspace-membership-rbac.policy.ts
trunk_baseline:
  - apps/web/app/(app)/users/
  - apps/api/src/identity/users.{routes,service,rbac.policy}.ts
  - docs/phase-9/appendices/USERS-DIRECTORY-UX.md (DEC-P9-015 — will need amend)
```

> **هدف:** بازسازی بخش **کاربران** با parity منطقی legacy (پاداش، تخفیف، برچسب، بلاک، نقش‌ها) و ثبت مسیر کامل تا پیاده‌سازی.
> **تصمیم جدید (قفل TEMP):** پنل `(app)/` فعلی **فقط برای مالک (owner)** است — ادمین/عضو/viewer **نباید** وارد این پنل شوند. پنل جدا برای ادمین در آینده.

---

## 0. تصمیم معماری — Owner-Only Admin Panel

### 0.1 قفل محصول (2026-06-11)

| Rule | Behavior |
| ---- | -------- |
| **Who may login to `(app)/`** | `UserTenant.role === owner` **only** |
| **Admin / member / viewer** | **403 or dedicated “no panel access” screen** after OTP — **no** OperatorShell |
| **Future** | Separate deploy/route group for admin panel (e.g. `(admin)/` or subdomain) — out of this roadmap scope |
| **Team roles in DB** | Owner still invites/manages `admin` · `member` · (optional) `viewer` as **team membership** for when those panels exist + backend CASL |
| **Users directory gate** | Was `isAdminOrOwner` → becomes **`isOwner` only** for this panel |

### 0.2 تضاد با trunk فعلی (باید amend شود)

| Artifact | Today | Target |
| -------- | ----- | ------ |
| `USERS-DIRECTORY-UX.md` §3 | owner + admin see `/users` | **owner only** |
| `requireOperatorSessionWeb` / nav | `isAdminOrOwner` | **`isOwner`** for `(app)/` |
| `OPERATOR-LOGIN-FLOW.md` | admin reaches dashboard | **owner only** — admin OTP → block UX |
| DEC-P9-015 | 3-tier actor labels | **حفظ enum تیم** · **تغییر gate پنل** |
| Smoke SMK-P9-03 | admin session fixtures | owner session only for panel E2E |

### 0.3 جریان login (هدف)

```text
OTP success → hydrate membership
  → role === owner     → (app)/dashboard ✓
  → role !== owner     → /auth/login?access=owner-only (fa copy) — cookie cleared or never set
```

**نکته:** دعوت‌شده با نقش admin هنوز در DB می‌ماند؛ فقط UI این پنل را نمی‌بیند تا پنل ادمین ساخته شود.

---

## 1. خلاصه تحلیل Legacy vs Trunk

### 1.1 Legacy — آنچه «کامل» بود

- **فهرست:** cursor pagination · sort name/email · infinite scroll · table ≥768px
- **دعوت:** phone · نقش admin/member/viewer · pending tab · resend/cancel
- **نقش:** rank-based PATCH · bulk (API) · audit role-history
- **بلاک:** `SUSPENDED` + reactivate (API — UI ناقص)
- **پاداش:** تخفیف دائمی 0–100 · VIP/GOLD badges · labels · `isSelectableLeader` · trip summary tab
- **Leader:** سه لایه — نقش `leader` (legacy) · micro-cap selectable · badge LEADER_BUDDY
- **Gate directory:** legacy `isLeaderRole` = owner **or** admin

### 1.2 Trunk — وضعیت الان (2026-06-11)

| Layer | Status |
| ----- | ------ |
| API list/invite/pending/revoke/resend OTP | ✅ R6 |
| PATCH role · DELETE · rewards · suspend/reactivate | ✅ R1–R3 |
| ownership-transfer API + UI | ✅ R5 |
| role-history · booking-summary | ✅ R7 |
| bulk suspend/reactivate/remove/role | ✅ R8 |
| Web directory (table · scroll · sort · sheet) | ✅ R4 |
| Rewards UI (discount · VIP/GOLD · labels · leader) | ✅ R2 |
| Owner-only panel gate | ✅ R0 (DEC-P9-018) |
| Prisma production identity | ⏳ deferred |
| phase-9:guard + Architect promote | ⏳ open |

### 1.3 مدل نقش تیم (در DB — برای اعضای دعوت‌شده)

**پیشنهاد roadmap (با owner-only panel):**

```text
owner (4) > admin (3) > member (2) > viewer (1)   ← persisted team roles
```

| سطح فارسی | نقش DB | دسترسی **این** پنل `(app)/` | نقش محصولی |
| --------- | ------ | --------------------------- | ---------- |
| مالک | `owner` | ✅ login + full shell | مالک workspace |
| ادمین | `admin` | ❌ (پنل آینده) | مدیر عملیات |
| عضو | `member` | ❌ | عملیات محدود / رزرو |
| مشاهده‌گر | `viewer` | ❌ | read-only |

**تصمیم باز:** DEC-P9-015 فعلی `member` به‌جای viewer — در فاز R3 doc amend: یا `viewer` enum جدا یا fa label «مشاهده‌گر» برای `member`.

**Leader نقش workspace:** **برنگرد** — فقط `isSelectableLeader` + badges (legacy parity بدون نقش پنجم).

---

## 2. ماتریس Parity — Legacy → Target

| Feature | Legacy | Trunk | Target phase |
| ------- | ------ | ----- | ------------ |
| Owner-only panel login | ❌ (admin too) | ✅ | **R0** ✅ |
| Directory list + search | ✅ | ✅ cards | R4 |
| Infinite scroll + cursor | ✅ | ✅ | R4 |
| Sort name/email | ✅ | ✅ | R4 |
| Table desktop | ✅ | ✅ | R4 |
| Mobile bottom sheet actions | ✅ | ✅ | R4 |
| Invite admin/member/viewer | ✅ | ✅ | R3 |
| Pending resend (real OTP) | ✅ | ✅ | R6 |
| Change role | ✅ | ✅ | R3 (viewer) |
| Remove member | ✅ | ✅ | — |
| **Suspend / block** | ✅ | ✅ | **R1** |
| **Reactivate** | ✅ | ✅ | **R1** |
| Discount permanent % | ✅ | ✅ | — |
| Labels chips | ✅ | ✅ | **R2** ✅ |
| VIP / GOLD badges | ✅ | ✅ | **R2** ✅ |
| Selectable tour leader | ✅ | ✅ | R2 polish |
| LEADER_BUDDY badge | ✅ | ✅ modal toggle | **R2** ✅ |
| Row micro-badges | ✅ | ✅ | **R2** ✅ |
| Role audit history | ✅ | ✅ | R7 |
| Booking/trip summary | ✅ | ✅ | R7 |
| Bulk suspend/role/remove | ✅ | ✅ | **R8** |
| Ownership transfer UI | ✅ | ✅ | **R5** ✅ |
| CSV export | ✅ | ✅ | — |
| fa copy without workspace | partial | ✅ | **R2** ✅ |
| Permission preview on invite | ✅ | ✅ | **R4** ✅ |

---

## 3. RBAC — ماتریس هدف (Owner actor در این پنل)

فقط **owner** وارد پنل می‌شود؛ therefore **actor همیشه owner** برای UI actions:

| Capability | Owner |
| ---------- | :---: |
| View `/users` | ✅ |
| Invite admin / member / viewer | ✅ |
| PATCH role (not owner row) | ✅ |
| Suspend / reactivate | ✅ |
| Rewards modal | ✅ |
| Remove member | ✅ |
| Ownership transfer | ✅ |
| CSV export | ✅ |

**Rank rules (API — برای وقتی admin panel بیاید، همان policy):**

- `actorRank > targetRank` و `actorRank > newRoleRank`
- No self-change · no owner row mutation · sessionVersion bump on change

Port from: `legacy/.../workspace-membership-rbac.policy.ts` → extend trunk `users-rbac.policy.ts`.

---

## 4. Rewards & metadata (legacy parity)

Storage: `UserTenant.membership_metadata` (Prisma JSON) / in-memory mirror.

```typescript
{
  permanentDiscountPercentage?: number;  // 0–100 integer
  badges?: ("VIP_MEMBER" | "GOLD_CLUB" | "LEADER_BUDDY")[];
  isSelectableLeader?: boolean;          // tour leaderUserIds picker
  labels?: string[];                     // freeform tags, max 32 × 64 chars
}
```

| Field | UI row badge | Modal | Finance pricing |
| ----- | ------------ | ----- | --------------- |
| discount % | `%` chip | slider/input | future wire (CRM first) |
| VIP/GOLD | badge | radio loyalty tier | — |
| labels | chips | tag editor | marketing cap alias optional |
| selectable leader | «راهنما» | checkbox | wizard picker |

---

## 5. Suspend / block semantics

| | Remove | Suspend |
| --- | --- | --- |
| Row | deleted | `status=SUSPENDED` |
| Login this panel | — | blocked |
| JWT | revoke (sessionVersion++) | revoke |
| UI | destructive | primary moderation action |
| Reactivate | re-invite only | one-click |

API endpoints to add (legacy parity):

- `PATCH /users/{id}/suspend`
- `PATCH /users/{id}/reactivate`

---

## 6. فازبندی پیاده‌سازی

### R0 — Owner-only panel gate (پیش‌نیاز همه)

**Doc (before code):**

- Amend `USERS-DIRECTORY-UX.md` · `OPERATOR-LOGIN-FLOW.md` · `ADMIN-ROUTE-MATRIX.md`
- Decision locked: **DEC-P9-018** (owner-only `(app)/` shell)
- TEMP → doc pack before merge

**Code:**

| Area | Work |
| ---- | ---- |
| API | Post verify-otp or BFF login: reject session cookie if role !== owner |
| Web middleware | `(app)/**` → owner check |
| `requireOperatorSessionWeb` | `isOwnerRole()` |
| Login UX | `access=owner-only` banner fa/en |
| Tests | SMK fixtures · gate specs · **SMK-P9-08** admin OTP blocked |

**Exit:** admin/member OTP cannot reach dashboard. ✅

---

### R1 — Suspend / reactivate (بلock)

| Layer | Work |
| ----- | ---- |
| API | suspend + reactivate handlers · policy · repo · sessionVersion |
| BFF | proxy routes |
| UI | row actions · status badge «معطل» · filter optional |
| i18n | fa/en errors |
| Tests | API-9.4-23+ · WEB-9.4-15+ |

**Exit:** owner can block/unblock team member without delete. ✅

---

### R2 — Rewards full parity

| Layer | Work |
| ----- | ---- |
| UI modal | labels editor · VIP/GOLD tier · keep discount + selectable leader |
| UI row | micro-badges (discount · VIP · GOLD · labels · suspended) |
| i18n | remove workspace jargon in `users.json` fa |
| Tests | rewards patch + UI contract |

**Exit:** rewards modal matches legacy field set. ✅

---

### R3 — Team roles (admin · member · viewer) ✅

| Layer | Work |
| ----- | ---- |
| Doc | amend DEC-P9-015 if `viewer` enum restored |
| API | invite + PATCH accept `viewer` · rank table 4-3-2-1 |
| UI | invite role select · filter · row role menu |
| Hydrate | keep legacy mapping doc explicit |

**Exit:** owner can invite/assign viewer; admin still cannot login this panel.

---

### R4 — Directory UX shell ✅

| Work |
| ---- |
| Desktop table ≥768px (name · phone · role · badges · last login) |
| Mobile card + bottom sheet actions |
| Cursor infinite scroll (limit 50) |
| Sort controls (name asc/desc) |
| Permission preview 2-line on invite role select |
| URL SoT: `?search=&role=&sort=&tab=` |

**Exit:** UX parity with legacy layout patterns.

---

### R5 — Ownership transfer UI ✅

| Work |
| ---- |
| Settings or Users → owner-only section |
| Confirm dialog · pick target admin member |
| Wire `POST /workspaces/{tenantId}/ownership-transfer` |
| Post-transfer logout or session refresh |

---

### R6 — Invite resend (production) ✅

| Work |
| ---- |
| Resend triggers new OTP / SMS stub |
| Rate limit parity with login OTP |
| E2E SMK-P9-03 extension |

---

### R7 — Audit & member context ✅

| Work |
| ---- |
| `GET /users/{id}/role-history` port |
| Optional booking summary in user detail drawer |
| Audit tab or expandable row |

---

### R8 — Bulk actions ✅

| Work | Status |
| ---- | ------ |
| Bulk suspend · reactivate · remove · role | ✅ |
| Checkbox selection on table | ✅ |

---

## 7. مسیر doc-first (Zero-Debt)

```text
1. TEMP (this file) — review Architect
2. docs/phase-9/appendices/USERS-DIRECTORY-UX.md v2
3. IMPLEMENTATION-DECISIONS.md → DEC-P9-018 owner-only panel
4. OPERATOR-LOGIN-FLOW.md § owner-only branch
5. ADMIN-ROUTE-MATRIX.md actor column
6. users-api-dispatch-addendum.md suspend/reactivate
7. schemas/USERS-DIRECTORY-ROW.schema.json status + badges
8. Code R0→R8
9. phase-9:guard + targeted specs each round
```

---

## 8. فایل‌های trunk — touch map

| Phase | API | Web | Docs |
| ----- | --- | --- | ---- |
| R0 | auth.routes · hydrate-membership | middleware · layout · login-form | OPERATOR-LOGIN · ADMIN-ROUTE |
| R1 | users.routes · users.service · repos | users-page-client · BFF | users-api addendum |
| R2 | rewards validation | rewards modal · row badges | USERS-DIRECTORY § rewards |
| R3 | invite/role enums | invite UI · filters | DEC-P9-015 amend |
| R4 | cursor list | table · sheet | USERS-DIRECTORY § layout |
| R5 | ownership (exists) | settings or users UI | dispatch addendum |
| R6 | invites resend | — | IDENTITY-PORT |
| R7 | audit read | detail drawer | optional appendix |

---

## 9. تست — نقشه

| ID | Scope |
| -- | ----- |
| API-9.4-01..43 | identity · suspend · viewer · cursor · bulk |
| WEB-9.4-01..23 | directory · rewards · bulk landmarks |
| users-bulk.spec.ts | API-9.4-39..43 bulk partial success |
| users-role-history.spec.ts | API-9.4-35..36 · R7 |
| SMK-P9-03 | invite → accept → directory (owner actor) |
| WEB-LOGIN-UI-07 | admin OTP blocked contract (not SMK-P9-08) |

**Fast verify (per round):**

```bash
pnpm --filter @apps/api exec node --import tsx --test test/identity-users.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/users-directory.spec.ts
pnpm run phase-9:guard   # after doc lock
```

---

## 10. Best practices (مرجع)

1. Tenant-scoped RBAC — every check includes tenant_id
2. Simple hierarchy — permissions in code · roles in UI
3. Invite = pending membership — role granted on accept only
4. Deactivate ≠ delete — suspend + audit
5. Ownership transfer — atomic owner-only flow
6. Audit — role · suspend · rewards · remove

---

## 11. ریسک‌ها

| Risk | Mitigation |
| ---- | ---------- |
| DEC-P9-015 drift | Explicit amend + phase-9:guard |
| Admin users locked out of this panel | Document future admin panel; invite copy explains |
| Legacy DB 5-role rows | Hydrate mapping + one-time SQL |
| Pricing ignores discount metadata | Phase 9.7+ finance wire |
| Breaking SMK with owner-only | Reseed fixtures · SMK-P9-08 |

---

## 12. Definition of Done

- [x] R0 owner-only login + doc DEC-P9-018 locked
- [x] R1 suspend/reactivate E2E
- [x] R2 rewards parity (labels · VIP/GOLD · row badges)
- [x] R3 viewer invite/assign (DEC-P9-019)
- [x] R4 table + scroll + sort + mobile sheet
- [x] R5 ownership transfer UI
- [x] R6 resend delivery
- [x] R7 audit read path
- [x] fa users copy — no workspace jargon
- [x] phase-9:guard green (2026-06-11 · 32/32)
- [x] R8 bulk actions (API + UI + tests)
- [x] LEADER_BUDDY rewards modal toggle
- [x] SMK-P9-USERS-01..04 Playwright specs + smoke roster seed
- [x] PHASE9-USERS-DIRECTORY-CLOSURE.md (docs pack)
- [ ] Architect sign-off → promote TEMP to docs/

---

## 13. ترتیب اجرا

```text
R0 (owner gate) → R1 (block) → R2 (rewards) → R3 (roles) → R4 (UX shell)
  → R5 (ownership UI) → R6 (resend) → R7 (audit) → R8 (bulk, optional)
```

**باقی‌مانده:** Architect sign-off · promote TEMP → `docs/phase-9/appendices/PHASE9-USERS-DIRECTORY-CLOSURE.md` · Prisma 005.

---

*TEMP only — promote to docs/phase-9/ before implementation merge.*
