# Design System Master File — Guest Club

> **Authority (Phase E3):** Design brief / export only. Build authority is `packages/design-tokens/dtcg/workspaces/guest-club.tokens.json` → `theme/tokens.css` (`@generated`).

**Project:** Guest Club (smoke / scaffold workspace)
**Category:** Minimal landing + catalog SEO smoke

## Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Accent (workspace) | `#2563EB` | `--ws-color-accent` |
| Primary | `#2563EB` | `--color-primary` (marketing skin) |
| On Primary | `#FFFFFF` | `--color-primary-fg` |

**Skin entry:** `packages/workspaces/guest-club/theme/marketing.css`

## Typography

- Platform guest stack defaults (`--font-family-base`)

## Surfaces

| Surface | Skin file |
|---------|-----------|
| Marketing | `theme/marketing.css` (overlay on starter marketing default) |
| Portal | `theme/guest-club-portal.css` (overlay on `starter/theme/starter-portal.css` — Phase D.2) |
| Admin | not in scope (L3 scaffold — no operator admin skin) |

## Rules

- Scaffold workspace — extend tokens before production launch
- JSON-LD smoke (SMK-MKT-13) must stay green when changing skin
- Replace placeholder palette in `theme/marketing.css` when brand is finalized
