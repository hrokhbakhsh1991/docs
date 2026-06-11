# Phase 9.4 — Users Directory implementation roadmap (promoted)

```yaml
roadmap_id: P9-USERS-DIRECTORY-ROADMAP
version: "2026-06-11-promoted"
status: CLOSED_ON_TRUNK
authority: USERS-DIRECTORY-UX.md · PHASE9-USERS-DIRECTORY-CLOSURE.md
decisions: [DEC-P9-018, DEC-P9-019]
```

> Promoted from `TEMP/phase9-users-directory-roadmap.md`. Behavioral closure ledger: [`PHASE9-USERS-DIRECTORY-CLOSURE.md`](PHASE9-USERS-DIRECTORY-CLOSURE.md).

## Architectural locks

| Lock | Rule |
| ---- | ---- |
| **DEC-P9-018** | `(app)/` panel + users API → **owner only** |
| **DEC-P9-019** | Team tiers: `owner` · `admin` · `member` · `viewer` |
| **INV-P9-006** | Users nav/route → **Denali plugin only** (mirror finance) |
| **RULE-P9-002** | Urban host → `403 USERS_WORKSPACE_FORBIDDEN` on `/users*` |
| **Layering** | RBAC rank in `users-rbac.policy.ts` · no `workspace-denali` import in identity |

## Rounds delivered (R0→R8)

| Round | Scope |
| ----- | ----- |
| R0 | Owner-only `(app)/` gate |
| R1 | Suspend / reactivate |
| R2 | Rewards parity + micro-badges + LEADER_BUDDY |
| R3 | Viewer invite/assign |
| R4 | Table · cursor scroll · sort · mobile sheet |
| R5 | Ownership transfer UI |
| R6 | Resend invite OTP |
| R7 | Activity history + booking summary drawer |
| R8 | Bulk suspend/reactivate/remove/role |

## Post-R8 polish

- Server-side `GET /users?status=`
- Mobile bulk row checkbox
- CASL `operator.users.*` → `isWorkspaceOwner`
- Membership audit `event_kind` for suspend · rewards · remove

## Open (Architect / 9.8)

- [ ] Architect sign-off → `VERIFIED_BEHAVIORAL` in IMPLEMENTATION-TRUTH
- [ ] Prisma identity production closure (`005` / migrate deploy at 9.8)
- [ ] Finance wire for `permanentDiscountPercentage` (9.7)
