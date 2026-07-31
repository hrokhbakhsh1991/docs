# ADR-GP-005 — Guest landing manifest (`guestLanding`)

## Status

Accepted (2026-07-04).

## Context

Marketing home (`/`) must vary by workspace plugin (Denali full 4-block landing vs Urban/guest-club minimal) without `if (pluginId === "denali")` branches in `apps/marketing` (ADR-MKT-001, ADR-MKT-004).

Catalog list/detail already use manifest-driven SDK resolvers (`resolveCatalogListFeatures`, `resolveCatalogDetailSections`). Landing needs the same pattern before UI work (PR-0 merge blocker).

## Decision

### Manifest block

Guest-capable workspaces declare `guestLanding`:

**Full variant (denali):**

```json
{
  "guestLanding": {
    "variant": "full",
    "sections": {
      "hero": true,
      "latestTours": true,
      "latestToursLimit": 6,
      "trust": true,
      "finalCta": true
    },
    "i18nProfile": "full"
  }
}
```

**Minimal variant (urban, guest-club):**

```json
{
  "guestLanding": {
    "variant": "minimal",
    "sections": {
      "hero": false,
      "latestTours": false,
      "latestToursLimit": 0,
      "trust": false,
      "finalCta": false
    },
    "i18nProfile": "minimal"
  }
}
```

| Field | Role |
| ----- | ---- |
| `variant` | `full` → `GuestHomeFull` · `minimal` → `GuestHomeMinimal` |
| `sections.*` | Boolean gates per block; `latestToursLimit` 0–12 when `latestTours` true |
| `i18nProfile` | Selects `home.full.*` vs `home.minimal.*` message subtree |

### Codegen + resolver

- `scripts/generate-workspace-registry.mjs` emits `workspace-guest-landing.generated.ts`
- `resolveGuestLandingFeatures(pluginId)` in `@app-tour/workspace-sdk`
- Unknown plugin → `UnknownGuestLandingPluginError` (`GUEST_LANDING_NOT_CONFIGURED`) — **fail-closed**, same ergonomics as `UnknownCatalogPresentationPluginError`

### Home SEO keys (extends ADR-GP-004)

Add optional fields to `guestSeo.marketing`:

```json
"homeTitleKey": "seo.homeTitle",
"homeDescriptionKey": "seo.homeDescription"
```

Marketing `generateMetadata` on `/` reads these via `resolveGuestSeoForPlugin` — no hardcoded mountain copy.

### i18n isolation

- `home.full.*` — outdoor/mountain copy; **only** when `i18nProfile === "full"`
- `home.minimal.*` — neutral copy for urban/guest-club
- Prevents cross-tenant copy leakage (SMK-MKT-HOME-05)

### Scaffold contract

`pnpm run workspace:create -- <id> --guest` **must** emit:

```json
"guestLanding": {
  "variant": "minimal",
  "sections": {
    "hero": false,
    "latestTours": false,
    "latestToursLimit": 0,
    "trust": false,
    "finalCta": false
  },
  "i18nProfile": "minimal"
}
```

Implementers opt into `variant: "full"` when product-ready.

## Consequences

- PR-0 adds manifest entries + generator + resolver before any Hero UI
- New guest workspace without `guestLanding` fails at resolve time in dev/CI
- Catalog fetch on `/` skipped when no catalog-backed section is enabled (HOME-UNIT-04)
- «Latest published» and «Featured bento» share catalog sort — no curated featured API in MVP

## Amendments (2026-07-04)

PR-5..7 extend `guestLanding.sections` with boolean gates (and `featuredToursLimit` 0–12):

| Phase | Fields |
| ----- | ------ |
| PR-5 | `faq`, `footer` |
| PR-6 | `whySection`, `journey`, `testimonials` (deprecated alias: `whyDenali`) |
| PR-7 | `featuredTours`, `featuredToursLimit`, `categories`, `destinations`, `heroSearch` |
| PR-8 | `gallery`, `equipment`, `blogTeaser` |

Denali enables all PR-5..7; PR-8 enables `gallery` + `equipment`, `blogTeaser` false until CMS. Urban/guest-club remain minimal.

## References

- [marketing-landing.mdoc](../../workspaces/denali/marketing-landing.mdoc) §18–§18.7
- [ADR-GP-004](./ADR-GP-004-guest-seo-manifest.md) — guest SEO manifest
- [public-catalog.md](../../workspaces/denali/public-catalog.md) § Adding a workspace steps 4e–4f
- [ADR-MKT-004](../../workspaces/denali/public-catalog.md) — SDK resolver registry
