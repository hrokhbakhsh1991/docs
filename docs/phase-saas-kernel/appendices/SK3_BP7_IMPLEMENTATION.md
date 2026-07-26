# SK3 BP-7 — Portal member plan tables + entitlements webhook

```yaml
doc_id: SK3_BP7_IMPLEMENTATION
status: DONE
unlock: YES — IMPL-SK3-BP7
date: "2026-07-21"
tip_at_start: e4e58665
canonical_branch: booking/capacity-concurrency-cert
```

## Goal (MPS-ENT-001 §7 / SK3.C)

Close **BP-7** without shipping subscription commerce UI or **fake platform SKUs**:

1. **Plan tables** — tenant-scoped `portal_member_plans` rows whose `plan_code` is **tenant-defined data**, not hard-coded product SKUs
2. **Billing/membership webhook** — ops JWT `portal:entitlements` applies a plan → writes `membershipMetadata.portalModuleGrants` (+ optional capability flags)
3. Keep evaluation in `@app-tour/workspace-sdk` `evaluateMemberPortalEntitlements` (no mega entitlement package)

## Non-goals

- Stripe / checkout / plan catalog UI
- Hard-coded `basic` / `pro` / `enterprise` platform SKUs
- Hollow `packages/entitlement-kernel`
- Replacing finance `enabledModules`

## Data model

```text
Tenant 1—* PortalMemberPlan
  id, tenantId, planCode (unique per tenant), displayName
  moduleGrants: string[]          // e.g. ["wallet"]
  capabilityFlags: object         // optional member.module.{id}.* style keys → bool
  active

Apply webhook
  → load plan by (tenantId, planCode)
  → UserTenant.membership_metadata:
       portalModuleGrants
       portalPlanCode
       portalCapabilityFlags
       portalEntitlementsRevision++
```

## HTTP

| Method | Path | Auth |
| ------ | ---- | ---- |
| `POST` | `/internal/portal-member-entitlements/plans/upsert` | ops JWT `portal:entitlements` (prod/prodlike) |
| `POST` | `/internal/portal-member-entitlements/apply-plan` | same |

`apply-plan` body (strict):

```json
{ "tenantId": "<uuid>", "userId": "<uuid>", "planCode": "<tenant-defined>" }
```

## Entitlements read path

`getMemberEntitlements` still evaluates via SDK using `portalModuleGrants`. Response gains optional:

- `planCode`
- `entitlementsRevision`
- `capabilities` (from `portalCapabilityFlags`)

BFF cache remains 30s max (DL-17); apply-plan bumps revision for API truth. Member `POST /api/me/entitlements/invalidate` unchanged for session-scoped bust.

## Code map

| Surface | Path |
| ------- | ---- |
| Prisma model + RLS migration | `apps/api/prisma/schema.prisma` `PortalMemberPlan`; `migrations/20260721100000_portal_member_plans_bp7/` |
| Repos / service | `apps/api/src/identity/portal-member-plan.*` |
| Internal routes | `apps/api/src/routes/internal/portal-member-entitlements.ts` |
| Ops scope | `OPS_SCOPE_PORTAL_ENTITLEMENTS = "portal:entitlements"` |
| Me read | `apps/api/src/identity/me.entitlements.service.ts` |
| Spec | `apps/api/test/portal-member-plan-bp7.spec.ts` |

## Verify (fast-track)

```bash
pnpm --filter @apps/api exec node --import tsx --test \
  test/portal-member-plan-bp7.spec.ts
pnpm run guard:import-boundary
```

## Companion

- Contract: [`docs/phase-19/platform-portal-member-entitlements.mdoc`](../../phase-19/platform-portal-member-entitlements.mdoc) §5.2
- Design: [SK3_ENTITLEMENT_FLAGS.md](./SK3_ENTITLEMENT_FLAGS.md)
