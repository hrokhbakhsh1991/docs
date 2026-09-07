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
| `inAppRegistrationApprovedNotify` | `boolean` | **`false`** (2026-09 SEC-042) | When `false`, `dispatchRegistrationApprovedNotification` no-ops (MNI inbox remains canonical; explicit `true` opts into legacy SK2.C deliver) |

## Theme JSON migration plan

| Existing theme | Behavior after land |
| -------------- | ------------------- |
| No `featureFlags` object | Default **off** (legacy SK2.C deliver skipped; MNI relay unchanged) |
| `featureFlags` without this key | Default **off** |
| `"inAppRegistrationApprovedNotify": false` | Legacy notify **off** |
| `"inAppRegistrationApprovedNotify": true` | Legacy notify **on** (pre-SEC-042 default behavior) |
| Non-boolean value | Treated as default **off** (strict only explicit `true` enables legacy path) |

No DB migration / backfill required — JSONB theme is schemaless. Tenants that relied on legacy SK2.C in_app deliver without MNI must set `"inAppRegistrationApprovedNotify": true` explicitly.

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
| `parseFeatureFlagsFromTheme` | Parse with default `false` (SEC-042) |
| `dispatchRegistrationApprovedNotification` | Resolve flags; skip deliver when `false` |
| Specs | Parse defaults + dispatch gate |
| README-feature-flags | Document new key |

## Explicit non-goals

- BP-7 plan tables (`YES — IMPL-SK3-BP7`) — **DONE** — [SK3_BP7_IMPLEMENTATION.md](./SK3_BP7_IMPLEMENTATION.md)  
- Hollow entitlement package  
- Collapsing flags into portal entitlements  
- Inventing unrelated flag keys  

## Proof

`pnpm --filter @apps/api exec node --import tsx --test src/tenant/tenant-feature-flags-sk3.spec.ts src/notifications/notification-delivery.port.spec.ts`
