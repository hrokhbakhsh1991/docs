# Guest SEO conformance (SEO-2 → SEO-5)

> **Status:** SEO-5+ **closed** · SEO-5++ **closed** (Gate 9.9 pre-launch) · SEO-6 post-launch (GSC/CrUX)  
> **North star:** Marketing SEO is manifest-driven — no `if (pluginId)` branches in `apps/marketing`.

## Manifest contract

Guest workspaces at **L2+** declare `guestSeo.marketing` in `workspace.manifest.json` (ADR-GP-004). Codegen emits `WORKSPACE_GUEST_SEO`; runtime resolver: `resolveGuestSeoForPlugin(pluginId)` — fail-closed (`GuestSeoNotConfiguredError`).

| Field | Consumer |
| ----- | -------- |
| `jsonLd.required` | Tour detail must validate and render structured data when true |
| `jsonLd.schemaTypes` | Expected Schema.org `@type` values |
| `jsonLd.builderExport` | Workspace `src/catalog/` export name |
| `jsonLd.richResultsProfile` | Golden fixture id under `scripts/test/fixtures/jsonld/` (validated by `validate-json-ld.mjs`) |
| `pagination.noindexQueryParams` | List pages with these query params → `noindex` (SEO-5+) |
| `sitemap.*` | Default changefreq/priority for tour URLs in the sitemap builder |

Schema: [`workspace-guest-extensions.schema.json`](./workspace-guest-extensions.schema.json). Admission guard: `guard-guest-seo.mjs` (guest conformance bundle step 15).

## Registry outputs

| Generated file | Resolver |
| -------------- | -------- |
| `workspace-guest-seo.generated.ts` | `resolveGuestSeoForPlugin()` |

Golden manifest profiles live at `scripts/test/fixtures/workspace-guest-seo.golden.json` (checked by `scripts/test/workspace-guest-seo.spec.mjs`). Each `richResultsProfile` has a matching JSON-LD golden file validated by `scripts/validate-json-ld.mjs` and wired into `guard-guest-seo.mjs` step 15.

## Cache tags (marketing)

| Tag | Invalidated on publish |
| --- | ---------------------- |
| `marketing-catalog-{tenantId}` | Catalog list + detail fetches |
| `marketing-seo-{tenantId}` | Sitemap + robots metadata routes |

`POST /api/revalidate` (header `x-marketing-revalidate-secret`, body `{ tenantId }`) calls `revalidateTag` for **both** tags. API schedules the same POST via `scheduleMarketingCatalogRevalidate()` on catalog-affecting tour writes.

## E2E hooks

[`guest-seo-e2e-hooks.yaml`](./guest-seo-e2e-hooks.yaml) — consumed by `guard-guest-seo-e2e-hooks.mjs` (guest conformance step 16).

| ID | Spec | Verify |
| -- | ---- | ------ |
| SMK-MKT-06 | `marketing-seo-jsonld.spec.ts` | TouristTrip JSON-LD + breadcrumb |
| SMK-MKT-07 | `marketing-seo-head.spec.ts` | title · og:title · twitter:card |
| SMK-MKT-08 | `marketing-seo-sitemap.spec.ts` | `/sitemap.xml` 200 + tour URL |
| SMK-MKT-09 | `marketing-seo-hreflang.spec.ts` | `/en/tours` reciprocal hreflang |
| SMK-MKT-10 | `marketing-seo-pagination.spec.ts` | `?cursor` → `noindex, follow` |
| SMK-MKT-11 | `marketing-seo-jsonld.spec.ts` | Denali JSON-LD `offers` + `image` |

### Smoke cover image (SMK-MKT-06 / 11)

Denali catalog egress only projects **https** photo URLs into `coverImageUrl` / TouristTrip `image`
(`readDenaliFirstPhotoHttpsUrl` / `isDenaliHttpsImageUrl`). Operator + Denali club smoke seeds must
therefore use an `https://…` cover (see `OPERATOR_SMOKE_PUBLISHED_TOUR_COVER_URL`), not a `data:`
SVG — otherwise SMK-MKT-06/11 fail with `typeof image === "undefined"` even when the detail page
renders. SEO smoke (`playwright.marketing-seo.config.ts`) pins tour id `…0210` on
`operator.localhost` so the matrix seed and JSON-LD assertions stay aligned.
| SMK-MKT-12 | `marketing-urban-catalog-smoke.spec.ts` | Urban Event v2 JSON-LD |
| SMK-MKT-13 | `marketing-guest-club-seo.spec.ts` | Guest-club Event stub JSON-LD |
| SMK-MKT-14 | `marketing-seo-unpublish.spec.ts` | Draft tour → 404 + sitemap omit |
| SMK-MKT-15 | `marketing-seo-locale-matrix.spec.ts` | fa/en × denali/urban hreflang |
| SMK-MKT-104 | `marketing-seo-sitemap-isolation.spec.ts` | Per-tenant sitemap isolation |
| SMK-WEB-SEO-01 | `apps/web/test/web-catalog-seo-redirect.spec.ts` | Web `/catalog` → 308 marketing |

```bash
pnpm --filter @apps/marketing run test:smoke:seo
pnpm --filter @apps/marketing run test:smoke:guest-club
pnpm --filter @apps/marketing run test:smoke:seo-matrix
```

## Conformance levels + SEO

| Level | SEO requirement |
| ----- | ----------------- |
| L0–L1 | none |
| **L2+** | `guestSeo` manifest + JSON-LD builder export in workspace package |
| **L3** | L2+ plus SMK-MKT-06..11 green on smoke tenant |

## SEO-5 quality gates (→ 9.0)

| Artifact | Role |
| -------- | ---- |
| `scripts/validate-json-ld.mjs` | Validates golden JSON-LD blobs per `richResultsProfile` via SDK `validateStructuredData` + profile rules |
| `guard-guest-seo.mjs` (step 15) | Manifest admission **and** `validate-json-ld.mjs --all-fixtures` |
| `guard-marketing-semantic-seo.mjs` | Static closure: single `h1` on list/detail, cover `alt`, validated JSON-LD render path, no `pluginId` branches in `apps/marketing/src/seo` |
| `build-marketing-metadata.ts` | OG/Twitter images declare `width`/`height` (MKT-32) |
| `apps/marketing/lighthouserc.json` | Lighthouse CI SEO ≥ 90 on `/tours` + operator smoke tour detail (`test:lighthouse`) |

```bash
node scripts/validate-json-ld.mjs --all-fixtures
pnpm run guard:marketing-semantic-seo
pnpm --filter @apps/marketing run test:lighthouse   # requires smoke servers (heavy; optional in PR)
```

## SEO-5+ tier (→ 9.5)

| Artifact | Role |
| -------- | ---- |
| `build-marketing-metadata.ts` | `pagination.noindexQueryParams` → `robots: { index: false, follow: true }` on `/tours?cursor`, `?city`, and PR-22 filter params (`q`, `category`, `difficulty`, `fitness`, `availability`, `sort`) |
| `build-marketing-catalog-list-jsonld.ts` | `ItemList` JSON-LD on first-page `/tours` (no `cursor`) |
| `build-marketing-sitemap.ts` | Tour detail URLs include `images[]` when `coverImageUrl` is set |
| `catalog-tour-breadcrumb.tsx` | Visible `<nav aria-label="Breadcrumb">` aligned with BreadcrumbList JSON-LD |
| `guard-marketing-seo-prod.mjs` | Production closure — `MARKETING_PUBLIC_BASE_URL` must be `https://` in prod |
| `lighthouserc.json` | SEO ≥ 90 **and** Performance ≥ 85 + CWV budgets |
| SMK-MKT-10 | `/tours?cursor=…` emits `noindex, follow` |
| SMK-MKT-17 | `/tours?category=…` (and other filter params) emits `noindex, follow` (PR-22.1) |
| SMK-MKT-11 | Denali detail JSON-LD includes `offers` + `image` |

Production deploys must set `MARKETING_PUBLIC_BASE_URL=https://…` so `metadataBase` and canonical URLs are HTTPS-only (`guard-marketing-seo-prod.mjs`).

```bash
pnpm run guard:marketing-semantic-seo
pnpm run guard:marketing-seo-prod
node scripts/validate-json-ld.mjs --all-fixtures
```

## SEO-5++ tier (→ 9.9)

| Artifact | Role |
| -------- | ---- |
| `apps/web/.../catalog/**` | `permanentRedirect` (HTTP 308) to marketing `/tours` (SMK-WEB-SEO-01) |
| `build-marketing-tour-detail-jsonld-graph.ts` | Single `@graph` script (structured data + breadcrumb) |
| `serialize-marketing-jsonld.ts` | XSS-safe JSON-LD serialization (`guard-jsonld-xss`) |
| `buildMarketingSurfaceNoindexMetadata` | Mother · maintenance · global 404 → `noindex` |
| Urban `buildUrbanEventJsonLd` | Event v2 (`eventAttendanceMode`) |
| `schedule-marketing-sitemap-ping.ts` | Optional `MARKETING_SITEMAP_PING_URL` on publish |
| `guard-marketing-meta-quality.mjs` | Metadata/canonical/308 closure |
| `guard-marketing-hreflang.mjs` | `fa-IR` · `en-US` · `x-default` |
| `guard-marketing-sitemap-host.mjs` | Host-aware sitemap hygiene |
| `crawl-marketing-sitemap.mjs` | Live sitemap crawl (no query URLs) |
| `lighthouserc.strict.json` | SEO≥90 (error) · Perf/A11y/CWV (warn on local `next dev` smoke) |
| `smoke-marketing-lighthouse-servers.mjs` | Lighthouse-only API+marketing smoke (`*.localhost` chromeFlags) |
| `app/feed.xml/route.ts` | Atom feed for published tours (T-098) |
| `guard-marketing-prod-image-hosts.mjs` | Production cover image host allowlist closure (T-094) |
| SMK-MKT-13 | Guest-club Event stub JSON-LD on `guest-club.localhost` |
| SMK-MKT-14 | Unpublished tour 404 + absent from sitemap |
| SMK-MKT-15 | Denali + Urban fa/en hreflang matrix |
| SMK-MKT-104 | Tenant sitemap URL isolation |

Production cover images must declare explicit `MARKETING_IMAGE_REMOTE_HOSTS` (no wildcard) — see `guard-marketing-prod-image-hosts.mjs` and `public-catalog.md` M14.

```bash
pnpm run guard:marketing-meta-quality
pnpm run guard:marketing-hreflang
pnpm run guard:marketing-sitemap-host
pnpm run guard:marketing-prod-image-hosts
pnpm run guard:jsonld-xss
pnpm run crawl:marketing-sitemap -- --smoke-host operator.localhost:3002
pnpm --filter @apps/marketing run test:lighthouse
pnpm --filter @apps/marketing run test:lighthouse:strict
```

`test:lighthouse` / `test:lighthouse:strict` boot `smoke-marketing-lighthouse-servers.mjs` (API + `next dev`), map `operator.localhost` via Chrome flags (`lighthouserc.json`), and assert SEO on `/tours`. Performance/CWV are **warn** on local dev smoke (production `next start` gate is post-deploy).

Live sitemap crawl validates no query strings and host-aligned `<loc>` entries when marketing smoke is up.

## Guards

| Guard | Role |
| ----- | ---- |
| `guard-guest-seo.mjs` | L2+ manifest + builder file + JSON-LD golden validation |
| `guard-guest-seo-e2e-hooks.mjs` | SEO smoke yaml → spec paths exist |
| `guard-marketing-semantic-seo.mjs` | Marketing semantic HTML + metadata closure |
| `guard-marketing-seo-prod.mjs` | Production HTTPS `metadataBase` / public origin policy |
| `guard-public-catalog-m17.mjs` | Static closure incl. SEO artifacts |

## Decisions

- [ADR-GP-004](./adr-guest-plugin/ADR-GP-004-guest-seo-manifest.md) — `guestSeo` manifest + codegen
- [ADR-GP-002](./adr-guest-plugin/ADR-GP-002-guest-extension-schema.md) — guest extension schema admission

## References

- Marketing SEO shell: [`public-catalog.md` § M8a](../workspaces/denali/public-catalog.md)
- Guest plugin conformance: [`guest-plugin-conformance.md`](./guest-plugin-conformance.md)
