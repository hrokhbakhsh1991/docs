# Marketing Guest SEO — Roadmap to 9.9+/10

> **نسخه:** 4.0 (2026-07-02) — بازبینی **سخت‌گیرانه ۹.۹+**  
> **نوع:** TEMP → promote `docs/dev/guest-seo-conformance.md`  
> **Baseline:** **۴/۱۰** · **هدف v4:** **≥ ۹.۹/۱۰** pre-launch · **۱۰.۰** فقط GSC field data + index audit

---

## 0. Authority map

| # | سند | نقش |
|---|-----|-----|
| 1 | [`docs/workspaces/denali/public-catalog.md`](../docs/workspaces/denali/public-catalog.md) | M8 · M9 · M11 |
| 2 | [`docs/dev/guest-plugin-conformance.md`](../docs/dev/guest-plugin-conformance.md) | L0–L3 · guard 15 |
| 3 | ADR-GP-002 / ADR-GP-004 | manifest admission |
| 4 | [`docs/phase-19/p6/runbooks/host-subdomain-map.md`](../docs/phase-19/p6/runbooks/host-subdomain-map.md) | per-tenant host |
| 5 | [`TEMP/plugin-first-platform-migration-roadmap.md`](./plugin-first-platform-migration-roadmap.md) | P14/P15 |
| 6 | [`apps/web/app/(public)/catalog/`](../apps/web/app/(public)/catalog/) | M2b redirect chain |

---

## A. حکم سخت‌گیرانه — v3 به ۹.۹ می‌رسد؟

**خیر. سقف واقعی v3 ≈ ۹.۶–۹.۷/۱۰** (با اجرای کامل SEO-5+).

برای **۹.۹** هنوز ~۰.۲–۰.۳ نمره شکاف فنی داریم که v3 اصلاً نام نبرده یا آستانه‌هایش برای «سخت‌گیرانه» پایین است.

### جدول blocker — v3 → ۹.۹

| # | blocker | شواهد codebase | جریمه |
|---|---------|----------------|--------|
| 1 | **redirect موقت web→marketing** | `apps/web/.../catalog/page.tsx` → `redirect()` = **307** نه 308 | −۰.۱۵ (link equity) |
| 2 | **global `not-found` بدون metadata** | `app/not-found.tsx` — بدون `generateMetadata` / noindex | −۰.۱ |
| 3 | **mother host قابل index** | `app/page.tsx` mother shell — بدون `robots: noindex` | −۰.۱ |
| 4 | **maintenance surface** | `layout.tsx` maintenance — بدون noindex | −۰.۰۵ |
| 5 | **revalidate فقط catalog tag** | `api/revalidate/route.ts` — بدون `marketing-seo-*` / sitemap path | −۰.۱ |
| 6 | **Lighthouse آستانه ضعیف** | v3: SEO≥90 Perf≥85 — برای ۹.۹ کافی نیست | −۰.۱۵ |
| 7 | **بدون crawl CI** | هیچ اسکریپت orphan/broken-link روی sitemap | −۰.۱ |
| 8 | **بدون HTTP 404 E2E** | tour missing — metadata noindex هست ولی status 404 assert نیست | −۰.۰۵ |
| 9 | **بدون meta uniqueness guard** | title/description تکراری بین tours ممکن | −۰.۰۵ |
| 10 | **بدون `og:locale` / alternates** | فقط hreflang HTML — OG locale نیست | −۰.۰۵ |
| 11 | **JSON-LD تکی نه `@graph`** | یک script per type — Google ترجیح bundle | −۰.۰۵ |
| 12 | **Event ناقص Urban** | بدون `location` Place · `eventStatus` · `organizer` | −۰.۱ |
| 13 | **Offer بدون availability** | `spotsRemaining` در schema نیست | −۰.۰۵ |
| 14 | **LCP image unoptimized** | `isMarketingCatalogImageOptimizable` → false اگر env خالی | −۰.۱ |
| 15 | **بدون `sizes` / `priority` LCP** | `catalog-cover-image.tsx` — fixed width بدون responsive | −۰.۰۵ |
| 16 | **بدون RSS/Atom** | freshness discovery برای crawlers | −۰.۰۵ |
| 17 | **بدون sitemap ping** | publish فقط revalidate tag — ping موتور جستجو نیست | −۰.۰۵ |
| 18 | **SMK matrix ناقص** | ۵ smoke — نه ۳ plugin × ۲ locale × head asserts | −۰.۱ |
| 19 | **بدون tenant sitemap isolation test** | cross-tenant URL leak خطرناک | −۰.۱ |
| 20 | **بدون favicon/icons metadata** | `layout` — icons تعریف نشده | −۰.۰۳ |

**جمع:** ~۱.۴ نمره بالقوه · v3 با اجرای کامل ≈۹.۶ · **v4 فاز SEO-5++ این ۲۰ مورد را می‌بندد.**

---

## B. تعریف نمره (سخت‌گیرانه — v4)

| نمره | معیار |
|------|--------|
| **۴** | وضع فعلی |
| **۶** | sitemap/robots/Twitter |
| **۷** | JSON-LD workspace + guard schema |
| **۸** | guard 15 · E2E head |
| **۹** | i18n as-needed · Lighthouse SEO≥90 |
| **۹.۵** | pagination noindex · rich JSON-LD · CWV CI · image sitemap (SEO-5+) |
| **۹.۷** | + permanent redirect · surface noindex · revalidate SEO · crawl CI |
| **۹.۹** | + Lighthouse SEO≥**98** Perf≥**92** A11y≥**95** · SMK matrix · @graph · RSS · meta guards · tenant isolation |
| **۱۰.۰** | + GSC index≥95% · Rich Results live · 30d zero crawl errors · RUM CWV green |

**هدف v4:** **۹.۹** در **۹ فاز** (~۵–۶ هفته) · **۱۰** فقط post-launch.

---

## 1. NON-NEGOTIABLES (v4)

1–12 از v3 (manifest · no hand-edit · pagination noindex · `catalogUpdatedAt` · …).

13. **`permanentRedirect` (308)** برای web `/catalog` → marketing — نه 307.
14. **mother · maintenance · platform pages** → `noindex, nofollow`.
15. **global `not-found`** → metadata noindex + HTTP 404 در E2E.
16. **sitemap tenant isolation** — guard + smoke اجباری.
17. **Lighthouse SEO ≥98 · Performance ≥92 · Accessibility ≥95** برای gate ۹.۹.
18. **SMK-MKT-06..15** سبز (matrix کامل).
19. **crawl CI** — هر URL در sitemap → 200 + title + canonical.
20. **JSON-LD `@graph`** — یک script per page · validate کامل.
21. **revalidate** catalog + SEO tag + optional sitemap segment.
22. **title/description length + uniqueness** guards.
23. **zero SEO waivers** برای sign-off ۹.۹.

---

## 2. قراردادها (خلاصه)

### `PublicCatalogCard.catalogUpdatedAt` (از v3)
ISO-8601 · sitemap `lastmod` · JSON-LD `dateModified`.

### `guestSeo` v2 (از v3)
+ `richResultsProfile` · `pagination.noindexQueryParams` · `sitemap.includeImages`.

### جدید v4 — `guestSeo.marketing.surfaces`

```json
{
  "surfaces": {
    "motherHost": "noindex",
    "maintenance": "noindex",
    "home": "index",
    "toursList": "index",
    "tourDetail": "index"
  },
  "redirectPolicy": {
    "webCatalogToMarketing": "permanent308"
  }
}
```

---

## 3. Inventory gaps (کامل تا ۹.۹)

| ID | کمبود | فاز |
|----|--------|-----|
| SEO-GAP-01..25 | از v3 | SEO-0..5+ |
| **SEO-GAP-26** | web catalog **308** permanent redirect | SEO-5++ |
| **SEO-GAP-27** | `not-found.tsx` generateMetadata noindex | SEO-5++ |
| **SEO-GAP-28** | mother/maintenance/home metadata policy | SEO-5++ |
| **SEO-GAP-29** | revalidate SEO tag + sitemap segment | SEO-5++ |
| **SEO-GAP-30** | crawl CI (`scripts/crawl-marketing-sitemap.mjs`) | SEO-5++ |
| **SEO-GAP-31** | meta length guard (title≤60 desc≤160 warn) | SEO-5++ |
| **SEO-GAP-32** | meta uniqueness across catalog | SEO-5++ |
| **SEO-GAP-33** | `og:locale` + `og:locale:alternate` | SEO-5++ |
| **SEO-GAP-34** | JSON-LD `@graph` bundler | SEO-5++ |
| **SEO-GAP-35** | Urban Event: Place · eventStatus · organizer | SEO-5++ |
| **SEO-GAP-36** | Offer `availability` از `spotsRemaining` | SEO-5++ |
| **SEO-GAP-37** | LCP: `priority` · `sizes` · image hosts required prod | SEO-5++ |
| **SEO-GAP-38** | `/feed.xml` Atom/RSS با `catalogUpdatedAt` | SEO-5++ |
| **SEO-GAP-39** | sitemap ping (Google/Bing) on publish | SEO-5++ |
| **SEO-GAP-40** | tenant sitemap isolation smoke | SEO-5++ |
| **SEO-GAP-41** | HTTP 404 + noindex E2E missing tour | SEO-5++ |
| **SEO-GAP-42** | favicon + apple-touch icons در metadata | SEO-5++ |
| **SEO-GAP-43** | hreflang reciprocal validator (fa↔en) | SEO-5++ |
| **SEO-GAP-44** | unpublish → URL حذف از sitemap ≤ revalidate window | SEO-5++ |
| **SEO-GAP-45** | JSON-LD XSS-safe stringify guard | SEO-5++ |
| **SEO-GAP-46** | host spoof guard در sitemap builder | SEO-5++ |
| **SEO-GAP-47** | `preconnect` CDN image origin | SEO-5++ |
| **SEO-GAP-48** | SMK matrix 3×2 (plugin×locale) | SEO-5++ |

---

## 4. فازهای اجرا

### SEO-0 → SEO-5+ (بدون تغییر محتوا — از v3)

مرجع: `marketing-guest-seo-roadmap.v3.bak.md` §5.

خلاصه مسیر: shell → JSON-LD → manifest → E2E → i18n → quality → **۹.۵**.

---

### SEO-5++ — 9.9 tier (→ ≥ ۹.۹) — **جدید v4**

#### 4.1 Redirect & surface indexation

| ID | کار | verify |
|----|-----|--------|
| SEO-5++.1 | `permanentRedirect` در web catalog list/detail | SMK-WEB-SEO-01 status 308 |
| SEO-5++.2 | mother `generateMetadata` → noindex | MKT-22 |
| SEO-5++.3 | maintenance layout → noindex | MKT-23 |
| SEO-5++.4 | `not-found.tsx` → `buildMarketingNotFoundMetadata` | MKT-24 |
| SEO-5++.5 | home `/` canonical + index (club hosts only) | MKT-25 |

#### 4.2 Revalidate & freshness

| ID | کار |
|----|-----|
| SEO-5++.6 | `buildMarketingSeoCacheTag(tenantId)` + revalidate route |
| SEO-5++.7 | API publish → dual tag (catalog + seo) |
| SEO-5++.8 | unpublish → sitemap omit + 404 detail (SMK-MKT-14) |
| SEO-5++.9 | sitemap ping helper (env-gated) on publish |

#### 4.3 Rich schema v2

| ID | کار |
|----|-----|
| SEO-5++.10 | `@graph` builder: Organization + WebSite + page entity |
| SEO-5++.11 | Urban Event v2: `location` · `eventStatus` · `organizer` |
| SEO-5++.12 | Offer `availability`: InStock/SoldOut از `spotsRemaining` |
| SEO-5++.13 | `validate-json-ld.mjs` v2 — Google Rich Results profiles |
| SEO-5++.14 | JSON-LD XSS guard — reject `</script>` in strings |

#### 4.4 Meta & social completeness

| ID | کار |
|----|-----|
| SEO-5++.15 | `og:locale` / `og:locale:alternate` |
| SEO-5++.16 | `guard-marketing-meta-quality.mjs` — length + duplicate titles |
| SEO-5++.17 | favicon + apple-touch-icon در root metadata |
| SEO-5++.18 | Twitter `site` / `creator` از tenant branding (optional field) |

#### 4.5 Performance SEO (CWV strict)

| ID | کار |
|----|-----|
| SEO-5++.19 | `CatalogCoverImage` — `priority` on detail · `sizes` responsive |
| SEO-5++.20 | prod guard: `MARKETING_IMAGE_REMOTE_HOSTS` required |
| SEO-5++.21 | `preconnect` image CDN in layout |
| SEO-5++.22 | Lighthouse: **SEO≥98 · Perf≥92 · A11y≥95 · BP≥95** |

#### 4.6 Crawl & isolation CI

| ID | کار |
|----|-----|
| SEO-5++.23 | `scripts/crawl-marketing-sitemap.mjs` — 200 · title · canonical · no duplicate |
| SEO-5++.24 | tenant isolation: denali sitemap ∩ urban = ∅ |
| SEO-5++.25 | hreflang reciprocal validator |
| SEO-5++.26 | host allowlist guard در sitemap (anti-spoof) |

#### 4.7 Discovery feeds

| ID | کار |
|----|-----|
| SEO-5++.27 | `app/feed.xml/route.ts` — Atom · top N tours · `updated` |
| SEO-5++.28 | `robots.txt` → `Sitemap:` + optional feed link comment |

#### 4.8 E2E matrix (SMK-MKT-06..15)

| ID | سناریو |
|----|--------|
| SMK-MKT-06 | JSON-LD present (denali) |
| SMK-MKT-07 | head meta tour detail |
| SMK-MKT-08 | sitemap.xml |
| SMK-MKT-09 | hreflang en |
| SMK-MKT-10 | pagination noindex |
| SMK-MKT-11 | rich JSON-LD offers+image |
| SMK-MKT-12 | urban Event schema fields |
| SMK-MKT-13 | guest-club minimal schema |
| SMK-MKT-14 | unpublish → 404 + absent sitemap |
| SMK-MKT-15 | matrix: fa+en × denali+urban head snapshot |

**Gate 9.9:**

```bash
pnpm run guard:guest-plugin-conformance          # 15/15
pnpm run guard:marketing-semantic-seo
pnpm run guard:marketing-meta-quality            # new
pnpm run guard:marketing-seo-prod
pnpm run guard:marketing-sitemap-host              # new
node scripts/crawl-marketing-sitemap.mjs --smoke-host denali.localhost:3002
pnpm --filter @apps/marketing test
pnpm --filter @apps/marketing run test:smoke
pnpm --filter @apps/marketing run test:smoke:urban
pnpm --filter @apps/marketing run test:lighthouse  # strict thresholds
pnpm --filter @apps/web run test:smoke --grep WEB-SEO  # 308 redirect
```

---

### SEO-6 — 10.0 (post-launch only)

| ID | کار |
|----|-----|
| SEO-6.1 | GSC property per tenant · sitemap submit |
| SEO-6.2 | Index coverage ≥95% valid |
| SEO-6.3 | Rich Results live check (manual + API if available) |
| SEO-6.4 | Crawl stats — zero 5xx on catalog URLs 30d |
| SEO-6.5 | RUM CWV (CrUX) — LCP/INP/CLS green |
| SEO-6.6 | Architect sign-off **10.0** |

**قانون:** بدون SEO-6، سقف ادعا **۹.۹** است — honest cap.

---

## 5. ماتریس نمره v4

| پایان فاز | نمره |
|-----------|------|
| الان | **۴.۰** |
| SEO-0 | **۶.۰** |
| SEO-1 | **۷.۰** |
| SEO-2 | **۷.۵** |
| SEO-3 | **۸.۰** |
| SEO-4 | **۸.۵** |
| SEO-5 | **۹.۰** |
| SEO-5+ | **۹.۵** |
| SEO-5++ | **≥ ۹.۹** |
| SEO-6 | **۱۰.۰** |

---

## 6. آستانه Lighthouse (سخت‌گیرانه)

| Category | ۹.۵ (v3) | **۹.۹ (v4)** |
|----------|----------|--------------|
| SEO | ≥90 | **≥98** |
| Performance | ≥85 | **≥92** |
| Accessibility | — | **≥95** |
| Best Practices | — | **≥95** |
| LCP | ≤2.5s | **≤2.0s** |
| CLS | ≤0.1 | **≤0.05** |
| INP | ≤200ms | **≤150ms** |

**نکته:** mobile emulation اجباری · ۳ run median · cold cache.

---

## 7. ترتیب PR (P14)

| PR | فاز | محدوده |
|----|-----|--------|
| PR-1..7 | SEO-0..5+ | از v3 |
| **PR-8** | SEO-5++ (A+B) | redirect 308 · surfaces noindex · revalidate · @graph |
| **PR-9** | SEO-5++ (C–H) | crawl CI · RSS · Lighthouse strict · SMK matrix · guards |

**وابستگی:** PR-8 بعد از PR-5 و PR-7 · PR-9 آخر.

---

## 8. Checklist ۹.۹/۱۰

### الزامی ۹.۹ (همه باید ✅)

- [ ] v3 checklist کامل (۹.۵)
- [ ] web catalog **308** permanent redirect
- [ ] mother · maintenance · not-found noindex
- [ ] revalidate catalog + SEO tags
- [ ] unpublish → 404 + sitemap omit
- [ ] `@graph` JSON-LD · Event v2 · Offer availability
- [ ] og:locale alternates · favicon metadata
- [ ] meta length + uniqueness guards
- [ ] crawl sitemap CI · tenant isolation
- [ ] hreflang reciprocal validator
- [ ] RSS/Atom feed
- [ ] LCP image priority/sizes · prod image hosts guard
- [ ] Lighthouse **SEO≥98 Perf≥92 A11y≥95**
- [ ] SMK-MKT-06..**15** green
- [ ] SMK-WEB-SEO-01 redirect 308
- [ ] zero SEO waivers

**Sign-off:** `[ ] APPROVED guest SEO conformance ≥9.9 — YYYY-MM-DD`

### فقط ۱۰.۰

- [ ] GSC index ≥95%
- [ ] CrUX CWV green
- [ ] 30d zero crawl errors
- [ ] Rich Results live pass

---

## 9. تصمیم‌های معماری v4

### Redirect policy (M2b amendment)

```
GET /catalog        → 308 → {marketing}/tours
GET /catalog/{id}   → 308 → {marketing}/tours/{id}
```

**Doc-first:** amend `public-catalog.md` M2b قبل از PR-8.

### Surface indexation matrix

| Surface | robots | sitemap |
|---------|--------|---------|
| mother `/` | noindex | exclude |
| maintenance | noindex | exclude |
| club `/` | index | include |
| `/tours` | index | include |
| `/tours/{id}` | index | include |
| `?cursor` / `?city` | noindex | exclude |
| global 404 | noindex | exclude |

### چرا ۹.۹ ≠ ۱۰

| ۹.۹ | ۱۰ |
|-----|-----|
| همه automation سبز | + GSC real crawl |
| Lighthouse lab | + CrUX field data |
| SMK matrix | + 30d production metrics |
| Rich Results validator CI | + Google live Rich Results |

---

## 10. لینک‌ها

- [`TEMP/marketing-guest-seo-roadmap.v3.bak.md`](./marketing-guest-seo-roadmap.v3.bak.md) — فازهای SEO-0..5+
- [`apps/marketing/app/not-found.tsx`](../apps/marketing/app/not-found.tsx) — gap SEO-GAP-27
- [`apps/web/app/(public)/catalog/page.tsx`](../apps/web/app/(public)/catalog/page.tsx) — gap SEO-GAP-26
- [`apps/marketing/app/api/revalidate/route.ts`](../apps/marketing/app/api/revalidate/route.ts) — gap SEO-GAP-29

---

**Promote:** `docs/dev/guest-seo-conformance.md` @ SEO-2 · **Sign-off ≥9.9** @ SEO-5++ gate · **10.0** @ SEO-6 only.
