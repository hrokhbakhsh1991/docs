# Design System Master File — Urban

**Project:** Urban workspace (generic city tours)
**Category:** Minimal guest marketing + catalog

## Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#2563EB` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-primary-fg` |
| Background page | `#F8FAFC` | `--color-bg-page` |
| Surface | `#FFFFFF` | `--color-bg-surface` |
| Muted surface | `#F1F5F9` | `--color-bg-muted` |
| Text primary | `#1A1F26` | `--color-text-primary` |
| Text muted | `#64748B` | `--color-text-muted` |
| Border | `#E2E8F0` | `--color-border-default` |

**Skin entry:** `packages/workspaces/urban/theme/urban-marketing.css` → `theme/marketing/tokens.css`

## Typography

- **Body:** Inter (platform guest stack)
- **Headings:** platform `--font-family-base` (no display font)

## Surfaces

| Surface | Skin file |
|---------|-----------|
| Marketing | `theme/urban-marketing.css` |
| Portal | not yet scaffolded |
| Admin | not yet scaffolded |

## Rules

- Semantic tokens only in components — map brand in `theme/marketing/tokens.css`
- Shell TSX: structure + `data-*` only; appearance in workspace CSS
- City filter enabled via manifest `catalogPresentation.listFeatures`
