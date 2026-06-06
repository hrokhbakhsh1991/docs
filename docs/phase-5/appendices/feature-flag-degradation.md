# Feature flag degradation — Advanced Rule Engine → Basic Validation

> **Integration proof:** `apps/api/test/4-integration/feature-flag-degradation.spec.ts`  
> **Validation gate:** [`5.2-plugin-validation.md`](../subphases/5.2-plugin-validation.md) · **DEC-014** in [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)

## Problem

Under high load or operational stress, operators may disable the **Advanced Rule Engine** for a **single tenant** without taking down validation globally. Other tenants must continue full plugin rule evaluation; the degraded tenant falls back to **Basic Validation** (schema + type checks only — fewer matrix rules).

This is **not** a global service disable (no blanket 503) and **not** an error for all tenants.

## Flag location

| Store                            | Path                              | Default                  |
| -------------------------------- | --------------------------------- | ------------------------ |
| Postgres `tenants.theme` (JSONB) | `featureFlags.advancedRuleEngine` | `true` (omit = advanced) |
| Static `DEV_TENANTS` registry    | same nested key on `theme`        | `true`                   |

Example degraded tenant row:

```json
{
  "primaryColor": "#2563eb",
  "featureFlags": {
    "advancedRuleEngine": false
  }
}
```

## Resolution flow

```mermaid
sequenceDiagram
  participant Route as POST /tours
  participant TS as ToursService
  participant FF as resolveTenantFeatureFlags
  participant Val as validateCanonicalBeforePersist
  participant PWE as PlatformWizardEngine

  Route->>TS: createTour(auth, body)
  TS->>FF: resolveTenantFeatureFlags(tenantId)
  FF-->>TS: { advancedRuleEngine: false }
  TS->>Val: validationVariant = basic | default
  Val->>PWE: validateCanonical(doc, { dimensions: { variant } })
  alt advanced (default)
    PWE-->>Val: full matrix rules (basics.title required)
  else basic (degraded)
    PWE-->>Val: relaxed matrix cell (basics.title optional)
  end
```

| Component                 | Path                                                          |
| ------------------------- | ------------------------------------------------------------- |
| Flag parse + variant map  | `apps/api/src/tenant/resolve-tenant-feature-flags.ts`         |
| RuleContext variant       | `apps/api/src/tours/canonical-validation.ts`                  |
| Starter `basic` rule cell | `packages/workspace-sdk/src/reference/starter-plugin-core.ts` |

## Fallback behavior

| `advancedRuleEngine` | RuleContext `variant` | Starter behavior                                                   |
| -------------------- | --------------------- | ------------------------------------------------------------------ |
| `true` or omitted    | `default`             | Full Advanced Rule Engine — `basics.title` **required**            |
| `false`              | `basic`               | Basic Validation — schema/type checks; `basics.title` **optional** |

Degradation is **per-tenant** only. Tenant B with `advancedRuleEngine: true` still fails POST when `basics.title` is absent; Tenant A with `false` succeeds on the same body.

## Verification

```bash
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma
export NODE_ENV=test

pnpm --filter @apps/api exec node --import tsx --test \
  test/4-integration/feature-flag-degradation.spec.ts
```

**Pass criteria:**

- Tenant A (`advancedRuleEngine: false`): POST invalid starter body (missing `basics.title`) → **201**
- Tenant B (default/advanced): same body → **400** `VALIDATION_FAILURE`
- Neither tenant receives **503** during concurrent burst
- Flag flip mid-load: after DB update to `false`, subsequent A requests use basic path without restart

## Non-goals (this slice)

- Automatic load-based flip (manual / admin DB update only)
- Cross-process cache invalidation TTL (reads DB per request; registry fallback for dev seeds)
- Disabling `assertCanonicalDocument` or schema version checks in basic mode
