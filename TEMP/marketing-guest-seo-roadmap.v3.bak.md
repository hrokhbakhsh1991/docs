# Marketing Guest SEO — Roadmap to 9.5+/10

> **نسخه:** 3.0 (2026-07-02) — بازبینی **۹.۵+** · شکاف‌های v2 بسته شد  
> **نوع:** نقشه راه TEMP — promote → `docs/dev/guest-seo-conformance.md`  
> **Baseline:** **۴/۱۰** · **هدف v3:** **≥ ۹.۵/۱۰** pre-launch · **۱۰** فقط با GSC crawl audit

---

## 0. Authority map

| اولویت | سند | نقش SEO |
|--------|-----|---------|
| 1 | [`docs/workspaces/denali/public-catalog.md`](../docs/workspaces/denali/public-catalog.md) | M8 metadata · M9 i18n (`localePrefix: never` today) · M11 revalidate |
| 2 | [`docs/dev/guest-plugin-conformance.md`](../docs/dev/guest-plugin-conformance.md) | L0–L3 · guard bundle · G4 |
| 3 | [`docs/dev/adr-guest-plugin/ADR-GP-002`](../docs/dev/adr-guest-plugin/ADR-GP-002-guest-extension-schema.md) | `guestExtensionsVersion` |
| 4 | [`docs/dev/workspace-guest-extensions.schema.json`](../docs/dev/workspace-guest-extensions.schema.json) | manifest contract |
| 5 | [`docs/phase-17/platform-club-catalog-publish.mdoc`](../docs/phase-17/platform-club-catalog-publish.mdoc) | publish → revalidate |
| 6 | [`docs/phase-19/p6/runbooks/host-subdomain-map.md`](../docs/phase-19/p6/runbooks/host-subdomain-map.md) | per-tenant canonical host |
| 7 | [`TEMP/marketing-public-catalog-enterprise-roadmap.md`](./marketing-public-catalog-enterprise-roadmap.md) | UI track (مکمل) |
| 8 | [`TEMP/plugin-first-platform-migration-roadmap.md`](./plugin-first-platform-migration-roadmap.md) | P14/P15 |

**Extensibility:** marketing بدون `import @app-tour/workspace-*` · SEO از API JSON + SDK resolver.

---

## A. حکم بازبینی — v2 به ۹.۵ می‌رسد؟

**خیر — سقف واقعی v2 ≈ ۹.۰/۱۰** (بدون production audit).

| blocker | شواهد codebase | اثر روی نمره |
|---------|----------------|--------------|
| **Pagination duplicate index** | `/tours?cursor=` و `?city=` بدون `noindex`/canonical | −۰.۵ (thin/duplicate) |
| **JSON-LD ناقص Rich Results** | `buildDenaliTouristTripJsonLd` بدون `offers` · `image` · `url` · `dateModified` | −۰.۳ |
| **بدون ItemList list-page** | `/tours` فقط HTML grid | −۰.۲ |
| **بدون `catalogUpdatedAt` در contract** | `PublicCatalogCard` فیلد freshness ندارد → sitemap `lastmod` غیرقابل اعتماد | −۰.۲ |
| **فقط Lighthouse SEO category** | CWV (LCP/CLS/INP) در gate نیست | −۰.۳ |
| **i18n SEO ضعیف** | `localePrefix: never` + cookie — Google alternate نمی‌بیند | −۰.۵ تا `as-needed` |
| **بدون image sitemap** | cover URLs فقط در HTML | −۰.۱ |
| **بدون x-default hreflang** | v2 فقط fa/en alternates | −۰.۱ |
| **بدون SearchAction** | WebSite schema ناقص | −۰.۱ |
| **breadcrumb فقط JSON-LD** | detail فقط back link — بدون nav semantic | −۰.۱ |

**جمع شکاف v2→۹.۵:** ~۱.۵ نمره · **v3 این ۱۰ blocker را می‌بندد.**

---

## 1. NON-NEGOTIABLES (SEO pack v3)

1. L2+ بدون `guestSeo` + JSON-LD builder merge نمی‌شود.
2. manifest key جدید → schema + ADR-GP-004.
3. no hand-edit روی `workspace-guest-seo.generated.ts`.
4. marketing بدون `if (pluginId)` برای SEO.
5. JSON-LD در Server Component JSX · validate قبل از render.
6. sitemap/robots host-aware · canonical absolute per tenant.
7. **`?cursor` / `?city` هرگز در sitemap · `noindex` اجباری.**
8. **`catalogUpdatedAt` اجباری L2+** روی egress card.
9. یک PR = یک concern.
10. SMK-MKT-06..**11** سبز قبل از merge.
11. waivers فقط `guest-seo-WNNN.yaml` · expiry ≤ 30 روز.
12. promote doc قبل از guard step 15.

---

## 2. Rubric نمره (v3 — سخت‌گیرانه)

| نمره | معیار |
|------|--------|
| **۴** | metadata + OG + canonical · JSON-LD فقط Denali ناقص · بدون sitemap |
| **۶** | + sitemap/robots/Twitter · per-host |
| **۷** | + `guestSeo` · Urban/guest-club JSON-LD · guard schema |
| **۸** | + guard 15/15 · E2E head · revalidate SEO tag |
| **۹** | + `localePrefix: as-needed` · hreflang · Lighthouse **SEO ≥90** · BreadcrumbList · validator CI |
| **۹.۵** | + **pagination noindex** · **ItemList/Offer/image/url** rich JSON-LD · **CWV CI** · image sitemap · x-default · SearchAction · SMK-MKT-10/11 |
| **۱۰** | + GSC index green 30d · Rich Results manual · zero waivers |

**هدف v3:** **۹.۵** در **۷ فاز** (~۴–۵ هفته) · SEO-6 اختیاری post-launch.

---

## 3. قرارداد `guestSeo` — admission v2

**ADR:** `docs/dev/adr-guest-plugin/ADR-GP-004-guest-seo-manifest.md`

| `guestExtensionsVersion` | معنی |
|--------------------------|------|
| **1** | trunk فعلی — `guestSeo` optional |
| **2** | `guestSeo` **required** L2+ |

**Migration:** `scripts/migrate-guest-manifest-seo-v2.mjs`

### Extension جدید v3 — `PublicCatalogCard.catalogUpdatedAt`

| فیلد | نوع | نقش |
|------|-----|-----|
| `catalogUpdatedAt` | ISO-8601 string | sitemap `lastmod` · JSON-LD `dateModified` · freshness |

**منبع:** canonical `updatedAt` at publish · exposure-safe · ADR-MKT-003 amendment.

```json
{
  "guestExtensionsVersion": 2,
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

### Conformance L0–L3 + L-SEO

| Level | SEO |
|-------|-----|
| L0–L1 | none |
| **L2+** | `guestSeo` + builder + `catalogUpdatedAt` + unit |
| **L3** | + SMK-MKT-06..11 · richResultsProfile golden fixtures |

---

## 4. Inventory — وضعیت فعلی

### موجود ✅

| آیتم | مسیر |
|------|------|
| Metadata builders | `apps/marketing/src/seo/build-marketing-metadata.ts` |
| `metadataBase` per host | `resolveMarketingPublicOrigin()` |
| OG image + alt | `buildMarketingTourDetailMetadata` |
| 404 noindex | `buildMarketingNotFoundMetadata` |
| JSON-LD slot | `catalog-tour-detail.tsx` |
| Denali TouristTrip (ناقص) | `build-denali-tourist-trip-jsonld.ts` |
| `next/image` covers | `catalog-cover-image.tsx` |
| M11 revalidate | `schedule-marketing-catalog-revalidate.ts` |
| Cache tags | `marketing-catalog-{tenantId}` |
| h1/h2 hierarchy | list `h1` · card `h2` · detail `h1` |
| Internal links | card → detail (`<Link>`) |

### کمبود ❌ (برای ۹.۵)

| ID | کمبود | فاز |
|----|--------|-----|
| SEO-GAP-01 | `sitemap.ts` / `robots.ts` host-aware | SEO-0 |
| SEO-GAP-02 | Twitter Card | SEO-0 |
| SEO-GAP-03 | `localePrefix: as-needed` + hreflang | SEO-4 |
| SEO-GAP-04 | `guestSeo` manifest | SEO-2 |
| SEO-GAP-05 | Urban/guest-club JSON-LD | SEO-1 |
| SEO-GAP-06 | guard step 15 | SEO-2 |
| SEO-GAP-07 | E2E metadata asserts | SEO-3 |
| SEO-GAP-08 | workspace:create SEO scaffold | SEO-2 |
| SEO-GAP-09 | exposure `structuredData` deny | SEO-1 |
| SEO-GAP-10 | SEO revalidate tag + `catalogUpdatedAt` | SEO-1/3 |
| SEO-GAP-11 | Organization + WebSite JSON-LD | SEO-4 |
| SEO-GAP-12 | BreadcrumbList JSON-LD | SEO-1 |
| SEO-GAP-13 | Lighthouse SEO ≥90 | SEO-5 |
| SEO-GAP-14 | JSON-LD validator CI | SEO-5 |
| SEO-GAP-15 | semantic guard (h1/alt/links) | SEO-5 |
| **SEO-GAP-16** | **pagination `noindex` + exclude from sitemap** | **SEO-5+** |
| **SEO-GAP-17** | **ItemList JSON-LD on `/tours`** | **SEO-5+** |
| **SEO-GAP-18** | **Offer + image + url + dateModified in detail JSON-LD** | **SEO-5+** |
| **SEO-GAP-19** | **Lighthouse Performance + CWV budgets** | **SEO-5+** |
| **SEO-GAP-20** | **image sitemap (`<image:image>`)** | **SEO-5+** |
| **SEO-GAP-21** | **hreflang `x-default`** | **SEO-5+** |
| **SEO-GAP-22** | **WebSite `SearchAction` (site search → `/tours?city=`)** | **SEO-5+** |
| **SEO-GAP-23** | **visible breadcrumb nav (matches JSON-LD)** | **SEO-5+** |
| **SEO-GAP-24** | **IndexNow ping on publish** (optional accelerator) | **SEO-5+** |
| **SEO-GAP-25** | **OG image ≥1200w or `og:image:width/height`** | **SEO-5+** |

---

## 5. فازهای اجرا

### SEO-0 — Shell (→ ۶)

| ID | کار |
|----|-----|
| SEO-0.1 | `app/sitemap.ts` — host-aware · tour URLs only (no query) |
| SEO-0.2 | `app/robots.ts` — disallow `/api` · `Sitemap:` absolute |
| SEO-0.3 | Twitter Card در metadata builders |
| SEO-0.4 | unit tests MKT-17..18 |

### SEO-1 — JSON-LD + contract (→ ۷)

| ID | کار |
|----|-----|
| SEO-1.1 | Urban `Event` JSON-LD |
| SEO-1.2 | guest-club `Event` stub |
| SEO-1.3 | SDK `validateStructuredData()` |
| SEO-1.4 | exposure deny `structuredData` |
| SEO-1.5 | BreadcrumbList JSON-LD detail |
| SEO-1.6 | **`catalogUpdatedAt` on `PublicCatalogCard` + workspace mappers** |
| SEO-1.7 | **Rich TouristTrip: `offers`, `image`, `url`, `dateModified`** |
| SEO-1.8 | **SMK-MKT-06** JSON-LD present |

### SEO-2 — Manifest + guard (→ ۷.۵)

| ID | کار |
|----|-----|
| SEO-2.1 | ADR-GP-004 + schema `guestSeo` v2 |
| SEO-2.2 | `generateWorkspaceGuestSeo()` |
| SEO-2.3 | `resolveGuestSeoForPlugin()` fail-closed |
| SEO-2.4 | `guard-guest-seo.mjs` step **15/15** |
| SEO-2.5 | `workspace:create --guest` scaffolds |
| SEO-2.6 | `richResultsProfile` golden fixtures per workspace |
| SEO-2.7 | dual verify spec |

### SEO-3 — CI + E2E (→ ۸)

| ID | کار |
|----|-----|
| SEO-3.1 | **SMK-MKT-07** title/og/twitter |
| SEO-3.2 | **SMK-MKT-08** sitemap 200 + tour URL |
| SEO-3.3 | `guest-seo-e2e-hooks.yaml` |
| SEO-3.4 | tag `marketing-seo-{tenantId}` on publish |
| SEO-3.5 | `guard-public-catalog-m17` +5 checks |
| SEO-3.6 | promote `docs/dev/guest-seo-conformance.md` |

### SEO-4 — i18n + layout schema (→ ۸.۵)

| ID | کار |
|----|-----|
| SEO-4.1 | **`localePrefix: 'as-needed'`** — breaking: update M9 doc + smokes |
| SEO-4.2 | `metadata.alternates.languages` fa / en |
| SEO-4.3 | Organization + WebSite JSON-LD layout |
| SEO-4.4 | **SMK-MKT-09** `/en/tours` hreflang |
| SEO-4.5 | **sitemap `xhtml:link` alternates** per URL (Google i18n sitemap) |

### SEO-5 — Quality gates (→ ۹)

| ID | کار |
|----|-----|
| SEO-5.1 | `validate-json-ld.mjs` + `richResultsProfile` |
| SEO-5.2 | wire در guard-guest-seo |
| SEO-5.3 | Lighthouse **SEO ≥ 90** (`/tours` + detail) |
| SEO-5.4 | `guard-marketing-semantic-seo.mjs` |
| SEO-5.5 | OG `width`/`height` on images |

### SEO-5+ — 9.5 tier (→ ≥ ۹.۵) — **جدید v3**

| ID | کار | verify |
|----|-----|--------|
| SEO-5+.1 | **`generateMetadata` pagination:** `?cursor`/`?city` → `robots: { index: false, follow: true }` | MKT-19 |
| SEO-5+.2 | sitemap **exclude** any URL with query string | unit |
| SEO-5+.3 | **ItemList JSON-LD** on `/tours` (first page only, top N items) | MKT-20 |
| SEO-5+.4 | **image sitemap** entries for tours with `coverImageUrl` | sitemap XML test |
| SEO-5+.5 | **WebSite `potentialAction` SearchAction** → city filter | layout JSON-LD test |
| SEO-5+.6 | **hreflang `x-default`** → default locale URL | MKT-21 |
| SEO-5+.7 | **visible `<nav aria-label="Breadcrumb">`** on detail (matches JSON-LD) | semantic guard |
| SEO-5+.8 | **Lighthouse CI:** Performance ≥ **85** · LCP ≤ **2.5s** · CLS ≤ **0.1** | `lighthouserc.json` |
| SEO-5+.9 | **SMK-MKT-10** — `/tours?cursor=x` has `noindex` | Playwright |
| SEO-5+.10 | **SMK-MKT-11** — parse JSON-LD · assert `offers` + `image` on Denali detail | Playwright |
| SEO-5+.11 | **IndexNow** `POST` on publish (env-gated `INDEXNOW_KEY`) | API spec optional |
| SEO-5+.12 | **HTTPS-only `metadataBase`** in production (`guard-marketing-seo-prod.mjs`) | guard |

**Gate 9.5:**

```bash
pnpm run guard:guest-plugin-conformance       # 15/15
pnpm run guard:marketing-semantic-seo
pnpm run guard:marketing-seo-prod             # new
pnpm --filter @apps/marketing test
pnpm --filter @apps/marketing run test:smoke
pnpm --filter @apps/marketing run test:lighthouse  # SEO≥90 Perf≥85 CWV
node --test scripts/test/workspace-guest-seo.spec.mjs
```

### SEO-6 — Production 10 (post-launch)

| ID | کار |
|----|-----|
| SEO-6.1 | GSC sitemap submit runbook per tenant |
| SEO-6.2 | Rich Results Test manual Denali + Urban |
| SEO-6.3 | Index coverage 30d review |
| SEO-6.4 | Architect sign-off ≥9.5 |
| SEO-6.5 | zero SEO waivers |

---

## 6. ماتریس نمره v3

| پایان فاز | نمره |
|-----------|------|
| الان | **۴** |
| SEO-0 | **۶** |
| SEO-1 | **۷** |
| SEO-2 | **۷.۵** |
| SEO-3 | **۸** |
| SEO-4 | **۸.۵** |
| SEO-5 | **۹** |
| **SEO-5+** | **≥ ۹.۵** |
| SEO-6 | **۱۰** |

---

## 7. ترتیب PR (P14)

| PR | فاز | محدوده |
|----|-----|--------|
| PR-1 | SEO-0 | marketing shell |
| PR-2 | SEO-1 | SDK contract + workspace JSON-LD rich |
| PR-3 | SEO-2 | doc-first manifest/guard |
| PR-4 | SEO-3 | smokes + m17 |
| PR-5 | SEO-4 | i18n routing breaking + layout schema |
| PR-6 | SEO-5 | Lighthouse SEO + validator + semantic |
| PR-7 | SEO-5+ | pagination · ItemList · CWV · image sitemap |

**وابستگی:** PR-7 بعد از PR-5 (hreflang) و PR-2 (`catalogUpdatedAt`).

---

## 8. Checklist ۹.۵/۱۰

### الزامی برای ۹.۵

- [ ] sitemap/robots host-aware · no query URLs
- [ ] pagination `noindex` (cursor/city)
- [ ] Twitter + OG + canonical + OG dimensions
- [ ] Denali/Urban/guest-club JSON-LD **Rich Results complete**
- [ ] ItemList on list · BreadcrumbList + visible nav on detail
- [ ] `catalogUpdatedAt` + sitemap `lastmod`
- [ ] `guestSeo` L2+ v2 admission
- [ ] guard 15/15 + semantic + prod HTTPS guard
- [ ] SMK-MKT-06..**11** green
- [ ] `localePrefix: as-needed` + hreflang + **x-default**
- [ ] Organization + WebSite + SearchAction
- [ ] Lighthouse SEO ≥90 · **Performance ≥85** · CWV budgets
- [ ] image sitemap
- [ ] JSON-LD validator + golden fixtures
- [ ] ADR-GP-004 + M9 doc update
- [ ] zero SEO waivers

**Sign-off:** `[ ] APPROVED guest SEO conformance ≥9.5 — YYYY-MM-DD`

### فقط برای ۱۰ (post-launch)

- [ ] GSC submitted + index coverage green
- [ ] Rich Results manual pass
- [ ] 30d monitoring runbook

---

## 9. تصمیم‌های معماری (v3)

### Pagination SEO policy

```
/tours              → index, canonical self, in sitemap, ItemList JSON-LD
/tours?city=tehran  → noindex, follow, NOT in sitemap, canonical → /tours
/tours?cursor=abc   → noindex, follow, NOT in sitemap, canonical → /tours
```

**دلیل:** cursor/city صفحات thin/duplicate برای Google · فیلتر city برای UX بماند ولی index نشود مگر SEO-7 آینده (landing pages per city) — خارج از scope 9.5.

### i18n breaking change

`localePrefix: never` → `as-needed` affects **همه** marketing smokes · budget ۱ PR جدا · doc M9 must update before merge.

### Rich JSON-LD minimum (Denali `tourist-trip-v1`)

| Property | Required |
|----------|----------|
| `@context`, `@type`, `name` | yes |
| `description` | if shortDescription set |
| `startDate` / `endDate` | if departure/end set |
| `image` | if coverImageUrl set |
| `url` | absolute tour detail |
| `dateModified` | from `catalogUpdatedAt` |
| `offers` | if `priceAmount` set (`Offer` + `price` + `priceCurrency`) |

---

## 10. لینک‌ها

- [`docs/workspaces/denali/public-catalog.md`](../docs/workspaces/denali/public-catalog.md) — M8, M9, M11
- [`docs/dev/guest-plugin-conformance.md`](../docs/dev/guest-plugin-conformance.md)
- [`packages/workspace-sdk/src/tour/public-catalog.contract.ts`](../packages/workspace-sdk/src/tour/public-catalog.contract.ts)
- [`packages/workspaces/denali/src/catalog/build-denali-tourist-trip-jsonld.ts`](../packages/workspaces/denali/src/catalog/build-denali-tourist-trip-jsonld.ts)
- [`TEMP/marketing-guest-seo-roadmap.v2.bak.md`](./marketing-guest-seo-roadmap.v2.bak.md)

---

**Promote:** `docs/dev/guest-seo-conformance.md` @ SEO-2 · **Sign-off ≥9.5** @ SEO-5+ gate.
