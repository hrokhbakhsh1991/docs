# Marketing Guest SEO — Roadmap to 9+/10

> **نسخه:** 2.0 (2026-07-02) — بازبینی استاندارد repo + ارتقا هدف به **≥ ۹/۱۰**  
> **نوع:** نقشه راه TEMP — پیش از promote به `docs/dev/guest-seo-conformance.md`  
> **Baseline سخت‌گیرانه:** **۴/۱۰** · **هدف v2:** **≥ ۹/۱۰** (۱۰ فقط با production crawl audit)

---

## 0. Authority map (هم‌تراز با TEMP استاندارد)

| اولویت | سند | نقش SEO |
|--------|-----|---------|
| 1 | [`docs/workspaces/denali/public-catalog.md`](../docs/workspaces/denali/public-catalog.md) | M8 SEO metadata · M11 revalidate · canonical host |
| 2 | [`docs/dev/guest-plugin-conformance.md`](../docs/dev/guest-plugin-conformance.md) | L0–L3 · guard bundle الگو · G4 sign-off |
| 3 | [`docs/dev/adr-guest-plugin/ADR-GP-002`](../docs/dev/adr-guest-plugin/ADR-GP-002-guest-extension-schema.md) | schema admission · `guestExtensionsVersion` |
| 4 | [`docs/dev/workspace-guest-extensions.schema.json`](../docs/dev/workspace-guest-extensions.schema.json) | manifest contract |
| 5 | [`docs/phase-17/platform-club-catalog-publish.mdoc`](../docs/phase-17/platform-club-catalog-publish.mdoc) | publish → `POST /api/revalidate` |
| 6 | [`docs/phase-19/p6/runbooks/host-subdomain-map.md`](../docs/phase-19/p6/runbooks/host-subdomain-map.md) | smoke host canonical · per-tenant origin |
| 7 | [`TEMP/marketing-public-catalog-enterprise-roadmap.md`](./marketing-public-catalog-enterprise-roadmap.md) | UI/extensibility مکمل (نه جایگزین) |
| 8 | [`TEMP/plugin-first-platform-migration-roadmap.md`](./plugin-first-platform-migration-roadmap.md) | P11/P14/P15/P16 |

**قانون extensibility (تکرار نکنید):** marketing **بدون** `import @app-tour/workspace-*` · SEO از API JSON + SDK resolver.

**قانون doc:** promote نهایی → `docs/dev/guest-seo-conformance.md` (نه `.mdoc` در workspaces).

---

## A. بازبینی استاندارد — roadmap v1 چقدر درست بود؟

### ✅ هم‌تراز با استاندارد repo

| آیتم v1 | تطابق |
|---------|--------|
| manifest `guestSeo` + codegen | ✅ مثل `catalogPresentation` / ADR-GP-002 |
| `guard-guest-seo.mjs` در conformance bundle | ✅ مثل 14-step guest-plugin |
| marketing بدون `pluginId` branch | ✅ ADR-MKT-004 |
| JSON-LD در JSX (نه Metadata API) | ✅ با `catalog-tour-detail.tsx` فعلی |
| PRهای جدا (single concern) | ✅ P14 plugin-first |
| ADR-GP-004 doc-first | ✅ covenant |

### ⚠️ ناقص یا نیاز اصلاح (v1 → v2)

| # | مشکل v1 | اصلاح v2 |
|---|---------|----------|
| 1 | بدون §0 Authority map | §0 اضافه شد |
| 2 | بدون NON-NEGOTIABLES | §1 اضافه شد |
| 3 | `guestExtensionsVersion: 2` بدون migration path | §3 — v2 admission + backfill script برای trunk |
| 4 | SEO-GAP-10 «بدون revalidate» | **اشتباه** — M11 موجود: `scheduleMarketingCatalogRevalidate` · tag `marketing-catalog-{tenantId}` |
| 5 | بدون dual verification (P15) | gen row + runtime smoke + unit |
| 6 | بدون `guest-seo-e2e-hooks.yaml` | SMK-MKT-06..09 در hooks manifest |
| 7 | بدون waiver pattern | `docs/dev/waivers/guest-seo-W001.yaml` |
| 8 | hreflang گزینه A برای ۸+ کافی نیست | **برای ۹+ گزینه B اجباری** (`localePrefix: as-needed`) |
| 9 | Phase SEO-4 خیلی کم‌جزئیات | §5 — SEO-4/5/6 بازطراحی برای ۹+ |
| 10 | بدون per-tenant sitemap/robots | host-aware dynamic sitemap (multi-tenant SaaS pattern) |
| 11 | بدون Organization/WebSite schema | layout JSON-LD |
| 12 | بدون semantic/a11y SEO guards | h1 واحد · img alt · link crawlable |

**حکم:** v1 **جهت درست** بود (~۷۰٪ استاندارد) · برای ۹+ و repo parity نیاز به v2 دارد.

---

## 1. NON-NEGOTIABLES (SEO pack)

1. **هیچ workspace L2+** بدون `guestSeo` + JSON-LD builder export merge نمی‌شود.
2. **هیچ manifest key جدید** بدون `workspace-guest-extensions.schema.json` + ADR-GP-004.
3. **هیچ hand-edit** روی `workspace-guest-seo.generated.ts`.
4. **marketing** هیچ `if (pluginId === …)` برای SEO ندارد — فقط `resolveGuestSeoForPlugin()`.
5. **JSON-LD** فقط در Server Component JSX · validate قبل از render.
6. **sitemap/robots** per-request host-aware · canonical absolute per tenant.
7. **یک PR = یک concern** (SEO-0 جدا از SEO-2).
8. **SMK-MKT-06+** سبز قبل از merge رفتار SEO.
9. **waivers** فقط `guest-seo-WNNN.yaml` · expiry ≤ 30 روز.
10. **promote doc** قبل از guard step 15 در CI اجباری.

---

## 2. تعریف نمره (سخت‌گیرانه — v2)

| نمره | معنی |
|------|------|
| **۴** (الان) | metadata + OG + canonical · JSON-LD فقط Denali · بدون sitemap/guard/hreflang |
| **۶** | + sitemap/robots/Twitter · unit tests · per-tenant host |
| **۷** | + `guestSeo` manifest · Urban/guest-club JSON-LD · guard schema |
| **۸** | + guard step 15 · E2E head + JSON-LD · revalidate tag split |
| **۹** | + `localePrefix: as-needed` · Lighthouse SEO ≥90 CI · BreadcrumbList · Rich Results validator · SEO hooks yaml |
| **۱۰** | + GSC index coverage green · zero waivers · L2+ SEO row در generated conformance |

**هدف v2:** **۹/۱۰** در **۶ فاز** (~۳–۴ هفته focused).

---

## 3. قرارداد `guestSeo` — admission v2

**ADR:** `docs/dev/adr-guest-plugin/ADR-GP-004-guest-seo-manifest.md`

### نسخه‌بندی (هم‌تراز ADR-GP-002)

| `guestExtensionsVersion` | معنی |
|--------------------------|------|
| **1** | فعلی trunk — `guestSeo` optional |
| **2** | `guestSeo` **required** for L2+ |

**Migration:** `scripts/migrate-guest-manifest-seo-v2.mjs` — trunk denali/urban/guest-club backfill از conventions.

```json
{
  "guestExtensionsVersion": 2,
  "guestSeo": {
    "marketing": {
      "listTitleKey": "seo.toursTitle",
      "listDescriptionKey": "seo.toursDescription",
      "detailTitleTemplate": "{tourTitle} — {siteName}",
      "jsonLd": {
        "required": true,
        "schemaTypes": ["TouristTrip"],
        "builderExport": "buildDenaliTouristTripJsonLd"
      },
      "openGraph": { "type": "website", "twitterCard": "summary_large_image" },
      "sitemap": { "changefreq": "weekly", "priority": 0.8 }
    }
  }
}
```

### Conformance extension (جدول L0–L3)

| Level | SEO requirement |
|-------|-----------------|
| L0–L1 | none |
| **L2+** | `guestSeo.marketing.jsonLd.required` + builder exists + unit spec |
| **L3** | + messages keys · SMK-MKT-06 pass for smoke tenant |

**Codegen:** `workspace-guest-seo.generated.ts` + row in `workspace-guest-conformance.generated.ts` (`seo: "required" | "n/a"`).

---

## 4. وضعیت فعلی — inventory (تصحیح‌شده)

### موجود ✅

| آیتم | مسیر |
|------|------|
| Metadata builders | `apps/marketing/src/seo/build-marketing-metadata.ts` |
| `metadataBase` per host | `resolveMarketingPublicOrigin()` |
| Canonical list/detail | `alternates.canonical` |
| OG image detail | `buildMarketingTourDetailMetadata` |
| 404 noindex | `buildMarketingNotFoundMetadata` |
| JSON-LD slot | `catalog-tour-detail.tsx` |
| Denali TouristTrip | `denali-catalog-card.ts` |
| Cache tags + revalidate | `catalog-fetch-options.ts` · `marketing-catalog-{tenantId}` |
| Publish → revalidate | `schedule-marketing-catalog-revalidate.ts` (API) |
| On-demand revalidate route | `apps/marketing/app/api/revalidate/route.ts` |
| Unit tests MKT-13..16 | `build-marketing-metadata.spec.ts` |

### کمبود ❌ (برای ۹+)

| ID | کمبود |
|----|--------|
| SEO-GAP-01 | `sitemap.ts` / `robots.ts` host-aware |
| SEO-GAP-02 | Twitter Card metadata |
| SEO-GAP-03 | `localePrefix: as-needed` + hreflang alternates |
| SEO-GAP-04 | `guestSeo` manifest block |
| SEO-GAP-05 | Urban/guest-club structuredData |
| SEO-GAP-06 | guard SEO در bundle |
| SEO-GAP-07 | E2E metadata/JSON-LD asserts |
| SEO-GAP-08 | workspace:create SEO scaffold |
| SEO-GAP-09 | exposure checklist `structuredData` |
| SEO-GAP-10 | tag `marketing-seo-{tenantId}` + sitemap `lastmod` از `updatedAt` |
| SEO-GAP-11 | Organization + WebSite JSON-LD در layout |
| SEO-GAP-12 | BreadcrumbList JSON-LD |
| SEO-GAP-13 | Lighthouse SEO CI gate |
| SEO-GAP-14 | Rich Results / JSON-LD schema validator در CI |
| SEO-GAP-15 | Semantic SEO guard (h1, alt, internal links) |

---

## 5. فازهای اجرا (v2 → ۹+)

### Phase SEO-0 — Shell baseline (→ ۶/۱۰)

| ID | کار | verify |
|----|-----|--------|
| SEO-0.1 | `app/sitemap.ts` — host از headers · URLs از catalog API · `lastmod` واقعی | unit XML |
| SEO-0.2 | `app/robots.ts` — disallow `/api` · prod vs non-prod · `Sitemap:` absolute | curl |
| SEO-0.3 | Twitter Card در metadata builders | MKT-17 |
| SEO-0.4 | `build-marketing-metadata.spec.ts` گسترش | marketing test |

---

### Phase SEO-1 — Workspace JSON-LD parity (→ ۷/۱۰)

| ID | کار |
|----|-----|
| SEO-1.1 | Urban → `Event` JSON-LD (city tours) |
| SEO-1.2 | guest-club → minimal `Event` stub |
| SEO-1.3 | SDK `validateStructuredData(json)` — `@context`, `@type`, required fields |
| SEO-1.4 | exposure deny `structuredData` when policy blocks |
| SEO-1.5 | BreadcrumbList در detail (`Home → Tours → {title}`) |
| SEO-1.6 | **SMK-MKT-06** — JSON-LD present |

---

### Phase SEO-2 — Manifest + guard (→ ۷.۵/۱۰)

| ID | کار |
|----|-----|
| SEO-2.1 | ADR-GP-004 + schema v2 `guestSeo` |
| SEO-2.2 | `generateWorkspaceGuestSeo()` |
| SEO-2.3 | `resolveGuestSeoForPlugin()` fail-closed L2+ |
| SEO-2.4 | `guard-guest-seo.mjs` — **step 15** |
| SEO-2.5 | `workspace:create --guest` scaffolds `guestSeo` |
| SEO-2.6 | marketing titles از resolver + workspace messages |
| SEO-2.7 | `workspace-guest-seo.spec.mjs` dual verify |

**Gate:** `guard:guest-plugin-conformance` **15/15**

---

### Phase SEO-3 — CI + E2E enforcement (→ ۸/۱۰)

| ID | کار |
|----|-----|
| SEO-3.1 | **SMK-MKT-07** — `<title>`, `og:title`, `twitter:card` |
| SEO-3.2 | **SMK-MKT-08** — `/sitemap.xml` 200 + contains tour URL |
| SEO-3.3 | `docs/dev/guest-seo-e2e-hooks.yaml` + guard |
| SEO-3.4 | Tag split: `marketing-seo-{tenantId}` on publish revalidate |
| SEO-3.5 | `guard-public-catalog-m17` +5 SEO checks |
| SEO-3.6 | GHA `phase-10-guard.yml` unchanged (already runs guest conformance) |
| SEO-3.7 | Promote `docs/dev/guest-seo-conformance.md` |

---

### Phase SEO-4 — i18n SEO + layout schema (→ ۸.۵/۱۰)

| ID | کار |
|----|-----|
| SEO-4.1 | **`localePrefix: 'as-needed'`** — `/en/tours/...` (اجباری برای ۹+) |
| SEO-4.2 | `metadata.alternates.languages` fa-IR / en-US |
| SEO-4.3 | Organization + WebSite JSON-LD در `app/layout.tsx` |
| SEO-4.4 | **SMK-MKT-09** — `/en/tours` hreflang + canonical |

---

### Phase SEO-5 — Quality gates (→ ۹/۱۰)

| ID | کار |
|----|-----|
| SEO-5.1 | `scripts/validate-json-ld.mjs` — schema.org required props per `schemaTypes` |
| SEO-5.2 | Wire validator در guard-guest-seo (static sample fixtures) |
| SEO-5.3 | Lighthouse CI — `lighthouserc.json` · SEO category ≥ **90** on `/tours` + detail |
| SEO-5.4 | `guard-marketing-semantic-seo.mjs` — one h1 · cover `alt` · register link crawlable |
| SEO-5.5 | Image `width`/`height` on OG (reduce CLS — indirect SEO) |

**Gate SEO-5:**

```bash
pnpm run guard:guest-plugin-conformance          # 15/15
pnpm run guard:marketing-semantic-seo            # new
pnpm --filter @apps/marketing test
pnpm --filter @apps/marketing run test:smoke
pnpm --filter @apps/marketing run test:smoke:urban
node --test scripts/test/workspace-guest-seo.spec.mjs
# Lighthouse: pnpm --filter @apps/marketing run test:lighthouse  (local/CI)
```

---

### Phase SEO-6 — Production closure (→ ۱۰/۱۰) — post-launch

| ID | کار |
|----|-----|
| SEO-6.1 | Google Search Console per smoke tenant — sitemap submit runbook |
| SEO-6.2 | Rich Results Test manual sign-off Denali + Urban |
| SEO-6.3 | Index coverage review (30 days) |
| SEO-6.4 | Architect sign-off · zero SEO waivers |
| SEO-6.5 | SEO row در `workspace-guest-conformance.generated.ts` |

---

## 6. ماتریس نمره v2

| پایان فاز | نمره |
|-----------|------|
| الان | **۴** |
| SEO-0 | **۶** |
| SEO-1 | **۷** |
| SEO-2 | **۷.۵** |
| SEO-3 | **۸** |
| SEO-4 | **۸.۵** |
| SEO-5 | **≥ ۹** |
| SEO-6 | **۱۰** |

---

## 7. ترتیب PR (استاندارد P14)

| PR | فاز | محدوده |
|----|-----|--------|
| PR-1 | SEO-0 | `apps/marketing` only |
| PR-2 | SEO-1 | `packages/workspaces/*` JSON-LD |
| PR-3 | SEO-2 | doc + schema + codegen + guard (doc-first) |
| PR-4 | SEO-3 | smokes + hooks yaml + m17 |
| PR-5 | SEO-4 | i18n routing + layout schema |
| PR-6 | SEO-5 | Lighthouse + semantic guard + validator |

---

## 8. Checklist بستن ۹/۱۰

- [ ] sitemap + robots host-aware
- [ ] Twitter + OG + canonical absolute
- [ ] Denali + Urban + guest-club JSON-LD validated
- [ ] BreadcrumbList + Organization schema
- [ ] `guestSeo` L2+ enforced (v2 admission)
- [ ] guard step 15 + semantic guard
- [ ] SMK-MKT-06..09 green
- [ ] `localePrefix: as-needed` + hreflang
- [ ] Lighthouse SEO ≥ 90
- [ ] JSON-LD validator in CI
- [ ] ADR-GP-004 promoted
- [ ] `guest-seo-e2e-hooks.yaml`
- [ ] zero SEO waivers

**Sign-off:** `[ ] APPROVED guest SEO conformance ≥9 — YYYY-MM-DD`

---

## 9. منابع خارجی (multi-tenant + Next.js 15)

| منبع | اعمال در roadmap |
|------|------------------|
| Next.js `app/sitemap.ts` / `app/robots.ts` | SEO-0 dynamic per host |
| Metadata API `metadataBase` + `alternates` | موجود · گسترش hreflang SEO-4 |
| JSON-LD در JSX (نه metadata object) | تأیید الگوی فعلی |
| Per-tenant sitemap + canonical domain | host-subdomain-map + `resolveMarketingPublicOrigin` |
| `lastmod` از `updatedAt` واقعی | SEO-0.1 + catalog card field |
| Tag-based cache invalidation on publish | گسترش M11 → SEO-3.4 |
| Rich Results / schema validation | SEO-5.1 |

---

## 10. لینک‌ها

- [`docs/dev/guest-plugin-conformance.md`](../docs/dev/guest-plugin-conformance.md)
- [`docs/workspaces/denali/public-catalog.md`](../docs/workspaces/denali/public-catalog.md) — M8, M11
- [`TEMP/marketing-public-catalog-enterprise-roadmap.md`](./marketing-public-catalog-enterprise-roadmap.md)
- [`TEMP/plugin-first-platform-migration-roadmap.md`](./plugin-first-platform-migration-roadmap.md)

---

**Promote target:** `docs/dev/guest-seo-conformance.md` at SEO-2 gate · **Architect sign-off for 9+** at SEO-5 gate.
