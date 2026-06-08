# Operator product scope — Phase 9 delta

```yaml
scope_version: "2026-06-08-v5"
decision: [DEC-P9-002, DEC-P9-008, DEC-P9-014]
baseline: docs/phase-6/subphases/6.5-bootstrap.md
primary_workspace: denali
plugin_package: "@app-tour/workspace-denali"
prisma_schema: apps/api/prisma/schema.prisma
migrations:
  - infra/sql/005_identity_production_delta.sql
  - infra/sql/006_operator_bookings_delta.sql
parity_target: full legacy (app)/ tree — excluding (public)/ and deploy split
```

## Intent

Phase 6 delivered Denali wizard + finance outbox consumer. Phase 8 delivered Urban public/owner product (if closed). Phase 9 extends trunk with **full legacy operator `(app)/` surface** for Denali tenants.

**DEC-P9-008:** All admin-panel gaps previously labeled «Phase 10+» or «optional» are **in scope for Phase 9 closure** — assigned to subphases 9.3–9.7 below. Phase 9.8 gate proves **full `(app)/` route inventory parity**, not a minimal smoke subset only.

**Forbidden:** Finance hooks in `@app-tour/workspace-urban` (DEC-P7-002 carryover).

---

## full_app_parity_inventory vs legacy `(app)/`

| Feature                           | Legacy path                                         | Phase 9 subphase | Trunk target                                              |
| --------------------------------- | --------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| Login OTP                         | `auth/login`                                        | 9.1              | `apps/web/app/auth/login`                                 |
| Dashboard                         | `(app)/dashboard`                                   | 9.2              | `(app)/dashboard`                                         |
| Tour list + filters               | `(app)/tours`                                       | 9.3              | `(app)/tours` · [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md)    |
| Tour workspace                    | `(app)/tours/[id]/workspace`                        | 9.3              | `(app)/tours/[id]/workspace`                              |
| Tour workspace waitlist           | `(app)/tours/[id]/workspace/waitlist`               | 9.3 · 9.5        | same                                                      |
| Tour workspace transport          | `(app)/tours/[id]/workspace/transport`              | 9.3              | same                                                      |
| Tour edit                         | `(app)/tours/[id]/edit`                             | 9.3              | `(app)/tours/[id]/edit`                                   |
| Operator tour registration        | `(app)/tours/[id]/register`                         | 9.3 · 9.5        | same                                                      |
| Legacy `/leader/review` URL alias | `(app)/leader/review`                               | **9.5**          | DEC-P9-011 → Command Center shell · actor `admin`/`owner` |
| New tour wizard                   | `/tours/new` (Phase 6)                              | 9.3 · 9.6        | nav link + legacy field profile                           |
| Users directory                   | `(app)/users`                                       | 9.4              | `(app)/users`                                             |
| Pending invites                   | `(app)/users` (pending tab)                         | 9.4              | `(app)/users`                                             |
| Users CSV export                  | `(app)/users` toolbar                               | 9.4              | client-side export                                        |
| User remove / deactivate          | `(app)/users` row actions                           | 9.4              | `DELETE /users/{id}`                                      |
| User rewards                      | `(app)/users` rewards modal                         | 9.4              | rewards API adapter                                       |
| Bookings queue (Command Center)   | `(app)/bookings`                                    | 9.5              | `(app)/bookings` · DEC-P9-011                             |
| Manual booking create             | `(app)/bookings/new`                                | 9.5              | `(app)/bookings/new`                                      |
| Booking detail + approve          | `(app)/bookings/[id]`                               | 9.5              | `(app)/bookings/[id]`                                     |
| Settings hub                      | `(app)/settings`                                    | 9.6              | `(app)/settings`                                          |
| Tour wizard template              | `(app)/settings/tour-wizard-template`               | 9.6              | same                                                      |
| Tour form defaults / presets      | `(app)/settings/tour-form-defaults`                 | 9.6              | same                                                      |
| Advanced tour presets             | `(app)/settings/tour-presets/advanced`              | 9.6              | same                                                      |
| Guide languages                   | `(app)/settings/guide-languages`                    | 9.6              | same                                                      |
| Equipment                         | `(app)/settings/equipment`                          | 9.6              | same                                                      |
| Tour themes                       | `(app)/settings/tour-themes`                        | 9.6              | same                                                      |
| Locations                         | `(app)/settings/locations`                          | 9.6              | same                                                      |
| Audit trail                       | `(app)/settings/audit-trail`                        | 9.6              | same                                                      |
| Finance overview                  | `app/finance` command center (interim · DEC-P9-017) | 9.7              | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md)                  |
| Finance target route              | `(app)/finance`                                     | 9.2+             | migrate when admin shell lands                            |
| Prepayment + installments         | `?tab=prepayments` · `installments`                 | 9.7 R2-R3        | same                                                      |
| Reconciliation triage             | `(app)/settings/reconciliation-triage`              | 9.7              | same                                                      |

**Not ported (alias only):** `(app)/tours/create` → use `/tours/new` (DEC-P9-007).

---

## Parity completion matrix (subphase ownership)

```text
9.3  tours list · workspace · waitlist · transport · register · wizard nav
9.4  directory · invites · role · CSV · remove · rewards
9.5  Command Center · queue · detail · approve/reject/bulk · manual create · `/leader/review` URL alias · waitlist promotion
9.6  settings hub · all config modules · audit trail
9.7  finance command center · prepayment · installments · reconciliation triage
9.8  full route contract + SMK-P9-01..08 + phase-9.contract.spec.ts
```

---

## Bookings schema delta (`006_operator_bookings_delta.sql`)

| Table / column                    | Purpose                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `registrations`                   | Operator-managed booking records (extends or aligns with Phase 8 urban_registrations where workspace=urban) |
| `registration_status`             | `pending \| approved \| rejected \| waitlisted \| cancelled`                                                |
| `idx_registrations_tenant_status` | List queue O(log N)                                                                                         |

**DEC-P9-006:** Public POST intake = Phase 8; Phase 9 adds **operator transition** APIs and **manual create** (`bookings/new`).

---

## Denali plugin extensions (9.3, 9.7)

| Extension                  | Package path                                      | Notes                                               |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| Tour list filters          | `packages/workspaces/denali/src/composites/`      | Admin list cards                                    |
| Transport ops composites   | `packages/workspaces/denali/src/composites/`      | Workspace transport tab                             |
| Booking status hooks       | `packages/workspaces/denali/src/validationHooks/` | Approve/reject validation                           |
| Finance ledger UI payloads | `packages/workspaces/denali/src/finance/`         | Reuse Phase 6 outbox types                          |
| Leader review payloads     | `packages/workspaces/denali/src/composites/`      | Inspection summary cards (Command Center · **9.5**) |

**Zero diff** in `packages/platform-core`.

---

## Workspace routing

| Host fixture         | Workspace | Phase 9 primary flows              |
| -------------------- | --------- | ---------------------------------- |
| `denali.localhost`   | denali    | 9.3–9.7 SMK-P9                     |
| `urban.localhost`    | urban     | Regression only — Phase 8 surfaces |
| `tenant-a.localhost` | starter   | Out of scope                       |

---

## Verification bundles

| Subphase | Command bundle                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 9.3      | `pnpm --filter @apps/api test tours-operator.spec.ts`                                                                  |
| 9.4      | `pnpm --filter @apps/api test identity-users.spec.ts` · `apps/web/test/users-directory.spec.ts`                        |
| 9.5      | `pnpm --filter @apps/api test bookings-ops.spec.ts` · `bookings-command-center.spec.ts` · SMK-P9-06                    |
| 9.6      | `pnpm --filter @apps/api test settings-modules.spec.ts` · `settings-audit-trail.spec.ts`                               |
| 9.7      | `pnpm --filter @app-tour/workspace-denali test finance-admin.spec.ts` · `finance-ops.spec.ts` · `finance-page.spec.ts` |
| 9.8      | `pnpm --filter @apps/web run test:e2e:operator` · `phase-9.contract.spec.ts`                                           |

---

## permanent_out_of_scope (non-admin — Phase 10+ only)

These items are **not** operator `(app)/` admin panel — remain outside Phase 9:

| Item                              | Reason                                            | Owner              |
| --------------------------------- | ------------------------------------------------- | ------------------ |
| `(public)/catalog/**`             | Marketing funnel — Urban Phase 8 or Marketing app | Phase 10 Marketing |
| `apps/marketing` separate deploy  | MAP §3.5 deploy split                             | Phase 10           |
| SEO / blog / public Marketing CMS | Not operator admin                                | Phase 10           |
| Three-repo deploy split           | Infrastructure phase                              | Phase 10+          |
| CDC / data warehouse              | Platform infra                                    | Phase 10+          |
| WASM sandbox · AI/chat            | Platform extensibility                            | Phase 10+          |
| Database-per-tenant for all       | Infra scale-out                                   | Phase 10+          |

**Forensic rule (9.8):** `phase-9.contract.spec.ts` asserts **every row** in `full_app_parity_inventory` has a trunk route or explicit DEC alias. SMK-P9-01..08 cover critical paths; contract spec covers full inventory.

---

## Wizard routing (DEC-P9-007)

| URL                  | Layout                                  | Session guard            | Notes                                                                               |
| -------------------- | --------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `/tours/new`         | Root `apps/web/app/tours/new` (Phase 6) | Required post-9.1        | Canonical wizard — **not** moved to `(app)/tours/new`                               |
| `(app)/tours`        | `(app)/layout.tsx`                      | `requireOperatorSession` | List links **out** to `/tours/new`                                                  |
| Wizard field profile | Phase 6 engine + 9.6 template           | Session                  | Legacy `WorkspaceTourWizard` field parity via denali types — not a duplicate engine |
