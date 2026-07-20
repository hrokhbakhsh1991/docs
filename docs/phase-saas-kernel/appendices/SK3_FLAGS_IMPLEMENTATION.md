# SK3 — IMPL-SK3-FLAGS (`inAppRegistrationApprovedNotify`)

```yaml
doc_id: SK3_FLAGS_IMPLEMENTATION
status: LANDED
date: "2026-07-21"
unlock: |
  YES — IMPL-SK3-FLAGS
  flags: inAppRegistrationApprovedNotify
  (Architect chat confirm of suggested next item after SK2.C)
canonical_branch: booking/capacity-concurrency-cert
design: SK3_ENTITLEMENT_FLAGS.md
companion: SK2_C_IMPLEMENTATION.md
```

## Product need (not “for later”)

SK2.C always delivers in_app structured notification on `registration.approved`. Operators need a **typed tenant knob** to silence that path without redeploy — same DEC-014 `theme.featureFlags` surface as `advancedRuleEngine`.

| Flag | Type | Default (omit / non-boolean) | Effect |
| ---- | ---- | ---------------------------- | ------ |
| `inAppRegistrationApprovedNotify` | `boolean` | **`true`** | When `false`, `dispatchRegistrationApprovedNotification` no-ops (still durable outbox; no notify sink) |

## Theme JSON migration plan

| Existing theme | Behavior after land |
| -------------- | ------------------- |
| No `featureFlags` object | Default **on** (notify) — same as pre-flag SK2.C |
| `featureFlags` without this key | Default **on** |
| `"inAppRegistrationApprovedNotify": false` | Notify **off** |
| `"inAppRegistrationApprovedNotify": true` | Notify **on** |
| Non-boolean value | Treated as default **on** (strict only `false` disables) |

No DB migration / backfill required — JSONB theme is schemaless; parse defaults are fail-open for notify continuity.

Opt-out example:

```json
{
  "featureFlags": {
    "advancedRuleEngine": true,
    "inAppRegistrationApprovedNotify": false
  }
}
```

## Code touch

| Piece | Change |
| ----- | ------ |
| `TenantFeatureFlags` | Add `inAppRegistrationApprovedNotify: boolean` |
| `parseFeatureFlagsFromTheme` | Parse with default `true` |
| `dispatchRegistrationApprovedNotification` | Resolve flags; skip deliver when `false` |
| Specs | Parse defaults + dispatch gate |
| README-feature-flags | Document new key |

## Explicit non-goals

- BP-7 plan tables (`YES — IMPL-SK3-BP7`)  
- Hollow entitlement package  
- Collapsing flags into portal entitlements  
- Inventing unrelated flag keys  

## Proof

`pnpm --filter @apps/api exec node --import tsx --test src/tenant/tenant-feature-flags-sk3.spec.ts src/notifications/notification-delivery.port.spec.ts`
