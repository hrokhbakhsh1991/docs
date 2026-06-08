# Admin route matrix — HTTP + Web access control

```yaml
matrix_version: "2026-06-08-v1"
authority: phase-9-agent-router.md §4 · DEC-P9-004 · INV-P9-007
primary_workspace: denali
fail_closed: true
protected_prefix: (app)
```

## Binding law

| Law            | Rule                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| **INV-P9-007** | All `(app)/` pages and matching API routes require **authenticated session** with active `UserTenant` membership. |
| **DEC-P9-004** | Denali operator mutations allow `isAdminOrOwner`. Urban owner surfaces remain **owner-only** (INV-P8-007).        |
| **INV-P9-003** | Every handler resolves `tenant_id` from host/kernel before business logic.                                        |
| **MAP §12 R4** | Missing auth → **401/403** — no redirect loops on API.                                                            |

---

## Actor vocabulary

| Actor         | Definition                                                           |
| ------------- | -------------------------------------------------------------------- |
| **Anonymous** | No session — allowed only on `/auth/*` and Phase 8 public routes     |
| **Member**    | Authenticated `role=member` — read-mostly operator surfaces per CASL |
| **Admin**     | `role=admin` — Denali config + ops (not Urban owner settings)        |
| **Owner**     | `role=owner` — full tenant ops including Urban owner surfaces        |

**DEC-P9-015:** `leader` and `viewer` are **legacy hydrate aliases only** — not actor labels in this matrix. Legacy DB `leader` → session `admin`; `viewer` → `member`. URL `/leader/review` is a **path alias** (DEC-P9-011), not a fourth RBAC tier.

---

## API routes — Identity (9.1)

| METHOD | PATH                | ACTOR         | EXPECTED                            |
| ------ | ------------------- | ------------- | ----------------------------------- |
| POST   | `/auth/request-otp` | Anonymous     | **200** challenge id · rate limited |
| POST   | `/auth/verify-otp`  | Anonymous     | **200** session · **401** bad code  |
| GET    | `/auth/session`     | Authenticated | **200** hydrate · **401** missing   |

**Logout (DEC-P9-012):** No API `POST /auth/logout`. Client clears session via BFF `POST /api/auth/logout` only — see [`OPERATOR-LOGIN-FLOW.md`](OPERATOR-LOGIN-FLOW.md).

---

## API routes — Tours operator (9.3)

| METHOD | PATH              | ACTOR              | CASL                   | EXPECTED                 |
| ------ | ----------------- | ------------------ | ---------------------- | ------------------------ |
| GET    | `/tours`          | Admin/Owner/Member | Read CanonicalDocument | **200** paginated        |
| GET    | `/tours/{tourId}` | Admin/Owner/Member | Read                   | **200** · **404**        |
| PATCH  | `/tours/{tourId}` | Admin/Owner        | Update                 | **200** · **403** member |
| POST   | `/tours`          | Admin/Owner        | Create                 | **201**                  |
| DELETE | `/tours/{tourId}` | Admin/Owner        | Delete/Archive         | **204** · **403**        |

---

## API routes — Users (9.4)

| METHOD | PATH                        | ACTOR       | EXPECTED                                      |
| ------ | --------------------------- | ----------- | --------------------------------------------- |
| GET    | `/users`                    | Admin/Owner | **200** directory                             |
| GET    | `/users`                    | Member      | **403** — no read-only directory (DEC-P9-015) |
| POST   | `/users/invite`             | Admin/Owner | **201** invite                                |
| DELETE | `/users/invites/{inviteId}` | Admin/Owner | **204**                                       |
| PATCH  | `/users/{userId}/role`      | Owner       | **200** · admin cannot promote to owner       |
| DELETE | `/users/{userId}`           | Admin/Owner | **204** · cannot delete self                  |
| POST   | `/users/{userId}/rewards`   | Admin/Owner | **200** · member **403**                      |

---

## API routes — Bookings ops (9.5 · DEC-P9-011)

| METHOD | PATH                     | ACTOR              | EXPECTED                                                  |
| ------ | ------------------------ | ------------------ | --------------------------------------------------------- |
| GET    | `/bookings`              | Admin/Owner/Member | **200** — `view=ops` admin queue · `view=mine` member own |
| GET    | `/bookings/summary`      | Admin/Owner        | **200** KPI counts (tour ACL may narrow rows)             |
| GET    | `/bookings/{id}`         | Admin/Owner/Member | **200** · member **403** if not own                       |
| POST   | `/bookings/{id}/approve` | Admin/Owner        | **200**                                                   |
| POST   | `/bookings/{id}/reject`  | Admin/Owner        | **200**                                                   |
| POST   | `/bookings/bulk-approve` | Admin/Owner        | **200** · batch ≤ manifest max                            |
| POST   | `/bookings`              | Admin/Owner        | **201** manual create                                     |

---

## API routes — Settings registry (9.6 · DEC-P9-009)

| METHOD | PATH                                      | ACTOR         | EXPECTED                         |
| ------ | ----------------------------------------- | ------------- | -------------------------------- |
| GET    | `/settings/modules`                       | Authenticated | **200** manifest metadata        |
| GET    | `/settings/resources/{moduleId}`          | ability read  | **200** · **404** unknown module |
| POST   | `/settings/resources/{moduleId}`          | Admin/Owner   | **201**                          |
| PATCH  | `/settings/resources/{moduleId}/{itemId}` | Admin/Owner   | **200**                          |
| DELETE | `/settings/resources/{moduleId}/{itemId}` | Admin/Owner   | **204**                          |
| GET    | `/settings/config/{configKey}`            | Admin/Owner   | **200** effective config         |
| PUT    | `/settings/config/{configKey}`            | Admin/Owner   | **200** + cache bust             |
| GET    | `/settings/tour-wizard-template`          | Admin/Owner   | alias → config `wizard_template` |
| PUT    | `/settings/tour-wizard-template`          | Admin/Owner   | alias → config PUT               |

**Urban exception:** `GET/PATCH /urban/settings` remains **owner-only** per Phase 8 matrix — admin role **403**.

---

## Web routes — `(app)/` (9.2–9.7)

| METHOD | PATH                         | GUARD                               | EXPECTED                                                 |
| ------ | ---------------------------- | ----------------------------------- | -------------------------------------------------------- |
| GET    | `(app)/dashboard`            | `requireOperatorSession`            | **200** · **redirect /auth/login** if anon               |
| GET    | `(app)/tours`                | same                                | **200**                                                  |
| GET    | `(app)/tours/[id]/workspace` | same + tour ACL                     | **200** · **403**                                        |
| GET    | `(app)/leader/review`        | admin/owner                         | **200** legacy URL alias → Command Center (`DEC-P9-011`) |
| GET    | `(app)/users`                | `isAdminOrOwner`                    | **200** · **403** member                                 |
| GET    | `(app)/bookings/new`         | `isAdminOrOwner`                    | **200**                                                  |
| GET    | `(app)/bookings`             | session                             | **200** ops (admin) · mine (member)                      |
| GET    | `(app)/bookings/[id]`        | session                             | **200** deep link + inspection panel                     |
| GET    | `(app)/settings/**`          | `isAdminOrOwner`                    | **200**                                                  |
| GET    | `app/finance` (interim)      | `isAdminOrOwner` + denali           | **200** · **404** non-denali (DEC-P9-017)                |
| GET    | `(app)/finance`              | `isAdminOrOwner` + denali workspace | **200** · **404** non-denali (target post-9.2)           |

Target guard: `apps/web/src/admin/require-operator-session.ts`

---

## Rate limits

| Route bucket               | Default RPM                               |
| -------------------------- | ----------------------------------------- |
| `POST /auth/request-otp`   | 10 per mobile per tenant                  |
| `POST /auth/verify-otp`    | 20 per challenge                          |
| Authenticated `(app)/` API | Inherited tenant tier limiter (Phase 7.6) |

---

## Wizard routing (DEC-P9-007 — outside `(app)/` group)

| METHOD | PATH         | ACTOR                  | GUARD                     | EXPECTED                            |
| ------ | ------------ | ---------------------- | ------------------------- | ----------------------------------- |
| GET    | `/tours/new` | Authenticated operator | Session required post-9.1 | **200** wizard                      |
| GET    | `/tours/new` | Anonymous              | Redirect login            | **302** `/auth/login?returnUrl=...` |

**Not used:** `(app)/tours/new` — forbidden duplicate (P9-F-004).

---

## Regression rows (Phase 8 — must stay)

| METHOD | PATH              | ACTOR | EXPECTED                     |
| ------ | ----------------- | ----- | ---------------------------- |
| PATCH  | `/urban/settings` | Admin | **403** URBAN_OWNER_REQUIRED |
| PATCH  | `/urban/settings` | Owner | **200**                      |

Run urban-owner bundle at **9.8** closure.
