# Denali Token Drift Analysis — Admin vs User Portal

**Role:** Lead Design Systems Architect  
**Audit date:** 2026-07-07  
**Workspace:** Denali (`pluginId: denali`)  
**Surfaces compared:** Admin (`apps/web`) vs User Portal (`apps/portal`)

---

## 1. Source file map

The paths referenced in the audit brief do not exist as hand-edited JSON under `packages/workspaces/denali/theme/`. Denali semantic tokens are **DTCG-generated**:

| Surface | DTCG authority (edit here) | Generated CSS (do not edit) |
| ------- | -------------------------- | --------------------------- |
| **Admin** | `packages/design-tokens/dtcg/workspaces/denali.admin.tokens.json` | `packages/workspaces/denali/theme/admin-semantic-tokens.css` |
| **User Portal** | `packages/design-tokens/dtcg/workspaces/denali.portal.tokens.json` | `packages/workspaces/denali/theme/portal-semantic-tokens.css` |

**Third authority (brand contract):** `packages/workspaces/denali/workspace.manifest.json` → `theme` block (`--ws-*` keys) and `packages/workspaces/denali/src/denali.plugin.ts` → `cssVariables`.

**Scope selectors:**

- Admin light/dark: `body[data-workspace-plugin="denali"]` (+ dark cascade)
- Portal light only: `body[data-app-surface="portal"][data-workspace-plugin="denali"]`

---

## 2. Authority model — which values win?

```text
                    ┌─────────────────────────────────────┐
                    │  workspace.manifest.json  (theme)   │
                    │  denali.plugin.ts (cssVariables)    │
                    │  → #0f766e forest brand contract    │
                    └─────────────────┬───────────────────┘
                                      │ aligns
                    ┌─────────────────▼───────────────────┐
                    │  denali.admin.tokens.json (DTCG)    │  ◄── AUTHORITATIVE
                    │  denali-forest-* / mist-* palette   │
                    └─────────────────┬───────────────────┘
                                      │ should adopt
                    ┌─────────────────▼───────────────────┐
                    │  denali.portal.tokens.json (DTCG)   │  ◄── DRIFTED (emerald)
                    │  independent #059669 palette        │
                    └─────────────────────────────────────┘
```

| Layer | Authoritative for Denali brand? | Rationale |
| ----- | --------------------------------- | --------- |
| **`workspace.manifest.json` `theme`** | **Yes** — workspace brand contract | Single config authority per platform-architecture-v2; all `--ws-*` values match admin DTCG |
| **`denali.admin.tokens.json`** | **Yes** — visual implementation for operator surface | Phase F reference slice; named palette (`forest`, `mist`, `alpine`); wizard + admin skins reference `#0f766e` |
| **`denali.portal.tokens.json`** | **No (today)** — divergent guest slice | Uses generic Tailwind-emerald hex (`#059669`) with no reference to `{denali.forest-600}` |
| **Portal `manifestTheme` runtime injection** | **Intended but ineffective** | `--ws-*` injected on inner `PlatformThemeProvider` div; portal skin CSS scopes to `body` and reads `--color-*` from portal DTCG only |

**Standard:** Portal (and marketing, which shares `#059669`) should **adopt Admin + manifest values** for shared semantic roles. Guest surfaces may keep **layout-only** differences (no sidebar tokens, optional display typography) but **not** a different primary green.

---

## 3. Tokens with identical values (no drift)

These shared keys resolve to the same computed value in light mode:

| Token key | CSS variable(s) | Value | Notes |
| --------- | --------------- | ----- | ----- |
| `color.primary-fg` | `--color-primary-fg`, `--primary-foreground` | `#ffffff` | |
| `color.bg-surface` | `--color-bg-surface`, `--card` | `#ffffff` | |
| `flat.destructive` | `--destructive` | `#dc2626` | |
| `flat.destructive-foreground` | `--destructive-foreground` | `#ffffff` | |

---

## 4. Primary tokens — same key, different values

Primary brand identifiers that exist on **both** surfaces but disagree:

| Token key | CSS variable | Admin value | Portal value | Δ (visual) | **Authoritative** |
| --------- | ------------ | ----------- | ------------ | ---------- | ----------------- |
| `color.primary` | `--color-primary`, `--primary` | `#0f766e` (`denali.forest-600`) | `#059669` (emerald-600) | Forest teal vs emerald green | **Admin** `#0f766e` |
| `color.primary-hover` | `--color-primary-hover` | `#0f5c4a` (`denali.forest-700`) | `#047857` (emerald-700) | Darker forest vs darker emerald | **Admin** `#0f5c4a` |
| `color.text-link` | `--color-text-link` | `#0f766e` (explicit forest) | `var(--color-primary)` → `#059669` | Follows primary drift | **Admin** `#0f766e` |
| `color.focus-ring` / `flat.focus-ring-color` | `--color-focus-ring` / `--focus-ring-color`, `--ring` | `rgb(15 118 110 / 0.35)` | `rgb(5 150 105 / 0.35)` | Ring hue tracks primary | **Admin** `rgb(15 118 110 / 0.35)` |

### Primary palette primitives (Admin-only today, should be shared)

Portal has **no** named Denali palette. These admin primitives underpin primary semantics and should be referenced by portal DTCG after unification:

| Primitive | CSS variable | Value | Portal equivalent |
| --------- | ------------ | ----- | ----------------- |
| `denali.forest-700` | `--denali-forest-700` | `#0f5c4a` | — (portal uses `#047857`) |
| `denali.forest-600` | `--denali-forest-600` | `#0f766e` | — (portal uses `#059669`) |
| `denali.forest-500` | `--denali-forest-500` | `#14b8a6` | — |
| `denali.mist-50` | `--denali-mist-50` | `#f4f7f4` | — (portal uses `#ecfdf5`) |
| `denali.mist-100` | `--denali-mist-100` | `#e8efe8` | — (portal uses `#f0f8f6`) |

---

## 5. Semantic tokens — same key, different values

Non-primary semantics present on both surfaces (light mode):

| Token key | CSS variable | Admin value | Portal value | **Authoritative** |
| --------- | ------------ | ----------- | ------------ | ----------------- |
| `color.bg-page` | `--color-bg-page`, `--background` | `#f4f7f4` (`denali.mist-50`) | `#ecfdf5` (emerald-50 wash) | **Admin** `#f4f7f4` |
| `color.bg-muted` | `--color-bg-muted`, `--muted` | `#e8efe8` (`denali.mist-100`) | `#f0f8f6` (cool mint) | **Admin** `#e8efe8` |
| `color.text-primary` | `--color-text-primary`, `--foreground` | `#1a1f26` (warm charcoal) | `#0f172a` (slate-900) | **Admin** `#1a1f26` |
| `color.text-muted` | `--color-text-muted`, `--muted-foreground` | `#6f7768` (olive gray) | `#64748b` (slate-500) | **Admin** `#6f7768` |
| `color.border-default` | `--color-border-default`, `--border` | `#dce5dc` | `#e1f2ed` | **Admin** `#dce5dc` |
| `color.border-subtle` | `--color-border-subtle`, `--input` | `#e8efe8` | `#e1f2ed` | **Admin** `#e8efe8` |
| `flat.radius` | `--radius` | `0.625rem` (10px) | `0.5rem` (8px) | **Admin** `0.625rem` (matches manifest `--ws-radius`) |

### Semantic role collision — `accent` (different meaning, same name)

| Surface | Token path | CSS variable | Value | Role |
| ------- | ---------- | ------------ | ----- | ---- |
| Admin | `flat.accent` | `--accent` | `#e8efe8` (mist-100) | Subtle UI highlight background |
| Portal | `color.accent` | `--color-accent` | `#d97706` (amber-600) | CTA / highlight color |
| Manifest | `theme` | `--ws-color-accent` | `#e8efe8` | Matches **admin** mist accent |

**Authoritative for `--ws-color-accent` / admin `flat.accent`:** `#e8efe8`.  
Portal amber `#d97706` is a **semantic misalignment** — if a CTA accent is needed on portal, introduce `color.accent-cta` or map to `color.warning` rather than overloading `accent`.

### Portal-only semantic (no admin `color.*` counterpart)

| Token key | CSS variable | Portal value | Unification note |
| --------- | ------------ | ------------ | ---------------- |
| `color.secondary` | `--color-secondary` | `#10b981` (emerald-500) | **Remove or re-map** to `{color.bg-muted}` / `{denali.mist-100}` to match admin `flat.secondary` pattern |
| `color.accent-fg` | `--color-accent-fg` | `#ffffff` | Revisit after accent role split |

---

## 6. Admin-only semantics (portal gap — not drift, but completeness)

These exist in `denali.admin.tokens.json` but are **absent** from the portal slice. Portal should **inherit authoritative values** when guest surfaces need status UI:

| Token key | CSS variable | Admin value (authoritative) |
| --------- | ------------ | --------------------------- |
| `color.text-secondary` | `--color-text-secondary` | `#4a5244` |
| `color.info` | `--color-info` | `#31547e` (`denali.alpine-600`) |
| `color.info-bg` | `--color-info-bg` | `#e8f0f8` |
| `color.success` | `--color-success` | `#166534` |
| `color.success-bg` | `--color-success-bg` | `#dcfce7` |
| `color.warning` | `--color-warning` | `#b45309` |
| `color.warning-bg` | `--color-warning-bg` | `#fff7ed` |
| `denali.shadow-card` | `--denali-shadow-card` | `0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px rgb(15 23 42 / 0.06)` |
| `denali.shadow-card-hover` | `--denali-shadow-card-hover` | `0 2px 4px rgb(15 23 42 / 0.06), 0 8px 20px rgb(15 23 42 / 0.08)` |
| Dark mode block | `html.dark` / `.theme-dark` | Full teal dark primary `#5eead4` | Portal is light-only today |

---

## 7. Manifest ↔ surface alignment matrix

| Manifest `--ws-*` key | Manifest value | Admin DTCG | Portal DTCG | Aligned? |
| --------------------- | -------------- | ---------- | ----------- | -------- |
| `--ws-color-primary` | `#0f766e` | `#0f766e` | `#059669` | Admin only |
| `--ws-color-primary-hover` | `#0f5c4a` | `#0f5c4a` | `#047857` | Admin only |
| `--ws-color-primary-fg` | `#ffffff` | `#ffffff` | `#ffffff` | Yes |
| `--ws-color-accent` | `#e8efe8` | `#e8efe8` (`flat.accent`) | `#d97706` | Admin only |
| `--ws-color-bg-page` | `#f4f7f4` | `#f4f7f4` | `#ecfdf5` | Admin only |
| `--ws-color-bg-surface` | `#ffffff` | `#ffffff` | `#ffffff` | Yes |
| `--ws-color-border-default` | `#dce5dc` | `#dce5dc` | `#e1f2ed` | Admin only |
| `--ws-color-border-subtle` | `#e8efe8` | `#e8efe8` | `#e1f2ed` | Admin only |
| `--ws-color-text-primary` | `#1a1f26` | `#1a1f26` | `#0f172a` | Admin only |
| `--ws-color-text-secondary` | `#4a5244` | `#4a5244` | — | Admin only |
| `--ws-color-text-muted` | `#6f7768` | `#6f7768` | `#64748b` | Admin only |
| `--ws-radius` | `0.625rem` | `0.625rem` | `0.5rem` | Admin only |

**11 of 12** comparable manifest keys align with Admin but **not** Portal.

---

## 8. Recommended authoritative standard (unified Denali light palette)

Adopt this single light-mode vocabulary for **Admin + Portal** (sourced from admin DTCG + manifest):

```json
{
  "denali": {
    "forest-700": "#0f5c4a",
    "forest-600": "#0f766e",
    "forest-500": "#14b8a6",
    "mist-50": "#f4f7f4",
    "mist-100": "#e8efe8"
  },
  "color": {
    "primary": "{denali.forest-600}",
    "primary-hover": "{denali.forest-700}",
    "primary-fg": "#ffffff",
    "bg-page": "{denali.mist-50}",
    "bg-surface": "#ffffff",
    "bg-muted": "{denali.mist-100}",
    "text-primary": "#1a1f26",
    "text-secondary": "#4a5244",
    "text-muted": "#6f7768",
    "text-link": "{denali.forest-600}",
    "border-default": "#dce5dc",
    "border-subtle": "#e8efe8",
    "focus-ring": "rgb(15 118 110 / 0.35)"
  },
  "flat": {
    "radius": "0.625rem",
    "destructive": "#dc2626",
    "destructive-foreground": "#ffffff",
    "accent": "{denali.mist-100}",
    "accent-foreground": "{denali.forest-700}"
  }
}
```

**Portal-specific exclusions (keep surface-local):** sidebar tokens, `shell-sidebar-width`, admin dark block — not required on portal.

---

## 9. Unification implementation plan

| Step | Action | Owner |
| ---- | ------ | ----- |
| **U1** | Refactor `denali.portal.tokens.json` to import shared `denali.*` primitives (extract shared block to `denali.semantic-base.tokens.json` or duplicate references from admin slice) | Design tokens |
| **U2** | Regenerate `portal-semantic-tokens.css` via `pnpm --filter @app-tour/design-tokens build` | CI |
| **U3** | Align `denali.marketing.tokens.json` primary (also `#059669` today) with forest-600 | Design tokens |
| **U4** | Add guard `guard-denali-cross-surface-primary` — fail CI if `color.primary` differs across admin/portal/marketing slices | Platform |
| **U5** | Bridge manifest `--ws-*` → `--color-*` on portal `body` (or codegen portal DTCG from manifest `theme` block) | workspace-sdk / design-tokens |
| **U6** | Resolve portal `color.accent` amber — demote to `color.accent-cta` or remove | Product + DS |

---

## 10. Drift summary

| Category | Count | Severity |
| -------- | ----- | -------- |
| Primary tokens with drift | **4** (`primary`, `primary-hover`, `text-link`, `focus-ring`) | **Critical** — visible brand split |
| Semantic tokens with drift | **7** (`bg-page`, `bg-muted`, `text-primary`, `text-muted`, `border-default`, `border-subtle`, `radius`) | **High** — “two products” feel |
| Accent role mismatch | **1** (mist vs amber) | **High** — naming collision |
| Matching tokens | **4** | — |
| Admin-only semantics missing on portal | **10+** | **Medium** — status/elevation gaps |
| Manifest aligned with portal | **1 / 12** keys | **Critical** — config lies to operators |

**Verdict:** Admin + `workspace.manifest.json` are the **authoritative Denali brand**. Portal DTCG is a **stale fork** using generic emerald Tailwind defaults. Unification requires editing `denali.portal.tokens.json` (not the generated CSS) and regenerating through the DTCG pipeline.

---

## 11. References

- `packages/design-tokens/dtcg/workspaces/denali.admin.tokens.json`
- `packages/design-tokens/dtcg/workspaces/denali.portal.tokens.json`
- `packages/workspaces/denali/workspace.manifest.json` (`theme` block)
- `docs/architecture/platform-architecture-v2.md` — L0 token authority
- `docs/dev/dtcg-pipeline-spec.mdoc` — Phase F admin/portal slice rules
- `SYSTEM_HEALTH_REPORT.md` §7 — UX/UI Token Drift (companion audit)
