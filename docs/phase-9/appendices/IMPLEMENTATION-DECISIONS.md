# Phase 9 — Implementation decisions (agent SoT)

```yaml
decision_doc_version: "2026-06-08-v4"
extends_pek: docs/phase-8/appendices/IMPLEMENTATION-DECISIONS.md
route_matrix: appendices/ADMIN-ROUTE-MATRIX.md
identity_scope: appendices/IDENTITY-PORT-SCOPE.md
operator_scope: appendices/OPERATOR-PRODUCT-SCOPE.md
```

> Resolves ambiguities before operator admin code. **If conflict, this file wins** for Phase 9. Status **LOCKED** decisions require Architect waiver to change.

---

## DEC-P9-001 — Admin-first: defer Marketing, ship `(app)/` in single shell

```yaml
id: DEC-P9-001
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.0
invariants: [INV-P9-007]
```

### Context

MAP §3.5 defines three deployable apps per tenant. Phase 4–8 honestly deferred deploy split. Product priority: **operator/admin must work end-to-end** before public Marketing funnel investment.

### Decision

1. Phase 9 delivers **Admin-Panel + User-Portal operator flows** inside existing `apps/web` via `(app)/` route group.
2. **No** `apps/marketing` repo in Phase 9.
3. Public Urban catalog from Phase 8 remains separate under `(public)/` if implemented — Phase 9 does not expand it.

### Consequences

| Pro                                     | Con                                                            |
| --------------------------------------- | -------------------------------------------------------------- |
| One demo tenant fully operable on trunk | Deploy isolation (SEO/security) still deferred                 |
| Matches legacy `(app)/` port path       | Route collision discipline required (`/tours/new` vs `/tours`) |

---

## DEC-P9-002 — Denali-first operator MVP

```yaml
id: DEC-P9-002
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.3
invariants: [INV-P9-006]
```

### Context

Denali has Phase 6 wizard + finance outbox slice. Urban has Phase 8 owner-only admin. Full legacy `(app)/` maps primarily to **Denali tour-ops** semantics.

### Decision

1. Subphases **9.3–9.7** primary workspace: **`denali`** tenant fixtures.
2. Urban operator surfaces **do not expand** beyond Phase 8 closure — regression tests only at 9.8.
3. Finance (9.7) is **Denali workspace only** — forbidden in `@app-tour/workspace-urban`.

---

## DEC-P9-003 — Identity port: Prisma + Fastify, not Nest lift-and-shift

```yaml
id: DEC-P9-003
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.1
invariants: [INV-P9-003, INV-P9-004]
rules: [RULE-P9-001]
```

### Context

Legacy identity lives in NestJS + TypeORM (`legacy/apps/api/src/modules/identity/`). Trunk uses Fastify ingress + Prisma + tenant-kernel ALS.

### Decision

1. Port **semantics** (OTP challenge, session cookie, membership verify) — not module structure.
2. New code under `apps/api/src/identity/**` — flat modules, no `modules/identity` Nest tree copy.
3. Prisma models replace TypeORM entities — see [`IDENTITY-PORT-SCOPE.md`](IDENTITY-PORT-SCOPE.md).

---

## DEC-P9-004 — Denali operator RBAC: restore `isAdminOrOwner`

```yaml
id: DEC-P9-004
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.4
invariants: [INV-P8-007]
```

### Context

Phase 8 DEC-P8-001 restricts Urban config to **owner only**. Legacy Denali/starter grants **admin** users configuration rights via `isAdminOrOwner`.

### Decision

| Workspace   | Operator admin surfaces                   | Grant function                          |
| ----------- | ----------------------------------------- | --------------------------------------- |
| **urban**   | settings, catalog admin                   | `isWorkspaceOwner` only — **no change** |
| **denali**  | tours, users, settings, bookings, finance | `isAdminOrOwner` + role CASL            |
| **starter** | unchanged                                 | Phase 3 reference                       |

Phase 9 MUST NOT apply `isAdminOrOwner` to Urban owner surfaces (INV-P8-007 regression).

---

## DEC-P9-005 — Settings hot reload: unified tenant theme + module flags

```yaml
id: DEC-P9-005
status: APPROVED
locked: false
date: 2026-06-08
phase: 9.6
```

### Context

Legacy `tenant-config` + `enabled_modules` can desync (DELTA-NP-08/09/11). Wizard template seed reads tenant theme JSON.

### Decision

1. `PATCH` settings modules invalidate tenant config cache (Redis or in-process TTL documented in COP).
2. Template seed fields live in `Tenant.theme` JSON — validated by workspace-sdk types.
3. No second shadow config store in web RHF.

---

## DEC-P9-006 — Bookings ops vs public registration

```yaml
id: DEC-P9-006
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.5
```

### Context

Phase 8 Urban `POST /urban/registrations` is **anonymous public intake**. Legacy `(app)/bookings` is **operator workflow** on existing registrations.

### Decision

1. Phase 9.5 ports **operator booking management** — list, detail, approve, reject, waitlist promotion.
2. Public registration intake remains Phase 8 Urban surface — Phase 9 may **read** those records in bookings ops but does not re-implement public POST.
3. Denali workspace bookings schema: see [`OPERATOR-PRODUCT-SCOPE.md`](OPERATOR-PRODUCT-SCOPE.md) DDL `005_operator_bookings_delta.sql`.

---

## Decision index

| ID         | Title                                     | Locked |
| ---------- | ----------------------------------------- | ------ |
| DEC-P9-001 | Admin-first single shell                  | yes    |
| DEC-P9-002 | Denali-first MVP                          | yes    |
| DEC-P9-003 | Prisma identity port                      | yes    |
| DEC-P9-004 | Denali isAdminOrOwner                     | yes    |
| DEC-P9-005 | Settings hot reload                       | no     |
| DEC-P9-006 | Bookings ops vs public intake             | yes    |
| DEC-P9-007 | Wizard at `/tours/new` root               | yes    |
| DEC-P9-008 | Full `(app)/` parity inside Phase 9       | yes    |
| DEC-P9-009 | Settings Module Registry                  | yes    |
| DEC-P9-010 | Hybrid settings storage model             | yes    |
| DEC-P9-011 | Registration Command Center               | yes    |
| DEC-P9-012 | Operator login legacy parity              | yes    |
| DEC-P9-013 | Mobile-first admin shell on Phase 2 stack | yes    |
| DEC-P9-014 | Operator tours list projection API        | yes    |
| DEC-P9-015 | Three-tier workspace RBAC                 | yes    |
| DEC-P9-016 | Progressive Finance Command Center        | yes    |
| DEC-P9-017 | Interim finance route until 9.2 shell     | yes    |

## DEC-P9-009 — Settings Module Registry (manifest-driven 9.6)

```yaml
id: DEC-P9-009
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.6
invariants: [INV-P9-001, INV-P9-003, INV-P9-007]
authority: appendices/SETTINGS-MODULE-REGISTRY.md
risk_register: appendices/SETTINGS-RISK-REGISTER-P9.md
```

### Context

Legacy settings use hardcoded hub/subnav and duplicated CRUD panels (~64 files). Phase 9 requires full `(app)/` parity (DEC-P9-008) without lift-and-shift. Industry pattern: manifest registry validates modules before routing ([AuditBuffet AB-002090](https://auditbuffet.com/patterns/ab-002090)).

### Decision

1. **Registry:** Denali declares settings modules in `packages/workspaces/denali/src/settings/denali-settings.manifest.ts`.
2. **SDK:** Optional `WorkspacePlugin.operatorSettings` with `validateSettingsManifest()` at load — **non-breaking** optional field.
3. **API:** Unknown `moduleId` → **404** `SETTINGS_MODULE_UNKNOWN` before database access (R-P9-S07).
4. **Web:** Dynamic nav from manifest; `(app)/settings/**` remains thin; logic in `apps/web/src/features/settings/`.
5. **Urban:** Empty or owner-only manifest entries — Denali modules **not** shown on urban host (RULE-P9-002).

### Verification

- [`SETTINGS-MODULE-REGISTRY.md`](SETTINGS-MODULE-REGISTRY.md)
- [`SETTINGS-RISK-REGISTER-P9.md`](SETTINGS-RISK-REGISTER-P9.md)
- Guard: `p9_settings_registry_pack`

---

## DEC-P9-010 — Hybrid settings storage (normalized catalog + versioned config)

```yaml
id: DEC-P9-010
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.6
invariants: [INV-P9-003, TQ-P9-005]
authority: appendices/SETTINGS-MODULE-REGISTRY.md §4
closes_risks: [R-P9-S01, R-P9-S02, R-P9-S03]
```

### Context

Generic JSON tables seduce fast delivery but break FK integrity for tour catalog references ([Voxire JSONB SaaS](https://voxire.com/blog/postgresql-jsonb-vs-relational-saas-go/)). Unversioned JSONB breaks wizard template evolution ([JSONB versioning](https://danlevy.net/the-jsonb-seduction/)).

### Decision

1. **`reference_data` modules** → **normalized Prisma entities** per catalog type with `tenant_id`, indexes, and FK where tours reference ids.
2. **`tenant_config` modules** → table `tenant_config(tenant_id, config_key, config_version, payload jsonb)` with Zod validation and per-key migration functions.
3. **Forbidden:** single catch-all `tenant_reference_items` JSON table for destinations/equipment in Phase 9.6.
4. **Promotion rule:** if a JSONB path becomes a filter/sort hot path, promote to column in next migration — document in COP 9.6.

### Verification

- `settings-resources.spec.ts` — FK round-trip for destination + theme
- `settings-config-version.spec.ts` — reject unsupported config_version
- Migration `007_operator_settings_delta.sql` cited in subphase 9.6

---

## DEC-P9-008 — Full legacy `(app)/` parity within Phase 9 (not Phase 10+)

```yaml
id: DEC-P9-008
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.3–9.8
invariants: [INV-P9-001, INV-P9-007]
supersedes: OPERATOR-PRODUCT-SCOPE explicit_out_of_scope admin deferrals
```

### Context

Prior doc pack (`scope_version: v2`) deferred leader review, audit trail, reconciliation triage, optional settings modules, transport ops, manual booking create, and users extras to «Phase 10+» or «optional». Product intent: **close all admin-panel gaps in Phase 9** — not a follow-on phase.

### Decision

1. **Full `(app)/` inventory** in [`OPERATOR-PRODUCT-SCOPE.md`](OPERATOR-PRODUCT-SCOPE.md) `full_app_parity_inventory` is **in scope** for Phase 9.3–9.7.
2. **Subphase assignment:** transport + leader review → 9.3; users CSV/remove/rewards → 9.4; `bookings/new` → 9.5; all settings modules + audit trail → 9.6; reconciliation triage → 9.7.
3. **9.8 closure:** `phase-9.contract.spec.ts` asserts full route inventory; SMK-P9 extended to **01..08** (critical paths).
4. **Still out of Phase 9:** `(public)/catalog/**`, Marketing deploy split, CDC/WASM/AI — see `permanent_out_of_scope` in OPERATOR-PRODUCT-SCOPE.
5. **Forbidden:** re-deferring admin `(app)/` pages to Phase 10+ without Architect COP waiver.

### Verification

- `OPERATOR-PRODUCT-SCOPE.md` — `scope_version: v3` · `full_app_parity_inventory`
- `phase-9.contract.spec.ts` — route inventory assertion
- SMK-P9-06..08 in [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)

---

## DEC-P9-011 — Registration Command Center + ops manifest (bookings UX)

```yaml
id: DEC-P9-011
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.5
invariants: [INV-P9-001, INV-P9-005, TQ-P9-006]
authority: appendices/BOOKINGS-OPS-UX.md
pattern: DEC-P9-009 (settings registry)
```

### Context

Legacy operator approval lives in `leader/review` (multi-tour KPI + inspection panel) while `(app)/bookings` serves participant self-service. Lift-and-shifting both trees duplicates logic and blocks workspace-specific UX (Urban vs Denali). Industry patterns ([approval queue](https://www.shadcn.io/blocks/crud-approval-queue), [kanban swimlanes](https://kanbantool.com/kanban-board-examples)) favor one inbox with view modes and bulk actions.

### Decision

1. **`(app)/bookings`** becomes the **Registration Command Center** for admin/owner — KPI strip, tour chips, manifest-driven views (`inbox_table` | `tour_board` | `departure_timeline`).
2. **`RegistrationOpsManifest`** in `packages/workspaces/denali/src/bookings/` — validated at plugin load via optional `WorkspacePlugin.registrationOps` (non-breaking SDK extension).
3. **`(app)/leader/review`** is an **alias** to the same shell (`view=inbox_table&scope=leader`) — **forbidden:** second approve implementation tree.
4. **Members** on `/bookings` receive **`view=mine`** only — full tenant queue requires `operator.bookings.approve`.
5. **API** extends list with filters + `GET /bookings/summary` + optional `POST /bookings/bulk-approve` — approve/reject outbox rules unchanged (DEC-P9-006 · P9-F-006).
6. **MVP closure:** `inbox_table` + inspection panel required; board/timeline optional before 9.8 per subphase CP-9.5-09.

### Verification

- [`BOOKINGS-OPS-UX.md`](BOOKINGS-OPS-UX.md)
- [`TRACEABILITY-MATRIX-9.5.md`](TRACEABILITY-MATRIX-9.5.md)
- `bookings-command-center.spec.ts` · `bookings-ops-manifest.spec.ts`
- Guard: `p9_bookings_ops_pack`

---

## DEC-P9-012 — Operator login legacy parity (JWT + BFF + two-step OTP)

```yaml
id: DEC-P9-012
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.1
invariants: [INV-P9-007, DELTA-NP-04]
authority: appendices/OPERATOR-LOGIN-FLOW.md
closes_gaps: [DELTA-NP-01, DELTA-NP-02]
```

### Context

Legacy admin login (`legacy/apps/web/app/auth/login/`) uses a **two-step phone+OTP UI**, **Next.js BFF** routes (`/api/auth/*`), **HttpOnly cookie `session`** (7d JWT), **localStorage Bearer mirror** for cross-port API, **membership-ability-context** hydrate after login, and **no server logout API**. Prior Phase 9.1 docs omitted BFF layer, used separate verify schema without `mobile`, implied `UserSession` DB store and API `/auth/logout` — all diverge from legacy.

### Decision

1. **UX parity:** Two-step login form · post-success redirect **`/dashboard`** · `returnUrl` support · onboarding redirect to `/auth/register`.
2. **BFF mandatory:** Cookie set only in `apps/web/app/api/auth/login-web-session` — see [`identity-web-bff-addendum.md`](identity-web-bff-addendum.md).
3. **API mapping:** Legacy combined `web/session/otp` → trunk `POST /auth/verify-otp` (verify + JWT issue in one handler).
4. **Session model:** **Stateless JWT** + `UserTenant.sessionVersion` (`sess_ver`) — **no** primary server session table (DEC-P9-012).
5. **Logout:** BFF `POST /api/auth/logout` clears cookie + localStorage — **no** required API revoke endpoint.
6. **Middleware:** `apps/web/middleware.ts` gates non-public routes; decode-only JWT at Edge; RS256 verify at API.
7. **Ability context:** `GET /auth/ability-context` required after login for nav/CASL (legacy `membership-ability-context`).
8. **Canonical login paths:** `/auth/login` + `/login` alias; middleware redirects to `/login`.

### Verification

- [`OPERATOR-LOGIN-FLOW.md`](OPERATOR-LOGIN-FLOW.md)
- [`identity-web-bff-addendum.md`](identity-web-bff-addendum.md)
- `auth-login-flow.spec.ts` · SMK-P9-01 cookie path
- Guard: `p9_identity_login_pack`

---

## DEC-P9-007 — Wizard canonical path `/tours/new` (not `(app)/tours/new`)

```yaml
id: DEC-P9-007
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.3
invariants: [INV-P9-005]
```

### Context

Phase 6 shipped Denali wizard at `apps/web/app/tours/new` **outside** `(app)/` route group. Legacy uses `(app)/tours/new`. Moving wizard under `(app)/` would duplicate engine wiring and break Phase 6 smoke (SMK-P6).

### Decision

1. **Canonical wizard URL:** `/tours/new` at repo root app tree — unchanged from Phase 6.
2. **Operator shell** `(app)/tours` list navigates via `<Link href="/tours/new">` — shared session cookie post-9.1.
3. Post-login wizard requires **same session** as `(app)/` — layout may wrap via middleware redirect, not duplicate wizard route.
4. **Forbidden:** second wizard at `(app)/tours/new` · **Forbidden:** platform-core move to support dual paths.

### Verification

- SMK-P9-02 uses `/tours/new`
- `CANLOAD-OPERATOR-SESSION.contract.ts` exports `OPERATOR_WIZARD_PATH`

---

## DEC-P9-013 — Mobile-first operator shell on Phase 2 stack (no Tailwind/shadcn pivot)

```yaml
id: DEC-P9-013
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.2
invariants: [INV-P9-007, TQ-P9-001, TQ-P9-003]
authority: appendices/ADMIN-SHELL-UX.md
closes_gaps: [DELTA-P9-SHELL-01]
```

### Context

Product requires a **production-grade** operator admin — mobile-first, modern visual language — not an MVP placeholder. Stakeholders asked about shadcn + Tailwind. Phase 2 locked **CSS Modules + `@app-tour/design-tokens`** with explicit **Tailwind ❌**. Trunk `apps/web` uses `@app-tour/ui-primitives` subpath imports with AST guards. Legacy admin uses `@tour/ui` + CSS Modules with mobile drawer at `48rem`. A shadcn install would introduce a second styling system, break theme cascade (platform → tenant → workspace), and force guard rewrites across Phase 2–6 surfaces.

### Decision

1. **Stack:** Operator shell built with **CSS Modules + design tokens + `@app-tour/ui-primitives` subpaths** — same as Phase 3 shell covenant.
2. **Mobile-first:** Author layout for `<768px` first — fixed header, hamburger → drawer overlay, `44px` tap targets (`--layout-min-tap-target`), RTL logical properties.
3. **Desktop:** Persistent sidebar `≥768px` (280px default); dashboard 2-column widget grid `≥1024px`.
4. **shadcn reference only:** [sidebar-07](https://ui.shadcn.com/blocks/sidebar-07) and [dashboard-01](https://ui.shadcn.com/blocks/dashboard-01) inform IA — **no** `npx shadcn` install, **no** Tailwind config in `apps/web`.
5. **Production dashboard in 9.2:** Widget grid with skeleton/empty states — not empty `<h1>Dashboard</h1>` (REQ-P9-020).
6. **Primitive promotion:** `Card`, `Sheet`, `Avatar` may start in `apps/web/src/admin/`; promote to `@app-tour/ui-primitives` when **≥3 consumers** (9.3+).
7. **Forbidden:** Tailwind classes in new `(app)/` or `src/admin/**` · `@tour/ui` runtime import · shadcn copy-paste components without token migration.

### Verification

- [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md)
- [`TRACEABILITY-MATRIX-9.2.md`](TRACEABILITY-MATRIX-9.2.md)
- `admin-shell-access.spec.ts` · `dashboard-smoke.spec.ts`
- Guard: `p9_admin_shell_pack` · `guard:import-boundary`

---

## DEC-P9-014 — Operator tours list projection (extend GET /tours)

```yaml
id: DEC-P9-014
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.3
invariants: [INV-P9-005, INV-P9-007, TQ-P9-004]
authority: appendices/TOURS-LIST-UX.md
extends: docs/phase-5/appendices/tours-list-endpoint.md
closes_gaps: [DELTA-NP-12-list]
```

### Context

Phase 5 shipped `GET /tours` as a **slim cursor index** (`id`, `tenantId`, `createdAt`, `rowVersion`) for scalability probes — intentionally **without** search, status filters, sort, or display fields ([`tours-list-endpoint.md`](../../phase-5/appendices/tours-list-endpoint.md) residual gap). Legacy operator list returns full `TourResponseDto` rows with offset pagination, search, status buckets (`active`/`completed`/`archived`), and sort. Gap analysis marks list+filter as **Dropped** on trunk. Operator admin (DEC-P9-008) requires production list UI — not N+1 `GET /tours/:id` per card (DEC-129 egress).

### Decision

1. **Dual view on one route:** `GET /tours?view=slim|operator` — **slim** preserves Phase 5 cursor contract; **operator** (default for authenticated operator session) returns `PaginatedTourListResponse` with `TourListProjection` items.
2. **Projection extraction:** Map each row's canonical document through **workspace plugin** `extractTourListProjection` — Denali paths documented in TOURS-LIST-UX §4.5; no hardcoded Denali paths in `apps/web`.
3. **Query parity:** `search`, `status`, `page`, `limit`, `sort_by`, `sort_dir`, `include_total` — legacy bucket semantics for status.
4. **No full canonical in list JSON** — use [`TOURS-LIST-PROJECTION.schema.json`](schemas/TOURS-LIST-PROJECTION.schema.json).
5. **`acceptedCount` stub:** return `0` until 9.5 registration index; UI shows capacity without accepted ratio until then.
6. **Backward compatibility:** `tours-list.spec.ts` (Phase 5) must stay green with `view=slim`.
7. **Web list:** URL-synced `TourListQueryModel` port from legacy; mobile-first card grid (DEC-P9-013).

### Verification

- [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md)
- [`TRACEABILITY-MATRIX-9.3.md`](TRACEABILITY-MATRIX-9.3.md)
- [`tours-operator-api-dispatch-addendum.md`](tours-operator-api-dispatch-addendum.md) v2
- `tours-operator.spec.ts` · `tours-list.spec.ts` · `tour-list-projection.spec.ts`
- Guard: `p9_tours_list_pack`

---

## DEC-P9-015 — Three-tier workspace RBAC (owner · admin · member)

```yaml
id: DEC-P9-015
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.4
invariants: [INV-P9-003, INV-P9-007, DEC-P9-004]
authority: appendices/USERS-DIRECTORY-UX.md
supersedes: legacy five-role persistence in Phase 9 operator surfaces
closes_gaps: [DELTA-P9-RBAC-01]
```

### Context

Legacy Denali persists **five** membership roles (`owner`, `leader`, `admin`, `member`, `viewer`) with rank `owner > leader > admin > member > viewer`. UI code further confuses naming: `isLeaderRole()` means **owner or admin**, not DB `leader`. Product intent for Phase 9: **exactly three** operator tiers — owner, admin, regular member. Stakeholders asked how to create “finance admin” and “tour admin”; legacy answers these via **role + tenant module**, not separate roles.

Gap: `9.4-users-rbac.md` referenced legacy “Leader access”; trunk `IDENTITY-PORT-SCOPE` already declared 3-tier enum but lacked UX authority and migration rules.

### Decision

1. **Persisted roles:** `UserTenant.role` ∈ `{ owner, admin, member }` only for Phase 9 operator product.
2. **Invite assignable:** `admin` \| `member` — **forbidden:** `owner` (ownership transfer flow), `leader`, `viewer`.
3. **Directory gate:** `(app)/users` requires `isAdminOrOwner` — members receive locked panel (not read-only directory).
4. **Tour admin:** `admin` or `owner` — `operator.tours.mutate` via existing CASL (no 4th role).
5. **Finance admin:** `admin` or `owner` when tenant `enabled_modules` includes `finance` — not a separate role.
6. **Legacy hydrate normalization** (session + API responses):
   - `leader` → `admin`
   - `viewer` → `member`
   - Optional one-time SQL coalesce in identity migration addendum.
7. **Role change:** PATCH allows `admin` \| `member` only; owner row protected; `sessionVersion` bump on change.
8. **Forbidden:** exposing `leader`/`viewer` in invite UI, role filter, or API enum after 9.4 closure.
9. **Urban regression unchanged:** owner-only surfaces stay `assertWorkspaceOwner` (RULE-P9-002).

### RBAC vocabulary (doc + smoke + route matrix)

`leader` and `viewer` are **legacy hydrate aliases only** — not persisted roles or actor labels in Phase 9 specs:

- **Actors in route matrix, smoke, and CASL:** `owner` \| `admin` \| `member` only.
- **Legacy DB values** at hydrate: `leader` → `admin` · `viewer` → `member` (rule 6 above).
- **`/leader/review` URL:** legacy path alias to the Registration Command Center (`DEC-P9-011`) — not a fourth RBAC tier. Gate with `admin`/`owner` (+ tour ACL where applicable).

### Verification

- [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md)
- [`TRACEABILITY-MATRIX-9.4.md`](TRACEABILITY-MATRIX-9.4.md)
- [`TRACEABILITY-MATRIX-9.5.md`](TRACEABILITY-MATRIX-9.5.md) · SMK-P9-06
- [`ADMIN-ROUTE-MATRIX.md`](ADMIN-ROUTE-MATRIX.md) · [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)
- [`BOOKINGS-OPS-UX.md`](BOOKINGS-OPS-UX.md) §7 CASL matrix
- [`users-api-dispatch-addendum.md`](users-api-dispatch-addendum.md) v2
- `identity-users.spec.ts` · `users-directory.spec.ts` · CP-9.4-09..11
- Guard: `p9_users_directory_pack`

---

## DEC-P9-016 — Progressive Finance Command Center (prepayment · installments · ledger)

```yaml
id: DEC-P9-016
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.7
invariants: [INV-P9-006, TQ-P9-006, DEC-P9-008]
authority: appendices/FINANCE-OPS-UX.md
extends: phase-6/subphases/6.4-finance-slice.md
closes_gaps: [DELTA-P9-FIN-01]
```

### Context

Stakeholders require finance to be among the **most advanced** product areas: prepayment, installment schedules, receipt workflows, ledger audit, reconciliation — not a minimal two-panel port. Current `9.7-finance-denali.md` listed only overview + triage; legacy already implements pricing, booking wallet prepayment ledger events, manual payments, receipt review, reports, and reconciliation explorer. Trunk has Phase 6 outbox slice only. Risk: bolting installments onto R1 blocks 9.8; risk: deferring design forces rewrite later.

### Decision

1. **Finance Command Center:** tabbed hub (overview · payments · receipts · prepayments · installments · ledger) — see FINANCE-OPS-UX §5. **Target route:** `(app)/finance` (DEC-P9-008). **R1 interim:** `app/finance` until 9.2 shell (DEC-P9-017).
2. **Progressive rounds:** R1 = legacy parity (required for 9.8 gate); R2 = prepayment + schedule persistence; R3 = installments UX + tour templates; R4 = ledger export stretch.
3. **Payment spine unchanged:** All journals via `finance.ledger.double_entry_applied` outbox — no Nest `modules/finance` tree (P9-F-008).
4. **Prepayment:** First-class — booking wallet credits surfaced via invoice read model (`paidAmountMinor` / `balanceDueMinor`).
5. **Installments:** `PaymentScheduleItem` schema locked in 9.7-R0; storage migration `008_finance_schedule_delta.sql` in R2; board UI in R3. Generator must satisfy `sum(amountMinor) === invoiceTotalMinor`.
6. **`FinanceOpsManifest`:** Denali plugin declares enabled panels + default installment template — mirror RegistrationOpsManifest (DEC-P9-011).
7. **Denali-only:** Urban finance routes **404** / nav hidden (INV-P9-006).
8. **Minor units only:** No float amounts in API or UI formatting layer.
9. **Forbidden:** shipping R1 as upload+review panels only without hub IA (AH-9.7-06).

### Verification

- [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md)
- [`TRACEABILITY-MATRIX-9.7.md`](TRACEABILITY-MATRIX-9.7.md)
- [`finance-api-dispatch-addendum.md`](finance-api-dispatch-addendum.md) v2
- [`FINANCE-RISK-REGISTER-P9.md`](FINANCE-RISK-REGISTER-P9.md)
- `finance-ops.spec.ts` · `finance-page.spec.ts` · CP-9.7-01..15
- Guard: `p9_finance_ops_pack`

---

## DEC-P9-017 — Interim finance route at `app/finance` until 9.2 shell

```yaml
id: DEC-P9-017
status: APPROVED
locked: true
date: 2026-06-08
phase: 9.7
invariants: [DEC-P9-008, INV-P9-006]
authority: appendices/FINANCE-OPS-UX.md
supersedes: none
closes_gaps: [DELTA-P9-FIN-PATH-01]
```

### Context

DEC-P9-008 targets `(app)/finance` under the admin shell. Trunk R1 landed finance at `apps/web/app/finance/` before subphase 9.2 `(app)/` layout exists. Boundary matrix and traceability referenced only `(app)/finance/**`, causing doc/code drift.

### Decision

1. **R1 interim:** Finance Command Center may ship at `apps/web/app/finance/**` with runtime gate (`isFinanceRouteAllowed` · Denali plugin only).
2. **Target:** Migrate to `apps/web/app/(app)/finance/**` when 9.2 admin shell lands — same component, new route group.
3. **Boundary matrix:** Both paths listed — interim allowed until 9.2 merge; target path remains canonical for 9.8 closure.
4. **Forbidden:** exposing finance nav or routes on urban/starter (unchanged · INV-P9-006).

### Verification

- [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §2.2 · §9
- [`PHASE-BOUNDARY-MATRIX.yaml`](PHASE-BOUNDARY-MATRIX.yaml) `subphase_9_7_boundaries`
- `apps/web/test/finance-page.spec.ts` · DEC-P9-017 cross-ref in subphase 9.7
