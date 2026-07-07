# ADR-GP-004 — Guest SEO manifest (`guestSeo`)

## Status

Accepted.

## Context

Marketing SEO must stay plugin-agnostic: no `if (pluginId === "denali")` branches in `apps/marketing`. Catalog JSON-LD builders already live in workspace packages (Denali `TouristTrip`, Urban `Event`, guest-club stub). We need a manifest-driven contract that codegen turns into SDK resolvers and guards enforce for L2+ guest workspaces.

`guestExtensionsVersion` remains **1** (ADR-GP-002). `guestSeo` is **optional in schema admission** but **required for L2+** conformance (catalog routes + registration flow), enforced by `guard-guest-seo.mjs` (guest conformance bundle step 15).

## Decision

### Manifest block

Guest-ready workspaces (L2+) declare `guestSeo.marketing`:

```json
{
  "guestExtensionsVersion": 1,
  "guestSeo": {
    "marketing": {
      "listTitleKey": "seo.toursTitle",
      "jsonLd": {
        "required": true,
        "schemaTypes": ["TouristTrip"],
        "builderExport": "buildDenaliTouristTripJsonLd",
        "richResultsProfile": "tourist-trip-v1"
      },
      "sitemap": { "changefreq": "weekly", "priority": 0.8, "includeImages": true },
      "pagination": { "noindexQueryParams": ["cursor", "city"] }
    }
  }
}
```

| Field | Role |
| ----- | ---- |
| `listTitleKey` / `listDescriptionKey` | i18n message keys for list metadata (SEO-4) |
| `detailTitleTemplate` | Optional `{tourTitle}` / `{siteName}` template |
| `jsonLd.required` | When true, marketing must render structured data on tour detail |
| `jsonLd.schemaTypes` | Schema.org `@type` values the builder emits |
| `jsonLd.builderExport` | Named export in `packages/workspaces/<id>/src/catalog/` |
| `jsonLd.richResultsProfile` | Golden-fixture profile id for guard/E2E (SEO-3) |
| `sitemap.*` | Default changefreq/priority/image inclusion for sitemap builder |
| `pagination.noindexQueryParams` | Query params that force `noindex` on list pages |

### Codegen (central — no separate generator)

`scripts/generate-workspace-registry.mjs` emits:

- `packages/workspace-sdk/src/catalog/workspace-guest-seo.generated.ts` → `WORKSPACE_GUEST_SEO`

SDK resolver: `resolveGuestSeoForPlugin(pluginId)` — fail-closed (`GuestSeoNotConfiguredError`) when the plugin id is absent from the generated map.

Pattern mirrors `catalogPresentation` → `resolveCatalogListFeatures()` / `resolveCatalogDetailSections()`.

### Conformance

| Level | SEO requirement |
| ----- | ----------------- |
| L0–L1 | none |
| **L2+** | `guestSeo.marketing.jsonLd` + `builderExport` file exists in workspace package |
| **L3** | L2+ plus trunk smoke tenants covered by SMK-MKT-06+ (SEO-3) |

Guard: `scripts/guards/guard-guest-seo.mjs`, wired as step 15 in `guard-guest-plugin-conformance.mjs`.

### Scaffold

`pnpm run workspace:create -- <id> --guest` emits a minimal `guestSeo` stub with `jsonLd.required: true` and a placeholder `builderExport` so codegen and guard fail loudly until the workspace implements its builder.

## Consequences

- Marketing reads SEO policy only through `resolveGuestSeoForPlugin()`; workspace packages own JSON-LD shape.
- New guest workspaces cannot merge at L2+ without `guestSeo` backfill.
- Rich-results surfaces, hreflang, and `@graph` bundling remain later phases (SEO-3..5++); this ADR covers manifest admission and codegen only.

## References

- [ADR-GP-002 — Guest extension schema](./ADR-GP-002-guest-extension-schema.md)
- [Guest plugin conformance](../guest-plugin-conformance.md)
- [Denali public catalog — M8a](../../workspaces/denali/public-catalog.md)
