# Home / Landing — design overrides

> **Spec:** [`marketing-landing.mdoc`](../../../docs/workspaces/denali/marketing-landing.mdoc) **v7-implementation-ready**  
> **Complete plan:** [`marketing-landing-complete-plan.mdoc`](../../../docs/workspaces/denali/marketing-landing-complete-plan.mdoc)  
> **Visual (PR-4):** [`marketing-landing-visual.mdoc`](../../../docs/workspaces/denali/marketing-landing-visual.mdoc)  
> **ADR:** [`ADR-GP-005`](../../../docs/dev/adr-guest-plugin/ADR-GP-005-guest-landing-manifest.md)  
> **Tokens:** [`MASTER.md`](../MASTER.md)

---

## Scope

Applies when `resolveGuestLandingFeatures(pluginId).variant === "full"` (denali). Urban/guest-club use minimal layout — no hero/latest/trust/final CSS until P16.

---

## Layout (375px)

```text
┌─────────────────────────┐
│ Shell  brand → /        │
│  drawer · sticky CTA    │
├─────────────────────────┤
│ HERO  section -hero     │
│  min(70vh,32rem)        │
│  gradient + hero.webp   │
│  H1 · lead · search     │
│  primary CTA            │
├─────────────────────────┤
│ FEATURED  bento 3-up    │
│ LATEST  snap → cards    │
│ CATEGORIES  chip links    │
│ DESTINATIONS  3 cards     │
├─────────────────────────┤
│ TRUST  logo · tagline   │
│ WHY    4-tile bento     │
│ JOURNEY timeline        │
│ TESTIMONIALS scroll     │
├─────────────────────────┤
│ FAQ    accordion        │
│ FINAL CTA accent band   │
│ FOOTER 4-col            │
└─────────────────────────┘
```

**Overlap:** first block after hero (`featured` or `latest`) uses negative top margin into hero scrim.

---

## Motion (PR-6)

| Token | Value | Use |
|-------|-------|-----|
| `--mkt-motion-fast` | 150ms | hover lift |
| `--mkt-motion-reveal` | 400ms | section fade-up |

**Rule:** `prefers-reduced-motion` disables reveal + hover transforms.

---

## PR-8 implementation (2026-07-04)

| Section | Component | Gate |
|---------|-----------|------|
| Gallery | `HomeGallery` | `gallery` + cover URLs from catalog |
| Equipment | `HomeEquipment` | `equipment` (static i18n) |
| Blog | `HomeBlogTeaser` | `blogTeaser` (off until CMS) |
| Skip link | shell | full landing only → `#main-content` |
| Home JSON-LD | `HomePageJsonLd` | ItemList when latest block renders |
| Hero image | `--mkt-hero-image` | `branding.marketingHeroUrl` optional |

Lighthouse CI: `lighthouserc.json` collects `/` + `/tours`.

---

## PR-7 implementation (2026-07-04)

| Section | Component | Gate |
|---------|-----------|------|
| Hero search | `HomeHero` form → `/tours?q=` | `heroSearch` |
| Featured bento | `HomeFeatured` | `featuredTours` + limit |
| Categories | `HomeCategories` | `categories` + derived labels |
| Destinations | `HomeDestinations` | `destinations` (static i18n) |

- One catalog fetch: `max(latest, featured, 12 if categories)`
- Featured = same catalog sort as latest (not editorial curation)
- `/tours?category=` filters client-side post-fetch

---

## PR-6 implementation (2026-07-04)

- `HomeWhy` · `HomeJourney` · `HomeTestimonials`
- Gates: `whyDenali` · `journey` · `testimonials`

---

## Typography (rem)

| Element | Mobile | ≥1024px | Token |
|---------|--------|---------|-------|
| Hero H1 | 1.75rem | 2.5rem | `--mkt-text-display` |
| Hero lead | 1rem | 1rem | `#fff` on overlay (not muted-foreground) |
| Section title | 1.125rem | 1.125rem | `--mkt-text-h2` |
| CTA | 1rem semibold | 1rem | `--mkt-text-body` |

---

## CSS migration (PR-1)

**Remove:** `header[data-marketing-home-header]` in `denali-marketing.css` + `urban-marketing.css`.

**Add:** `section[data-marketing-home-hero]`, `-featured`, `-latest`, `-categories`, `-destinations`, `-trust`, `-final-cta` — spec §8.3.

---

## Hooks (smoke + guard)

`data-marketing-home` · `-hero` · `-search` · `-featured` · `-latest` · `-categories` · `-destinations` · `-trust` · `-why` · `-journey` · `-testimonials` · `-faq` · `-final-cta`

**Deprecated:** `-home-header`, `DenaliHome*`.

---

## Copy semantics

- **Latest** block title = recent published (catalog sort) — i18n `home.full.latest.title`
- **Featured** block = same catalog sort, bento layout only — i18n `home.full.featured.title` (not «editorial pick»)

---

## PR-4 implementation (2026-07-04) — complete

| Item | Detail |
|------|--------|
| Assets | `hero.webp` 177KB · `hero-og.webp` 1200×630 94KB |
| Hero | scrim · bottom fade · CTA shadow/focus |
| Latest | cover 16:9 · 1/2/3-col breakpoints · meta/price hooks |
| Trust | centered band · logo 3rem |
| Final CTA | inverted button · reuses `hero.ctaPrimary` |
| Shell | sticky glass header · `data-marketing-brand-title` |
| OG | `page.tsx` → `/home/hero-og.webp` |

```bash
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py \
  "mountain hiking club landing mobile trustworthy" \
  --design-system -p "Denali Club" -f markdown
```

LOCK §16.2 in spec — ignore conflicting fonts/colors from skill output.

---

## PR-9 Visual Excellence (2026-07-04)

| Token / rule | Value |
|--------------|-------|
| `--mkt-motion-hero` | 600ms |
| `--mkt-ease-out` | cubic-bezier(0.16, 1, 0.3, 1) |
| Hero Ken Burns | `::before` on `[data-marketing-home-hero]` |
| fa headings | `--font-family-base` (Vazirmatn) |
| en headings | `--font-heading-en` (Calistoga) |
| Fallback cover | `/home/fallback-tour-cover.webp` |
| Gallery fallbacks | `/home/gallery/01–03.webp` |

Hero markup: `[data-marketing-home-hero-content]` wraps title/lead/actions/search; secondary CTA links `#why-denali` on `[data-marketing-home-why]`.

**PR-9 closure:** scroll reveal via `animation-timeline: view()`; equipment checklist grid; featured bento 2-row primary @1024px; cropped destination/gallery assets under `public/home/`.
