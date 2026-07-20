# Tenant feature flags

```yaml
surface: apps/api/src/tenant/*feature-flag*
kernel_design: docs/phase-saas-kernel/appendices/SK3_ENTITLEMENT_FLAGS.md
```

## What this is

Per-tenant runtime knobs stored under `tenants.theme.featureFlags` (see `resolve-tenant-feature-flags.ts`).

Today the typed surface is essentially:

- `advancedRuleEngine: boolean` — maps to wizard validation variant (`default` vs `basic`)

Rollback windows use `feature-flag-freeze.ts` (cache-only reads while freeze active).

## What this is not

| Not this | Use instead |
| -------- | ----------- |
| Member portal module grants | `evaluateMemberPortalEntitlements` / MPS-ENT-001 |
| Workspace capability modules (`finance`, …) | `theme.enabledModules` + workspace gates (e.g. `finance-module-enabled.ts`) |
| Notification delivery | SK2 / outbox |

Do not add flag keys without updating SK3 docs and targeted specs in the same change.
