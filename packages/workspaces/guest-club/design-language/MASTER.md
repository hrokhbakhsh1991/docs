# Design System Master File — Guest Club

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
| Marketing | `theme/marketing.css` |
| Portal | not yet scaffolded |
| Admin | not yet scaffolded |

## Rules

- Scaffold workspace — extend tokens before production launch
- JSON-LD smoke (SMK-MKT-13) must stay green when changing skin
- Replace placeholder palette in `theme/marketing.css` when brand is finalized
