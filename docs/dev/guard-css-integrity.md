# Guard specification — CSS ownership integrity

**Status:** ACTIVE (Phase 1 bootstrap split)

**Authority:** [css-ownership-model.mdoc](../standards/css-ownership-model.mdoc)

## Guard index

| Guard | Script | Stage | Severity |
| ----- | ------ | ----- | -------- |
| `guard-css-globals-import-only` | `scripts/guards/guard-css-globals-import-only.mjs` | pre-commit / PR | **fail** |
| `guard-css-bootstrap-integrity` | `scripts/guards/guard-css-bootstrap-integrity.mjs` | guest conformance + PR | **fail** |

## `guard-css-globals-import-only`

| Field | Value |
| ----- | ----- |
| **Purpose** | `apps/*/app/globals.css` remains import-only |
| **Failure** | Any rule block beyond `@import` and `@import "tailwindcss"` |
| **Apps** | `apps/portal`, `apps/marketing`, `apps/web` |

## `guard-css-bootstrap-integrity`

| Field | Value |
| ----- | ----- |
| **Purpose** | Bootstrap CSS trees contain no workspace leakage |
| **Inputs** | `portal-bootstrap.css`, `marketing-bootstrap.css`, `admin-bootstrap.css`, transitive `@import` under `packages/design-tokens/src/` |
| **Failure conditions** | `data-workspace-plugin=`, `.denali-`, `.urban-`, `.guest-club-`, `@app-tour/workspace-`, `packages/workspaces/` |
| **Cross-surface** | `portal-bootstrap` must not import `fallback-guest-marketing-shell`; `marketing-bootstrap` must not import `fallback-guest-portal-shell` |
| **L2 structure-only** | `fallback-guest-*-shell.css` must not use semantic color vars, `color-mix`, `backdrop-filter`, or `box-shadow` |

## ESLint — guest inline appearance

Portal and marketing `.eslintrc.cjs` block inline `style` props setting appearance CSS variables (`--color-`, `--primary`, `--background`, `--border`, `--accent`).

Structural `width` / `height` percentages remain allowed.

## Commands

```bash
pnpm run guard:css-globals
pnpm run guard:css-bootstrap-integrity
pnpm run guard:guest-plugin-conformance  # includes bootstrap integrity
```
