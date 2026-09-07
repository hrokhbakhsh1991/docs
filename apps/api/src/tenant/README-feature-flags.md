# Tenant feature flags

```yaml
surface: apps/api/src/tenant/*feature-flag*
kernel_design: docs/phase-saas-kernel/appendices/SK3_ENTITLEMENT_FLAGS.md
impl: docs/phase-saas-kernel/appendices/SK3_FLAGS_IMPLEMENTATION.md
```

## What this is

Per-tenant runtime knobs stored under `tenants.theme.featureFlags` (see `resolve-tenant-feature-flags.ts`).

Typed surface (`TenantFeatureFlags`):

| Key | Default | Role |
| --- | ------- | ---- |
| `advancedRuleEngine` | `true` | Wizard validation variant (`default` vs `basic`) |
| `inAppRegistrationApprovedNotify` | `false` | Gate legacy SK2.C in_app notify on `registration.approved` (MNI inbox canonical; set `true` to opt in) |

Rollback windows use `feature-flag-freeze.ts` (cache-only reads while freeze active).

## What this is not

| Not this | Use instead |
| -------- | ----------- |
| Member portal module grants | `evaluateMemberPortalEntitlements` / MPS-ENT-001 |
| Workspace capability modules (`finance`, …) | `theme.enabledModules` + workspace gates (e.g. `finance-module-enabled.ts`) |
| Notification **transport** | SK2 / outbox (flags only **gate** delivery) |
| `rateLimitRps` | Still theme root / nested number — not a boolean `TenantFeatureFlags` field |

Do not add flag keys without updating SK3 docs and targeted specs in the same change.
