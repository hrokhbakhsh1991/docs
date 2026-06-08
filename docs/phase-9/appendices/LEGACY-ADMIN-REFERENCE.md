# Legacy admin reference (operator `(app)/` tree)

```yaml
reference_version: "2026-06-08-v2"
decision: [DEC-P9-001, DEC-P9-008]
non_authoritative_for_execution: true
port_target: apps/web/app/(app)/
parity_mode: full_app_parity_inventory
```

## Critical distinction

| Concept          | Legacy                                             | Phase 9 trunk                                                  |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Operator UI      | `legacy/apps/web/app/(app)/` single Next.js app    | Same route group in `apps/web/app/(app)/` — **full inventory** |
| Public marketing | `legacy/apps/web/app/(public)/`                    | **Out of Phase 9 scope** — Phase 10 Marketing                  |
| Auth             | `legacy/apps/web/app/auth/` + Nest identity module | `apps/web/app/auth/` + `apps/api/src/identity/**`              |
| Finance          | `legacy/apps/web/app/(app)/finance/`               | 9.7 Denali adapter + reconciliation triage                     |

## Legacy paths (reference only — port semantics)

| Path                                                       | Feature                          | Phase 9 subphase                                       |
| ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `legacy/apps/web/app/auth/login/`                          | OTP login                        | **9.1, 9.2**                                           |
| `legacy/apps/web/app/(app)/dashboard/`                     | Dashboard shell                  | **9.2**                                                |
| `legacy/apps/web/app/(app)/tours/`                         | List, edit, workspace            | **9.3** · list: [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) |
| `legacy/apps/web/app/(app)/tours/[id]/workspace/waitlist`  | Waitlist tab                     | **9.3, 9.5**                                           |
| `legacy/apps/web/app/(app)/tours/[id]/workspace/transport` | Transport ops                    | **9.3**                                                |
| `legacy/apps/web/app/(app)/tours/[id]/register`            | Operator registration            | **9.3, 9.5**                                           |
| `legacy/apps/web/app/(app)/leader/review/`                 | Leader inspection (legacy URL)   | **9.5** alias → Command Center (`DEC-P9-011`)          |
| `legacy/apps/web/app/(app)/users/`                         | Directory, invites, CSV, rewards | **9.4**                                                |
| `legacy/apps/web/app/(app)/bookings/`                      | Booking ops                      | **9.5**                                                |
| `legacy/apps/web/app/(app)/bookings/new`                   | Manual create                    | **9.5**                                                |
| `legacy/apps/web/app/(app)/settings/`                      | Hub + all modules                | **9.6**                                                |
| `legacy/apps/web/app/(app)/settings/audit-trail`           | Audit read surface               | **9.6**                                                |
| `legacy/apps/web/app/(app)/finance/`                       | Payments, receipts               | **9.7**                                                |
| `legacy/apps/web/app/(app)/settings/reconciliation-triage` | Finance triage                   | **9.7**                                                |

## Legacy paths — tours list (9.3 list port)

| Legacy file                                    | Port target                           | Notes                        |
| ---------------------------------------------- | ------------------------------------- | ---------------------------- |
| `legacy/apps/web/app/(app)/tours/page.tsx`     | `apps/web/app/(app)/tours/page.tsx`   | RSC wrapper                  |
| `legacy/.../tours-page-client.tsx`             | `tours-page-client.tsx`               | page chrome + CTA            |
| `legacy/.../tours-list-view.tsx`               | `tours-list-view.tsx`                 | filters · sort · pagination  |
| `legacy/.../_hooks/query-model.ts`             | `_hooks/query-model.ts`               | URL SoT — verbatim semantics |
| `legacy/.../_hooks/use-tours-query-params.ts`  | `_hooks/use-tours-query-params.ts`    | debounce 300ms               |
| `legacy/.../_hooks/use-tours-data.ts`          | `_hooks/use-tours-data.ts`            | `view=operator` fetch        |
| `legacy/.../components/TourList.tsx`           | `components/tour-list.tsx`            | grid wrapper                 |
| `legacy/.../src/components/tours/TourCard.tsx` | `components/tour-card.tsx`            | ui-primitives port           |
| `legacy/.../tour-status-badge.tsx`             | `tour-status-badge.tsx`               | `uiStatus` badge             |
| `legacy/apps/api/.../list-tours-query.dto.ts`  | `list-tours-query.ts` operator branch | DEC-P9-014                   |

## Auth & login (legacy → trunk)

| Legacy                                                                | Trunk                                       | Subphase |
| --------------------------------------------------------------------- | ------------------------------------------- | -------- |
| `legacy/apps/web/app/auth/login/login-form.tsx`                       | `apps/web/app/auth/login/` two-step OTP     | **9.1**  |
| `legacy/apps/web/app/login/page.tsx`                                  | `/login` alias                              | **9.1**  |
| `legacy/apps/web/app/api/auth/request-otp`                            | same BFF path                               | **9.1**  |
| `legacy/apps/web/app/api/auth/login-web-session`                      | same BFF path                               | **9.1**  |
| `legacy/apps/web/app/api/auth/membership-ability-context`             | → `GET /auth/ability-context`               | **9.1**  |
| `legacy/apps/web/middleware.ts`                                       | `apps/web/middleware.ts`                    | **9.1**  |
| `legacy/apps/web/lib/auth/build-session-cookie.ts`                    | `apps/web/lib/auth/build-session-cookie.ts` | **9.1**  |
| `legacy/apps/api/src/modules/auth/auth.controller.ts`                 | `apps/api/src/identity/auth.routes.ts`      | **9.1**  |
| `legacy/apps/api/src/modules/auth/otp.service.ts`                     | `apps/api/src/identity/otp.service.ts`      | **9.1**  |
| `legacy/apps/api/src/modules/identity/entities/user-tenant.entity.ts` | Prisma `UserTenant.sessionVersion`          | **9.1**  |

Authority: [`OPERATOR-LOGIN-FLOW.md`](OPERATOR-LOGIN-FLOW.md) · DEC-P9-012

## API reference (identity)

| Legacy module                                                     | Trunk target                                       |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `legacy/apps/api/src/modules/identity/auth.controller.ts`         | `apps/api/src/identity/auth.routes.ts`             |
| `legacy/apps/api/src/modules/identity/users-access.service.ts`    | `apps/api/src/identity/users.service.ts`           |
| `legacy/apps/api/src/modules/identity/workspace-users.service.ts` | `apps/api/src/identity/workspace-users.service.ts` |

## Anti-patterns (do not replicate)

| Pattern                                         | Why forbidden                          |
| ----------------------------------------------- | -------------------------------------- |
| Runtime `import` from `legacy/`                 | INV-P9-004                             |
| Copy Nest `@Controller` tree verbatim           | DEC-P9-003 — use Fastify route modules |
| TypeORM entities in trunk                       | Prisma only                            |
| Finance logic in `apps/api/src/modules/finance` | INV-P9-006 — denali plugin + adapters  |
| Defer admin `(app)/` page to Phase 10+          | DEC-P9-008 — assign to 9.3–9.7         |

## Verification

- RULE-P9-001 — no legacy runtime import
- REQ-P9-007 — legacy path inventory cited in OPERATOR-PRODUCT-SCOPE `full_app_parity_inventory`
- DEC-P9-008 — `phase-9.contract.spec.ts` route inventory
