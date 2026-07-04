# CP-SKILL decision log — Denali landing visual kickoff

**Date:** 2026-07-04  
**Skill:** `.cursor/skills/ui-ux-pro-max` ([upstream](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill))  
**Query:** `mountain hiking club outdoor tour landing mobile trustworthy cinematic premium`

## Design-system run (summary)

- Suggested pattern: Immersive/Interactive Experience → **REJECT** (perf, JS budget)
- Suggested style: Vibrant & Block-based → **PARTIAL** (section gaps, scroll-snap only)
- Suggested colors: navy `#1E3A5F` → **REJECT** (LOCK primary `#059669`)
- Suggested fonts: Outfit / Work Sans → **REJECT** (LOCK Calistoga + Inter/Vazirmatn)

## Landing domain (top match)

- **Hero + Testimonials + CTA** → **ADOPT** — aligns with manifest 4-block layout

## UX domain

- prefers-reduced-motion → **ADOPT**
- Touch targets ≥44px, gap ≥8px → **ADOPT**
- Mobile-first breakpoints → **ADOPT**
- Excessive motion (animate everything) → **REJECT**

## PR-4 closure (2026-07-04)

All visual checklist §7 items shipped:

- Assets: hero.webp + hero-og.webp
- CSS: hero scrim/fade, latest cover grid breakpoints, trust band, final CTA, sticky shell
- Hooks documented in marketing-catalog-ui.md
- OG metadata → hero-og.webp

**One-line rule unchanged:** Layout and motion vocabulary from skill; brand tokens from MASTER only.

## PR-9 closure (2026-07-04)

| Skill suggestion | Verdict | PR-9 action |
|------------------|---------|-------------|
| Ken Burns / cinematic hero | **ADOPT** | CSS `::before` only, reduced-motion off |
| Scroll-driven reveal | **ADOPT** | `animation-timeline: view()` + mount fallback |
| Glass search | **ADOPT** | `backdrop-filter` + solid fallback |
| Destination photo cards | **ADOPT** | cropped webp + hue filter per id |
| Equipment icon grid | **ADOPT** | CSS checklist cards, no emoji icons |
| Parallax JS / GSAP | **REJECT** | RSC-first, no client home boundary |
| Fake stats | **REJECT** | unchanged |
