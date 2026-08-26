# Phase 9.4 — Users Directory closure ledger

```yaml
closure_id: P9-USERS-DIRECTORY-CLOSURE
version: "2026-06-11-v5"
status: READY_FOR_ARCHITECT
authority: TEMP/phase9-users-directory-roadmap.md · USERS-DIRECTORY-UX.md v2026-06-11-v2
decisions: [DEC-P9-018, DEC-P9-019]
```

## Behavioral rounds (R0→R8)

| Round | Scope | Trunk |
| ----- | ----- | ----- |
| R0 | Owner-only `(app)/` gate | ✅ |
| R1 | Suspend / reactivate | ✅ |
| R2 | Rewards parity + row micro-badges + LEADER_BUDDY toggle | ✅ |
| R3 | Viewer invite/assign | ✅ |
| R4 | Table · cursor scroll · sort · mobile sheet · invite preview | ✅ |
| R5 | Ownership transfer UI | ✅ |
| R6 | Resend invite OTP | ✅ |
| R7 | Role history + booking summary drawer | ✅ |
| R8 | Bulk suspend/reactivate/remove/role | ✅ |

## Verification

| Layer | Artifacts |
| ----- | --------- |
| API | `identity-users.spec.ts` · `users-bulk.spec.ts` · `users-role-history.spec.ts` · `users-resend-invite.spec.ts` · `users-directory-sort.spec.ts` · `users-urban-regression.spec.ts` (API-9.4-URB) |
| Web | `users-directory.spec.ts` (WEB-9.4-25..28) · `users-rewards-logic.spec.ts` · `users-ownership-transfer.spec.ts` · `admin-shell-access.spec.ts` (CP-9.2-10) |
| SDK | `operator-ability.spec.ts` (SDK-9.4-01/02 · `isWorkspaceOwner` on `operator.users.*`) |
| E2E | `SMK-P9-03` · `SMK-P9-USERS-01..04` in `operator-smoke.spec.ts` — **4/4 PASS** (`--grep SMK-P9-USERS`, 2026-06-11) |
| Doc gate | `pnpm run phase-9:guard` — 32/32 (2026-06-11) |

**E2E fixes (2026-06-11):** bulk row checkboxes use native `onChange` (ui-primitives Checkbox); USERS-03 waits for roster `option[value=adminId]` before `selectOption`.

## Smoke fixture (`OPERATOR_SMOKE_E2E_SEED=1`)

When operator smoke boots the API, tenant `…000014` seeds:

| User | Mobile | Role | Display name |
| ---- | ------ | ---- | ------------ |
| Owner | `09174070937` | owner | (phone fallback) |
| Admin | `+15550001002` | admin | Smoke Admin |
| Member | `+15550001003` | member | Smoke Member |

Invitee `+15550008803` remains membership-free until SMK-P9-03 accept.

## Enterprise isolation (2026-06-11-v4)

| Layer | Invariant |
| ----- | --------- |
| `workspace-sdk` | `operator.users.*` → `isWorkspaceOwner` only (DEC-P9-018) — admin CASL grant removed |
| API | `assertOperatorUsersWorkspace` blocks **urban** host before roster I/O (RULE-P9-002 · mirror settings guard) |
| Web nav + route | `shouldShowUsersNav` / `isUsersRouteAllowed` — Denali plugin only (INV-P9-006 · mirror finance) |
| Identity module | Tenant-scoped RBAC in `users-rbac.policy.ts` — **no** `@app-tour/workspace-denali` import |

## Post-R8 polish (2026-06-11-v3)

| Item | Trunk |
| ---- | ----- |
| Server-side `GET /users?status=` | ✅ API filter before cursor |
| Mobile bulk row checkbox | ✅ `UsersDirectoryMobileCard` shares `rowSelect` landmark |

## R7+ membership audit (2026-06-11-v5)

| Mutation | `eventKind` | Stored values |
| -------- | ----------- | ------------- |
| PATCH role | `role_change` | `oldRole` / `newRole` team tier |
| Suspend / reactivate | `status_change` | `ACTIVE` ↔ `SUSPENDED` |
| PATCH rewards | `rewards_change` | `oldRole=rewards` · `newRole=updated` |
| DELETE / bulk remove | `member_removed` | `oldRole=<tier>` · `newRole=REMOVED` |

Prisma: `operator_user_role_audit.event_kind` (default `role_change`).

## Residual (out of 9.4 closure)

- Prisma `005_identity_production_delta` — production persistence path
- Finance pricing wire for `permanentDiscountPercentage` (9.7)

## Architect sign-off

- [x] Promote TEMP roadmap → [`PHASE9-USERS-DIRECTORY-ROADMAP.md`](PHASE9-USERS-DIRECTORY-ROADMAP.md)
- [ ] Mark subphase 9.4 **VERIFIED_BEHAVIORAL** in IMPLEMENTATION-TRUTH after review
