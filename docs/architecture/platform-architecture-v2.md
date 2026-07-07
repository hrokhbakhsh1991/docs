# Platform Architecture v2 — Canonical Specification

**Status:** Architecture Freeze (Phase 1)  
**Effective:** 2026-07-06  
**Audience:** Platform engineers, workspace authors, principal reviewers  
**Scope:** Workspace Platform — admin (`apps/web`), portal (`apps/portal`), marketing (`apps/marketing`), API (`apps/api`), workspace packages, design system, codegen  
**Authority:** This document supersedes informal chat, scorecards, and roadmap optimism for **architectural decisions**. Implementation must conform to this spec; where code diverges, code is wrong until migrated.

**Related standards (detail, not duplicate):**

- [CSS ownership model](../standards/css-ownership-model.mdoc)
- [Shell · Skin · Primitives contract](../standards/shell-skin-primitives-contract.mdoc)
- [Workspace Routing Standard (WRS-001)](../standards/workspace-routing-standard.mdoc)
- [Member session / portal authority (PCMS-001)](../standards/member-session-portal-authority.mdoc)
- [P6 enterprise theming architecture](../phase-19/p6-enterprise-theming-architecture.mdoc)

---

## Executive summary

The Workspace Platform is a **manifest-driven, multi-tenant, multi-workspace** monorepo. Workspaces are **plugins**, not forks. The platform owns **behavior, contracts, and structure**; workspaces own **configuration and brand appearance** within contract bounds.

**Current state (honest):** Guest surfaces (portal, marketing) are **ahead** of admin on contract purity. Token and appearance authority is **fragmented**. One workspace (Denali) is a **reference implementation**, not a peer of stub workspaces. Workspace registry codegen is **modular** (Phase G, 2026-07-07) — thin entry + `scripts/codegen/workspace-registry/domains/*.mjs` + per-domain `--check`.

**Target state:** One configuration authority (`workspace.manifest.json`), one visual value authority (DTCG), generated registries, zero workspace-ID branching in platform apps, skin-owned appearance, platform-owned behavior.

---

## 1. Architecture principles

These principles are **immutable**. Exceptions require an ADR and architect approval.

### P1 — Manifest is the only configuration authority

All workspace-discoverable configuration—routes, surfaces, themes, member portal IA, catalog presentation, registration flow bindings, HTTP handlers, wizard surfaces—**must** be declared in `packages/workspaces/<id>/workspace.manifest.json` (or a manifest fragment explicitly merged at codegen time). No parallel JSON registries, no hardcoded workspace lists in platform source.

**Phase B resolved (2026-07-06):** Preset renamed to `guest-full-v1`; v1 memberPortal migration removed; `guard-member-portal-contract` is schema-driven; `guard-no-workspace-ids-in-codegen` enforces codegen purity. **Remaining:** `MEMBER_PORTAL_PRESETS` catalog (neutral names only) — inline modules in manifest is a future phase.

### P2 — No workspace names inside platform code

Platform apps (`apps/web`, `apps/portal`, `apps/marketing`, `apps/api`) and platform packages (`workspace-sdk`, `platform-core`, `workspace-plugin-host`) **must not** contain:

- `pluginId === "denali"` (or any workspace id)
- `workspaceType === "urban"` (or any workspace type)
- Direct imports from `@app-tour/workspace-<id>` (except generated loader indirection)

Workspace-specific behavior is reached **only** through generated bindings keyed by resolved `pluginId` at runtime.

**Phase C closed (2026-07-06):** production `pluginId === "denali"` / `workspaceType === "urban"` branches eliminated outside generated loaders + test-only paths. `guard-no-workspace-type-branches` enforces C1–C4. **2026-07-07:** `wizardTemplateGate.defaultPublishedStepId` manifest → codegen — last `wizard-template-gate-logic.ts` branch removed.

### P3 — Codegen derives everything discoverable

If the platform needs to know “which workspaces expose X,” the answer is **generated**, not hand-maintained. Run: `pnpm run generate:workspace-registry`.

**Outputs today:** 59 codegen outputs (see §7) — modular orchestrator under `scripts/codegen/workspace-registry/` (Phase G).

### P4 — Runtime never branches on workspace identity for product behavior

Runtime may use `pluginId` / `workspaceType` as **lookup keys** into generated maps. It must not use them in **conditional product logic** (`if denali then …`).

### P5 — Platform owns behavior; workspace owns implementation

The platform defines **contracts** (interfaces, reducers, hook shapes, manifest schema). Workspaces supply **implementations** registered through manifest exports. The platform must not embed Denali-specific wizard fields, catalog filters, or finance panels.

### P6 — Skin owns appearance

All visual appearance—color, typography, borders, shadows, decorative motion—on guest surfaces **must** live in workspace skin CSS (L4) or explicitly declared platform-default skin CSS loaded with the same rules. Shell TSX and platform packages **must not** carry appearance Tailwind or raw hex.

**Phase F partial (2026-07-06):** F7/F8 purge `patterns/`, `dashboard/`, `onboarding/` feature TSX to CSS hooks. **Remaining:** broader `apps/web` feature surfaces still use semantic Tailwind in `className` outside F8 registry — admin appearance debt (not guest shell).

### P7 — Tokens own color values (target)

No authoritative color may exist outside the token pipeline. CSS files, TSX, and docs may **reference** `var(--*)` only. Raw `#hex` in hand-maintained files is forbidden once DTCG pipeline is active.

**Phase E/F (2026-07-06):** DTCG is build authority for platform + workspace `theme/tokens.css`, light/dark themes, guest skin semantics, and admin semantic layers. `guard-dtcg-hex-ban` enforces `@generated` on authority CSS. `design-language/MASTER.md` is design brief only.

### P8 — Apps never import workspace implementations directly

Apps load workspace code through **generated loaders** (`workspace-plugin-loaders.generated.ts`, `workspace-guest-theme-stylesheets.generated.ts`, etc.) or workspace-plugin-host registration. Direct `@app-tour/workspace-denali/ui/*` in `apps/web` is a boundary violation.

### P9 — Single writer per state machine

Registration flow state bag: `@app-tour/catalog-registration-auth`. Transition merge: `applyCatalogRegistrationFlowEvent` in `workspace-sdk`. Workspaces supply steps and UI; they do not fork the reducer.

### P10 — Guest portal appearance has no tenant JS theme provider

Portal and marketing use `PlatformThemeProvider` for mode only. **No** `TenantThemeProvider` for brand ingress. Brand comes from CSS skin cascade.

Admin is exceptional: tenant branding preview may use `ThemeProviderChain` **only** under an explicit, scoped contract—not duplicated with conflicting CSS hex.

### P11 — Doc-first for contract changes

Changes to manifest schema, token hierarchy, or platform boundaries require updating this document and the relevant standard **before** implementation (per repo covenant).

### P12 — Fail closed

Guards and codegen validation reject unknown manifest shapes, boundary imports, and appearance in shell TSX. Prefer build failure over silent fallback.

---

## 2. Layer model

The platform uses **seven logical layers** (L0–L6). Bootstrap CSS imports are **not** a layer—they are composition only.

```
L0  Token authority (DTCG + registry meta)
L1  Generated platform CSS + TypeScript token types
L1b Framework bridge (Tailwind/shadcn var map)
L2  Shell structure (CSS + TSX hooks)
L3  Platform contracts (SDK, schemas, reducers)
L4  Generated registry & bindings
L5  Workspace configuration + implementation + skin
L6  Runtime (apps, API, dynamic loaders)
```

### L0 — Token authority

| | |
|---|---|
| **Responsibilities** | Canonical values for color, space, radius, typography, motion primitives; workspace token **extension schema** |
| **Owner** | Platform design system (`packages/design-tokens/dtcg/`) |
| **Allowed dependencies** | None (root authority) |
| **Forbidden dependencies** | CSS selectors, app code, workspace packages |
| **Human editable** | Yes — **only** hand-edited value source (target) |
| **Generated** | No |

**Today (2026-07-07):** DTCG JSON under `packages/design-tokens/dtcg/` is the **hand-edited value source**; `generate-dtcg-*.mjs` emits platform and workspace CSS. See [dtcg-pipeline-spec.mdoc](../dev/dtcg-pipeline-spec.mdoc).

### L1 — Generated platform CSS + types

| | |
|---|---|
| **Responsibilities** | `primitives.css`, `semantics.css`, `themes/light.css`, `themes/dark.css`, `generated/*.ts` |
| **Owner** | `@app-tour/design-tokens` |
| **Allowed dependencies** | L0 only |
| **Forbidden dependencies** | `data-*` selectors, workspace scopes, raw hex (target) |
| **Human editable** | **No** — regenerate via `pnpm --filter @app-tour/design-tokens build` |
| **Generated** | Yes |

### L1b — Framework bridge

| | |
|---|---|
| **Responsibilities** | `shell-bridge.css` — `@theme inline` mapping shadcn/Tailwind utilities to semantic CSS variables |
| **Owner** | Platform |
| **Allowed dependencies** | L1 variables |
| **Forbidden dependencies** | Layout rules, workspace scopes, hardcoded brand hex, duplicate theme palettes |
| **Human editable** | No (target) |
| **Generated** | Yes (target) |

**Critique:** Current `shell-bridge.css` (~507 lines) mixes bridge, dark operator palette, and operator component appearance. **Must be split** before enterprise scale.

### L2 — Shell structure

| | |
|---|---|
| **Responsibilities** | Layout, landmarks, a11y structure on `data-slot` / `data-portal-shell*` / `data-operator-*`; shell TSX in `apps/*/src/shell/` |
| **Owner** | Platform per app surface |
| **Allowed dependencies** | L1 spacing/layout tokens; no colors |
| **Forbidden dependencies** | Brand colors, workspace plugin selectors, shadcn in guest shells |
| **Human editable** | Yes |
| **Generated** | No |

**CSS files:** `fallback-guest-portal-shell.css`, `fallback-guest-marketing-shell.css`, `platform-infra-shell.css`, `guest-body-reset.css`, structural subset of `operator-admin-appearance.css`.

### L3 — Platform contracts

| | |
|---|---|
| **Responsibilities** | TypeScript contracts, Zod schemas, shared reducers, manifest JSON Schema, guard definitions |
| **Owner** | `workspace-sdk`, `catalog-registration-auth`, `guest-surface-host`, `tenant-kernel` |
| **Allowed dependencies** | L0 types; not workspace packages |
| **Forbidden dependencies** | `@app-tour/workspace-*`, workspace-named branches |
| **Human editable** | Yes |
| **Generated** | Partial (`*.generated.ts` re-exports contract shapes derived from manifests) |

### L4 — Generated registry & bindings

| | |
|---|---|
| **Responsibilities** | All `*.generated.ts` — plugin loaders, HTTP routes, theme loaders, member portal maps, catalog features |
| **Owner** | `scripts/generate-workspace-registry.mjs` (+ specialized codegen scripts) |
| **Allowed dependencies** | Manifest parse results; contract types from L3 |
| **Forbidden dependencies** | Hand-edited workspace lists; runtime logic |
| **Human editable** | **Never** |
| **Generated** | Always |

### L5 — Workspace configuration, implementation, skin

| | |
|---|---|
| **Responsibilities** | `workspace.manifest.json`, plugin entry, HTTP handlers, wizard surfaces, registration steps UI, **skin CSS** |
| **Owner** | Workspace package (`packages/workspaces/<id>/`) |
| **Allowed dependencies** | L3 contracts, L1 CSS variables, platform UI primitives |
| **Forbidden dependencies** | Platform apps; unscoped `:root` token overrides; imports from other workspaces |
| **Human editable** | Manifest + skin hooks yes; token values no (target — generated from workspace DTCG slice) |
| **Generated** | Token CSS slices (target); loaders are L4 |

### L6 — Runtime

| | |
|---|---|
| **Responsibilities** | Next.js apps, API server, dynamic `import()` of workspace plugin/theme, host→tenant resolution, session |
| **Owner** | `apps/*` |
| **Allowed dependencies** | L4 generated maps, L3 SDK, L2 shell components |
| **Forbidden dependencies** | Direct workspace packages; workspace-ID product branches |
| **Human editable** | Feature code within rules |
| **Generated** | No |

### Allowed dependency graph (summary)

```text
L0 → L1 → L1b
L0 → L1 → L2 (structure tokens only)
L0 → workspace slice → L5 skin (target)
L3 ← read by → L4 (codegen)
L4 → L6 (runtime lookup)
L5 implementations → registered into L4 outputs
L2/L5 skin → cascade consumed by L6 TSX
```

### Forbidden dependency graph (summary)

```text
L6 apps → @app-tour/workspace-<id>        (direct)
L6 → if (pluginId === "<workspace>")      (branch)
L3 platform-core → workspace packages
L2 → brand hex / workspace selectors
L5 skin → unscoped :root authority
L5 → duplicate manual route tables bypassing manifest
Bootstrap CSS → @import workspace packages
MASTER.md → runtime palette without CSS emission
```

---

## 3. Source of truth hierarchy

### Configuration & behavior chain

```text
workspace.manifest.json          ← ONLY human config authority
        ↓
scripts/generate-workspace-registry.mjs  (thin entry)
scripts/codegen/workspace-registry/orchestrator.mjs + domains/*.mjs
        ↓
*.generated.ts (L4)
        ↓
Runtime lookup by pluginId / workspaceType (L6)
        ↓
Workspace package implementation (L5)
```

### Visual value chain (target)

```text
dtcg/platform.tokens.json
dtcg/workspaces/<id>.tokens.json   (target)
        ↓
generate-tokens.mjs (invert: generate, not validate-only)
        ↓
themes/*.css, semantics.css, primitives.css, shell-bridge.css
        ↓
Bootstrap import chain (portal | marketing | admin)
        ↓
Workspace skin CSS (L5) — scoped overrides
        ↓
Computed visual result in browser
```

### Visual value chain (today — deprecated)

```text
themes/light.css (hand hex)  ─┐
MASTER.md (hand hex)         ─┼→ workspace theme/*.css → shell-bridge → platform-neutral-portal
operator-admin-appearance    ─┘
```

### Authorities

| Domain | Authority | Location |
|--------|-----------|----------|
| Workspace discovery | Manifest `id` | `packages/workspaces/*/workspace.manifest.json` |
| HTTP routes | Manifest `httpRoutes` | → `workspace-http-routes.generated.ts` |
| Member portal IA | Manifest `memberPortal` v2 | → `workspace-member-portal-contracts.generated.ts` |
| Registration flow binding | Manifest `catalogRegistrationFlow` | → `workspace-registration-flow-plugins.generated.ts` |
| Guest theme paths | Manifest `guestThemeStylesheets` | → `workspace-guest-theme-stylesheets.generated.ts` |
| Admin theme paths | Manifest `themeStylesheets` | → `workspace-theme-stylesheets.generated.ts` |
| Catalog presentation | Manifest `catalogPresentation` | → catalog `*.generated.ts` |
| Host → tenant | Tenant registry + WRS-001 | `tenant-kernel`, `guest-surface-host` |
| Member session | Portal authority (PCMS-001) | `apps/portal` |
| Registration state bag | `catalog-registration-auth` | package SSOT |
| Registration transitions | `applyCatalogRegistrationFlowEvent` | `workspace-sdk` |

### NOT authorities (must not be treated as SSOT)

| Artifact | Why deprecated as authority |
|----------|----------------------------|
| `themes/light.css` (hand-edited) | Must become generated from DTCG |
| `design-language/MASTER.md` | Design brief only; must not diverge from generated tokens |
| `MEMBER_PORTAL_PRESETS` in codegen | Parallel registry; violates P1 |
| `guard-member-portal-contract.mjs` workspace expectations | **Resolved Phase B** — schema-driven; `guard-no-workspace-ids-in-codegen` |
| `platform-neutral-portal.css` as permanent platform appearance | Violates P6 unless reclassified as `starter` default skin |
| Inline TSX Tailwind appearance in apps | Bypasses skin |
| Chat / roadmap / scorecards | Not build inputs |
| Denali implementation as implicit spec | Reference only, not contract |

---

## 4. Appearance architecture

This section removes ambiguity. **Appearance** = anything a user perceives as look-and-feel (color, type, shadow, radius, decorative animation). **Structure** = layout, reading order, tap targets, landmarks (no brand color).

### Ownership table

| Concern | Owner | Location | Notes |
|---------|-------|----------|-------|
| **Color values** | L0 DTCG (target) | `dtcg/*.json` → generated CSS | Today: `light.css` + workspace hex — **invalid long-term** |
| **Color consumption** | L1/L1b | `var(--color-*)`, `var(--primary)` | shadcn bridge maps utilities |
| **Spacing scale** | L0/L1 | `primitives.css` `--space-*` | Workspace may synthesize larger steps via `calc()` on vars |
| **Radius** | L0/L1 | `--radius`, `--radius-md` | |
| **Typography scale** | L0/L1 + font loading | `primitives.css`; `--font-family-base` on `<html>` only | Portal/marketing: inline font family allowed |
| **Motion (decorative)** | L5 skin | workspace `theme/*.css` | Respect `prefers-reduced-motion` |
| **Motion (functional)** | L2/L6 | focus rings, sheet transitions in primitives | Must use tokens |
| **Component styling (atoms)** | L4 ui-primitives | `*.module.css` bound to L1 vars | No workspace scope |
| **Component styling (shadcn)** | L6 admin primarily | `apps/web/src/components/ui/*` | **Debt:** must consume vars only; migrate to primitives or skin |
| **Layout (shell)** | L2 | `fallback-guest-*-shell.css`, shell TSX | No colors |
| **Layout (feature)** | L6 | feature components | Structure only in TSX; appearance in skin or utilities-from-vars |
| **Shell chrome appearance** | L5 skin | `*-portal.css`, `marketing/shell.css` | Platform-default skin only for `starter` workspace |
| **Feature UI appearance (guest)** | L5 skin | workspace theme component CSS | Denali marketing components model |
| **Feature UI appearance (admin)** | L5 skin + L6 | `admin-skin.css`, wizard skins | **Today mostly L6 Tailwind — non-compliant** |
| **Skins** | L5 workspace | `packages/workspaces/<id>/theme/` | Scoped: `body[data-app-surface][data-workspace-plugin]` |
| **Platform default skin** | L5 via `starter` workspace | `starter/theme/starter-portal.css` | **D2 done** — no longer in `design-tokens` |
| **Fallbacks** | L2 structure only | `fallback-guest-portal-shell.css` | Appearance forbidden |
| **Platform CSS (bootstrap)** | Composition | `*-bootstrap.css` | Import-only chain |
| **Bridge CSS** | L1b | `shell-bridge.css` | Var map only (target) |
| **Tailwind** | L6 apps | `globals.css` imports `tailwindcss` | Utilities must resolve to L1b vars, not arbitrary hex |

### Surface-specific rules

| Surface | Bootstrap | Theme ingress | Provider |
|---------|-----------|---------------|----------|
| **Portal** | `portal-bootstrap.css` | Dynamic `importGuestPortalThemeForPlugin` | `PlatformThemeProvider` only |
| **Marketing** | `marketing-bootstrap.css` | Dynamic `importGuestMarketingThemeForPlugin` | `PlatformThemeProvider` only |
| **Admin** | `admin-bootstrap.css` | Dynamic `importAdminThemeForPlugin` | `ThemeProviderChain` (tenant + workspace) — **must converge with CSS** |

### Cascade order (portal — normative)

```text
1. L1 index (primitives, semantics, themes)
2. L1b shell-bridge
3. L2 fallback-guest-portal-shell (structure)
4. L2 guest-body-reset, platform-infra
5. L5 platform-default skin OR starter workspace skin (target)
6. L5 workspace skin (dynamic import) — wins on equal specificity
```

**Today step 5 is `platform-neutral-portal.css` inside `design-tokens` — classify as transitional debt.

### Body contract (required)

```html
<body
  data-app-surface="portal | marketing | admin"
  data-workspace-plugin="{pluginId}"
  data-tenant-id="{tenantId}"
>
```

---

## 5. Workspace architecture

### Adding a new workspace (zero platform code changes — target)

1. `pnpm run workspace:create -- <id>` → scaffold `packages/workspaces/<id>/`
2. Author `workspace.manifest.json` (required fields below)
3. Implement plugin entry (`get<id>WorkspacePlugin`)
4. Add skin CSS under `theme/` (portal, marketing, admin as needed)
5. Add workspace DTCG slice (target) → generated `theme/tokens.css`
6. Run `pnpm run generate:workspace-registry`
7. Register workspace package in pnpm workspace (scaffold handles)
8. Tenant registry associates tenants with `pluginId` — **not** hardcoded in apps

**No changes to `apps/web`, `apps/portal`, `apps/marketing`, `apps/api` source** if manifest declares all surfaces.

**Today:** Step 8 fails if workspace needs urban-style API guards or Denali-style web imports — **platform code must not require those patterns**.

### Required manifest fields (minimum)

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | Yes | Stable plugin id |
| `version` | Yes | Manifest schema version |
| `package` | Yes | npm package name |
| `workspaceTypes` | Yes | Canonical type strings |
| `plugin.entry` / `plugin.export` | Yes | API plugin registration |
| `web.entry` / `web.export` | Yes | Admin web plugin registration |

### Common optional blocks (declare as needed)

| Block | Generates |
|-------|-----------|
| `http` / `httpRoutes` | API HTTP registry |
| `httpErrors` | Error map |
| `guestThemeStylesheets` | Portal/marketing theme loaders |
| `themeStylesheets` | Admin theme loader |
| `catalogRegistrationFlow` | Registration plugin + transport |
| `catalogPresentation` | List filters, detail sections |
| `memberPortal` v2 | Member portal contracts + surfaces |
| `memberProfile` | Profile field capabilities |
| `guestLanding` / `guestSeo` | Marketing landing + SEO |
| `guestConformance` | Conformance flags |
| `operatorCapabilities` | Operator API capability flags (`usersDirectory`, `reconciliationTriage`) |
| `wizardTemplateEditor` | Admin wizard template extended editor bindings |
| `tourWrite` / `canonicalTour` | Tour mutation bindings |
| `events` | Outbox side effects |
| `devBootstrap` | Dev/smoke seed bindings |

### Generated artifacts (from `generate-workspace-registry.mjs`)

| Output key | Path |
|------------|------|
| `sdk` | `packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts` |
| `api` | `apps/api/src/workspace/workspace-plugin-registry.generated.ts` |
| `web` | `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts` |
| `tourWrite` | `apps/api/src/tours/workspace-tour-write-bindings.generated.ts` |
| `canonicalTour` | `apps/api/src/canonical/workspace-canonical-tour-bindings.generated.ts` |
| `wizardMedia` | `apps/api/src/tours/workspace-wizard-media-bindings.generated.ts` |
| `wizardMediaRoutes` | `apps/web/src/bootstrap/wizard-media-route-bindings.generated.ts` |
| `wizardMediaBackendRoutes` | `apps/web/src/bootstrap/wizard-media-backend-route-bindings.generated.ts` |
| `wizardSurfaces` | `apps/web/src/bootstrap/wizard-surface-bindings.generated.ts` |
| `wizardLabels` | `apps/web/src/bootstrap/wizard-label-bindings.generated.ts` |
| `wizardI18nTranslators` | `apps/web/src/bootstrap/wizard-i18n-translator-hooks.generated.ts` |
| `workspaceWizardMessages` | `apps/web/src/bootstrap/workspace-wizard-message-loads.generated.ts` |
| `wizardCloneRemint` | `apps/api/src/tours/workspace-wizard-clone-remint-bindings.generated.ts` |
| `wizardCreate` | `apps/web/src/bootstrap/wizard-create-bindings.generated.ts` |
| `themeStylesheets` | `apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts` |
| `guestThemeStylesheetsPortal` | `apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts` |
| `guestThemeStylesheetsMarketing` | `apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts` |
| `workspaceIntakePlugins` | `packages/workspace-plugin-host/src/workspace-intake-plugins.generated.ts` |
| `registrationFlowPlugins` | `packages/workspace-plugin-host/src/workspace-registration-flow-plugins.generated.ts` |
| `registrationTransportInitializers` | `packages/workspace-plugin-host/src/workspace-registration-transport-initializers.generated.ts` |
| `catalogPaths` | `packages/workspace-sdk/src/catalog/workspace-catalog-paths.generated.ts` |
| `catalogListFeatures` | `packages/workspace-sdk/src/catalog/workspace-catalog-list-features.generated.ts` |
| `catalogDetailSections` | `packages/workspace-sdk/src/catalog/workspace-catalog-detail-sections.generated.ts` |
| `devPluginIds` | `packages/guest-surface-host/src/workspace-dev-plugin-ids.generated.ts` |
| `memberProfileCapabilities` | `packages/workspace-sdk/src/profile/workspace-member-profile-capabilities.generated.ts` |
| `memberPortalContracts` | `packages/workspace-sdk/src/portal/workspace-member-portal-contracts.generated.ts` |
| `memberPortalSurfaces` | `packages/workspace-sdk/src/portal/workspace-member-portal-surfaces.generated.ts` |
| `guestCrossSurfaceNav` | `packages/workspace-sdk/src/catalog/workspace-guest-cross-surface-nav.generated.ts` |
| `guestConformance` | `packages/workspace-sdk/src/catalog/workspace-guest-conformance.generated.ts` |
| `guestSeo` | `packages/workspace-sdk/src/catalog/workspace-guest-seo.generated.ts` |
| `guestLanding` | `packages/workspace-sdk/src/catalog/workspace-guest-landing.generated.ts` |
| `outbox` | `apps/api/src/workspace/workspace-outbox-side-effects.generated.ts` |
| `settingsEnrichers` | `apps/api/src/settings/workspace-settings-enrichers.generated.ts` |
| `devBootstrap` | `apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts` |
| `httpRoutes` | `apps/api/src/http/workspace-http-routes.generated.ts` |
| `httpHandlerLoaders` | `apps/api/src/http/workspace-http-handler-loaders.generated.ts` |
| `httpErrorMap` | `apps/api/src/middleware/workspace-http-error-map.generated.ts` |

### Workspace equality principle

All production workspaces must pass the **same manifest schema** and conformance guards. Implementation depth may differ during migration, but **stub workspaces must not be mistaken for finished architecture**. A 15-line portal skin is not equal to a 539-line skin.

---

## 6. Contracts

| Contract | Owner layer | Package / artifact | Workspace supplies |
|----------|-------------|-------------------|-------------------|
| **Registration flow** | L3 reducer + L4 plugins | `catalog-registration-auth`, `registration-flow.contract.ts`, `workspace-registration-flow-plugins.generated.ts` | `catalogRegistrationFlow` surface, steps, transport initializer |
| **Member portal** | L3 schema + L4 contracts | `workspace-member-portal-contracts.generated.ts`, `resolve-member-portal-routes.server.ts` | `memberPortal` v2 modules, availability |
| **Catalog** | L3 + L4 | `workspace-catalog-*.generated.ts`, public catalog surfaces | `catalogPresentation`, HTTP catalog handlers |
| **Theme / guest skin** | L4 loaders + L5 CSS | `workspace-guest-theme-stylesheets.generated.ts`, manifest `guestThemeStylesheets` | CSS files |
| **Theme / admin skin** | L4 loaders + L5 CSS | `workspace-theme-stylesheets.generated.ts` | `themeStylesheets` |
| **Admin wizard** | L4 bindings | `wizard-surface-bindings.generated.ts`, etc. | `wizardSurfaces`, `wizardI18n`, `wizardMedia` |
| **Portal app** | L6 + PCMS-001 | `apps/portal` | None (host only) |
| **Marketing app** | L6 + WRS-001 | `apps/marketing` | `guestLanding`, `guestSeo` |
| **Workspace SDK** | L3 | `packages/workspace-sdk` | Never imports workspaces |
| **HTTP** | L4 + L5 handlers | `workspace-http-routes.generated.ts` | `httpRoutes` groups |
| **Routing / hosts** | L3 WRS-001 | `tenant-kernel`, `guest-surface-host` | None |
| **Member profile** | L3 + L4 | `workspace-member-profile-capabilities.generated.ts` | `memberProfile` |

**Contract violation definition:** Any platform code that checks a specific workspace id instead of consulting generated maps.

---

## 7. Codegen architecture

### Current state

| Script | Responsibility |
|--------|----------------|
| `scripts/generate-workspace-registry.mjs` | Thin entry (~207 lines); orchestrator in `scripts/codegen/workspace-registry/orchestrator.mjs`; domain emitters under `domains/` |
| `scripts/member-portal-contract-codegen.mjs` | G4 re-export shim → `domains/member-portal.mjs` |
| `packages/design-tokens/scripts/generate-tokens.mjs` | TS types from `semantics.css`; DTCG validate-only |

Entry: `pnpm run generate:workspace-registry` (`--check` for CI).

### Division of responsibilities (normative)

| Domain | Generator owner |
|--------|-----------------|
| Plugin / SDK bindings | `generateSdkBindings`, `generateApiRegistry`, `generateWebLoaders` |
| HTTP surface | `generateWorkspaceHttpRoutes`, handlers, error map |
| Wizard admin | wizard* generators |
| Guest themes | `generateGuestThemeStylesheetLoader` |
| Admin themes | `generateAdminThemeStylesheetLoader` |
| Catalog | catalogPaths, listFeatures, detailSections |
| Member portal | `generateWorkspaceMemberPortalContracts` (+ merged preset logic) |
| Registration | `generateWorkspaceRegistrationFlowPlugins` |
| Guest marketing | guestLanding, guestSeo, guestCrossSurfaceNav |

### Future split (Phase G — complete)

Canonical module plan: [workspace-registry-codegen-modularization.mdoc](../dev/workspace-registry-codegen-modularization.mdoc).

```text
scripts/codegen/workspace-registry/
  constants.mjs           # G1 ✅
  manifest-loader.mjs     # G1 ✅
  validation.mjs          # G1 ✅
  utils.mjs               # G1 ✅
  orchestrator.mjs        # G3 ✅ — OUTPUT_PATHS, generateAllOutputs, CLI + --domain
  domains/*.mjs           # G2 ✅ + member-portal.mjs (G4 ✅)
scripts/generate-workspace-registry.mjs   # thin entry + re-exports (G3 ✅)
scripts/member-portal-contract-codegen.mjs  # G4 shim → domains/member-portal.mjs
```

**Why:** At 50+ workspaces, monolithic regeneration creates merge contention and opaque failures. Orchestrator + domain modules match Shopify/Stripe internal codegen patterns.

### Codegen rules

1. Generated files carry `AUTO-GENERATED` banner.
2. `--check` fails CI on drift.
3. No workspace id literals in generator **output** (presets are debt).
4. Manifest parse errors fail the build with workspace id in **error message only**.

---

## 8. Design token architecture (implemented — Phase E/F)

**Authority:** [dtcg-pipeline-spec.mdoc](../dev/dtcg-pipeline-spec.mdoc). DTCG JSON is input; CSS is generated output. Full monorepo gate (`ci:integrity`) deferred — Architect YES only.

### Pipeline (target)

```text
┌─────────────────────────────────────────────────────────────┐
│ L0  dtcg/platform.tokens.json                               │
│     dtcg/workspaces/<id>.tokens.json                        │
│     tokens.meta.json (generated schema registry)            │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
              generate-tokens.mjs (build authority)
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  primitives.css      themes/light.css    semantics.css
  themes/dark.css     shell-bridge.css    generated/*.ts
        │                   │
        └─────────┬─────────┘
                  ▼
           Tailwind @theme inline (L1b)
                  ▼
     Workspace generated theme/tokens.css (L5)
                  ▼
     Workspace skin hooks (L5 hand-authored, no hex)
```

### Token categories

| Category | DTCG namespace | CSS output |
|----------|----------------|------------|
| Primitives | `color.*`, `space.*`, `radius.*`, `font.*` | `--color-primary`, `--space-4` |
| Semantic | `semantic.surface`, `semantic.text.*` | `--color-text-primary`, aliases in `semantics.css` |
| Component | `component.button.*` (target) | optional component vars |
| Workspace override | `dtcg/workspaces/denali/*.json` | scoped in `body[data-workspace-plugin]` |
| shadcn bridge | generated from semantics | `--primary`, `--background` |

### Workspace overrides

- Workspace **may** override semantic tokens **only** under `body[data-app-surface][data-workspace-plugin="<id>"]`.
- Overrides are **generated** from workspace DTCG slice—not hand hex in `denali-portal.css`.
- Skin CSS files contain **selectors and layout**, referencing `var(--*)` only.

### Generated skins (target)

`theme/tokens.css` — generated, imported by hand-authored skin files.  
`theme/*-portal.css` — hooks only (no `#` literals).

### What changes when DTCG goes live

| Before | After |
|--------|-------|
| Edit `light.css` | Edit `platform.tokens.json`; CSS generated |
| Edit `MASTER.md` hex | Edit workspace DTCG; MD is export/docs only |
| `guard-dtcg-css-sync` validates 6 keys | Guard validates full generation hash |
| `accent` → `--color-warning` hack | Semantic names aligned in schema |

### Intentionally NOT in scope of first DTCG slice

- Motion keyframes (may remain skin-local until schema exists)
- Marketing per-component CSS files (migrate incrementally)
- Admin shadcn component internals (separate admin appearance program)

---

## 9. Scalability

Assumptions for scale:

1. Manifest schema stable; new workspaces add config, not platform branches.
2. Codegen modularized or cached per workspace domain.
3. DTCG generates all color values; CI bans raw hex.
4. Admin appearance migrated to skin/CSS-vars model.
5. Tenant registry scales independently (Postgres); plugin lookup O(1) map.
6. Dynamic `import()` per request acceptable with bundler chunk per workspace theme.

### 10 workspaces

| Dimension | Assessment |
|-----------|------------|
| Manifest + codegen | **Ready** with current generator |
| Guest surfaces | **Ready** if stubs gain real skins |
| Admin | **At risk** — Denali direct imports |
| Tokens | **Not ready** without DTCG pipeline |

### 50 workspaces

| Dimension | Assessment |
|-----------|------------|
| Monolithic codegen | **Bottleneck** — PR churn on 30+ files |
| Guard maintenance | **Bottleneck** — workspace-named guards must be schema-driven |
| Theme chunks | **OK** — dynamic import model scales |
| Skin parity enforcement | **Required** — conformance guards per surface |
| API | **Blocked** if workspace-type guards persist |

### 100 workspaces

| Dimension | Assessment |
|-----------|------------|
| Single registry script | **Not viable** — split codegen |
| Manual MASTER.md | **Not viable** — generated only |
| platform-neutral-portal | **Not viable** — starter default skin pattern |
| apps/web Tailwind debt | **Not viable** — blocks consistent theming |
| CI `--check` on all outputs | **OK** — industry standard |

**Verdict:** Architecture **can** scale to 100 workspaces **if** forbidden patterns are eliminated and codegen/tokens are modularized. **Cannot** scale by adding workspace #51 as a copy of Denali with platform branches.

---

## 10. Forbidden patterns

Explicit blacklist. Guards should enforce; until they do, code review must reject.

**Enforcement (Phase B–C):** `guard-no-workspace-ids-in-codegen` (codegen); `guard-no-workspace-type-branches` (`apps/api/src` urban branches; `tours-page-client` + `wizard-template-client` denali branches). Script: `pnpm run guard:no-workspace-type-branches`.

### Identity branching

```typescript
// FORBIDDEN
pluginId === "denali"
workspaceType === "urban"
manifest.id === "denali" ? "full" : "minimal"
```

### Imports

```typescript
// FORBIDDEN in apps/* and platform packages
import { ... } from "@app-tour/workspace-denali/..."
```

### Visual

```css
/* FORBIDDEN in hand-maintained files (post-DTCG) */
color: #059669;
background: #1e5a8e;
```

```tsx
// FORBIDDEN on portal/marketing shell and pages
className="bg-emerald-600 text-white rounded-lg"
style={{ color: '#059669' }}
style={{ ['--primary' as string]: '...' }}
```

### Registries

```typescript
// FORBIDDEN
const WORKSPACES = ["denali", "urban", "guest-club"];
const MEMBER_PORTAL_PRESETS = { "denali-full-v1": ... };
```

### Routes

```typescript
// FORBIDDEN — manual route tables for workspace features
const ROUTES = { denali: "/me/registrations" };
```

### State

```typescript
// FORBIDDEN — duplicate registration reducers
function resolveNextStep(state) { /* forked logic */ }
```

### Theme loading

```typescript
// FORBIDDEN
import "@app-tour/workspace-denali/theme/denali-portal.css";
// REQUIRED
await importGuestPortalThemeForPlugin(pluginId);
```

### Token definitions

```css
/* FORBIDDEN — unscoped root override in workspace skin */
:root { --color-primary: #059669; }
```

### Documentation as runtime SSOT

```markdown
# FORBIDDEN as palette authority without codegen
| Primary | #059669 |
```

in `MASTER.md` unless generated from DTCG.

### Bootstrap violations

```css
/* FORBIDDEN in portal-bootstrap.css */
@import "@app-tour/workspace-denali/theme/denali-portal.css";
body[data-workspace-plugin="denali"] { ... }
```

### Dual appearance ingress (admin)

Using **both** `ThemeProviderChain` JS variables **and** conflicting hex in CSS for the same semantic without documented precedence is forbidden.

**Denali admin dark mode** — resolved precedence (Phase F9, 2026-07-06):

| Priority | Layer | Selector / scope |
| -------- | ----- | ---------------- |
| 1 | Inline React (`TenantThemeProvider`, `WorkspaceThemeProvider`) | `[data-tenant-theme]`, `[data-workspace-theme]` — tenant primary omitted when `html.dark` (F9-4) |
| 2 | Denali admin DTCG | `body[data-workspace-plugin="denali"] .theme-dark` + `html.dark:has(…)` |
| 3 | Platform admin dark | `operator-admin-dark-semantics.css` (`.theme-dark`, `.dark`) |
| 4 | Platform theme | `themes/dark.css` (`.theme-dark` — platform `#5b9fd4`) |
| 5 | shadcn bridge | `shell-bridge.css` aliases |

Full conflict inventory, C4 mitigation (F9-4), and guards: [dtcg-pipeline-spec.mdoc § F9](../dev/dtcg-pipeline-spec.mdoc).

## 11. Open risks

| ID | Risk | Severity | Impact | Probability | Future consequence | Architectural direction |
|----|------|----------|--------|-------------|-------------------|-------------------------|
| R1 | DTCG not build authority | **Critical** | Token implementation rebuild twice | **High** | Drift, wrong colors in prod | Invert pipeline before coding |
| R2 | Denali privilege in `apps/web` | **Critical** | New workspaces need platform edits | **High** | 100 workspaces = 100 branches | Generated wizard bindings only |
| R3 | Monolithic codegen | **High** | Merge pain, slow CI | **High** | Team parallelism collapses | **Resolved Phase G** — domain modules + per-domain `--check` |
| R4 | Admin appearance in TSX | **High** | Theming impossible at scale | **High** | White-label admin fails | Admin skin program + AST guards |
| R5 | `platform-neutral-portal` in design-tokens | **High** | Split skin ownership | **Medium** | Cascade bugs at 100 themes | Move to starter workspace skin |
| R6 | Member portal presets | **Medium** | Violates P1 | **High** | New IA requires codegen edit | Manifest-only modules |
| R7 | MASTER.md parallel SSOT | **Medium** | Designer/dev drift | **High** | Wrong brand in workspace | Generate or demote |
| R8 | shell-bridge scope creep | **Medium** | Bridge changes break admin+guest | **Medium** | Fragile theming | Split bridge vs operator CSS |
| R9 | Urban API guards | **Medium** | Workspace #5 needs API patch | **Medium** | API not plugin-generic | Manifest-driven capability flags |
| R10 | Stub workspaces in prod matrix | **Low** | False confidence in equality | **Mitigated** | Phase H — `productionTier` + provision gate + Super Admin UX ([workspace-certification.mdoc](../dev/workspace-certification.mdoc)) |
| R11 | DTCG `accent`→`warning` mapping | **Low** | Wrong semantic generation | **Medium** | Broken CTA colors | Fix schema before generate |
| R12 | 69 guards without admin coverage | **Medium** | Green CI, red admin debt | **High** | Security/brand inconsistency | Extend appearance AST to admin |
| R13 | Over-engineered guard surface | **Low** | Maintenance cost | **Medium** | Slower iteration | Consolidate to schema-driven guards |

---

## 12. Migration roadmap (high level)

**No code in this freeze — phases only.**

### Phase A — Architecture freeze (complete 2026-07-06)

- Published this document.
- Halt structural debates; track divergence as debt tickets.
- **Current execution track (2026-07-07):** Phase G+H+I **merged to `main`** ([#19](https://github.com/hrokhbakhsh1991/docs/pull/19) · `6b27d9f6`).

### Phase B — Authority cleanup (configuration)

- Eliminate workspace IDs from codegen presets and guards.
- Remove `manifest.id === "denali"` migration paths.
- Schema-driven member portal conformance.

### Phase C — Platform boundary purge

**Sprint 1 (2026-07-06):**

- `operatorCapabilities` in manifest → `WORKSPACE_OPERATOR_CAPABILITIES` (API users directory + reconciliation triage).
- Settings/config gates use `settings-registry` only; urban `workspaceType` guards removed.
- `wizardTemplateEditor` manifest → `workspace-wizard-template-editor-bindings.generated.ts`.
- Tours list category filter uses `resolveCatalogListFeatures` (not `pluginId === "denali"`).
- Guard: `guard-no-workspace-type-branches` (API urban branches + C2 page clients).

**Sprint 2 (2026-07-06):**

- Tour edit flat-shell router (`tour-edit-page-client.tsx`) uses `isExtendedOperatorSession` — lookup against codegen `WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS` (same set as extended create chrome); `isDenaliOperatorSession` retained as deprecated alias for tests only.
- Guard extended: `tour-edit-page-client.tsx` must not import `isDenaliOperatorSession` or bind `isDenali` locals.

**Sprint 3 (2026-07-06) — C3 marketing catalog:**

- `marketingCatalog` manifest block → `apps/marketing/src/bootstrap/workspace-marketing-catalog-bindings.generated.ts`.
- Denali filter/PDP/category-family logic exported as `denaliMarketingCatalogSurface` from workspace package.
- `apps/marketing/src/catalog/**` uses `resolveMarketingCatalogSurface(pluginId)` — zero direct `@app-tour/workspace-denali` imports in catalog sources.
- Guard extended: `apps/marketing/src/catalog` scanned for workspace-denali imports.

**Sprint 4 (2026-07-06) — C4 wizard-field:**

- `wizard-field.tsx` enum option labels delegate to `resolveWizardEnumOptionLabel` via codegen `WizardLabelResolver` (no direct `@app-tour/workspace-denali/ui/adapters/field-labels`).
- Composite loading fallback uses `data-wizard-composite-loading` — no `fieldId.startsWith("denali.")` branch.

**Sprint 5 (2026-07-06) — C4 settings + tour codec bindings:**

Manifest blocks → `apps/web/src/bootstrap/*.generated.ts`:

| Block | Consumer |
| ----- | -------- |
| `tourActionSubmitCodec` | `workspace-create-tour-wizard-client`, `resolve-wizard-submit-error-message` |
| `settingsDestinationSurface` | `destination-form-logic`, `locations-settings-client` |
| `settingsEquipmentUi` | `equipment-settings-client` |
| `photoUploadErrors` | generated only (legacy `resolve-denali-photo-upload-error` shim removed) |

`destination-form-logic` and settings clients resolve surfaces via `pluginId` from operator session — no direct `@app-tour/workspace-denali` imports in those six P0-T-161 hits.

**Sprint 6 (2026-07-06) — C4 tour list + wizard template hints:**

- `tourListCategoryFilter` manifest → `workspace-tour-list-category-bindings.generated.ts`; `tour-list-category-logic` drops allowlist entry.
- `WizardTemplateEditorSurface.resolveCompositeRendererIdForAnchor` — `wizard-template-field-display-hints` no longer imports denali catalog-meta directly.

**Sprint 7 (2026-07-06) — C4 operator UI + draft chrome:**

- `operatorUiComponents` manifest → component shims (`denali-time-input`, map, slider) delegate to generated bindings.
- `wizardDraftUnification` manifest → `draft-unification-v3-options` tombstone log via bindings (no direct `@app-tour/workspace-denali/draft`).
- `create-tour-wizard-chrome` accepts `currentDraftKey` prop — uses `platformCreateTourDraftKey` at call site.

**Sprint 8 (2026-07-06) — C4 wizard bootstrap + create orchestration:**

- `wizardRules`, `wizardTemplatePreset`, `wizardDraftShell`, `wizardCreateChrome` manifest blocks → bootstrap bindings.
- `resolveSyncWorkspacePluginFromRegistry` in `workspace-plugin-loaders.generated.ts`.
- `denali-wizard-rules`, `denali-wizard-template-preset`, `denali-wizard-draft-shell`, `use-denali-create-tour-wizard` — no direct `@app-tour/workspace-denali` imports.

**Sprint 9 (2026-07-06) — C4 flat-edit orchestration:**

- `wizardFlatEditChrome`, `wizardFlatEditForm`, `wizardFlatEditPage` manifest blocks → bootstrap bindings.
- `wizardDraftShell` extended with `editTourDraftKey` for edit-draft namespace.
- `use-denali-flat-edit-page`, `denali-flat-edit-form-shell`, `denali-flat-edit-page-client` — no direct `@app-tour/workspace-denali` imports.

**Sprint 10 (2026-07-06) — C4 create client + bootstrap plugin resolver:**

- `wizardCreateView` manifest → `workspace-wizard-create-view-bindings.generated.ts`.
- `denali-create-tour-wizard-client` imports view via bindings (no `@app-tour/workspace-denali/ui/create-wizard`).
- `resolve-bootstrap-workspace-plugin` delegates to `resolveSyncWorkspacePluginFromRegistry` with starter fallback.
- `resolve-bootstrap-workspace-plugin.client` uses codegen for starter/urban; Denali keeps lightweight shell stub (no crypto graph).

**Sprint 11 (2026-07-06) — C4 wizard/denali adapter purge:**

- `wizardCompositeRegistry` manifest → `workspace-wizard-composite-registry-bindings.generated.ts`.
- `denali-validation-issue-label` uses composite registry bindings (no direct `@app-tour/workspace-denali/composites`).
- Removed dead web duplicates: flat-edit-form, tour-create-payload, draft-form-adapter, tour-kind-labels, review-surface, field-focus-registry.

**Sprint 12 (2026-07-06) — C close: pluginId branch purge:**

- `WizardLabelResolver.resolveValidationIssueLabel` — Denali composite-aware validation labels via label bindings (no `fieldLabelSurfaceId === "denali"` branch).
- `settingsHubFallback` manifest → `workspace-settings-hub-fallback-bindings.generated.ts`; consistency guard uses registry lookup (no `pluginId !== "denali"` branch).

**Remaining:**

- C4 `apps/web` production purge: **complete** — only codegen `*.generated.ts` loaders retain `@app-tour/workspace-denali` imports.
- Phase C: **closed** — production `pluginId === "denali"` branches eliminated outside codegen loaders.

### Phase D — Appearance decomposition

**D1 (done):** `shell-bridge.css` trimmed to L1b var-map only (`@theme inline` + shadcn semantic aliases). Operator admin layout extracted to `operator-shell-structure.css` (admin-bootstrap only). Duplicate dark palette block removed from shell-bridge — guest uses `themes/dark.css`; admin uses `operator-admin-appearance.css`.

| File | Layer | Surfaces |
| ---- | ----- | -------- |
| `shell-bridge.css` | L1b bridge | portal, marketing, admin |
| `operator-shell-structure.css` | L2 structure | admin only |
| `operator-admin-appearance.css` | L2 appearance + dark `.dark` palette | admin only |

**D2 (done):** `platform-neutral-portal.css` re-homed to `packages/workspaces/starter/theme/starter-portal.css`. `portal-bootstrap.css` is L0–L2 only; `importGuestPortalThemeForPlugin` always loads `WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN` first, then workspace-specific portal skins.

**D3 (done):** `starter/theme/starter-marketing.css` default marketing L3 skin via `WORKSPACE_GUEST_MARKETING_DEFAULT_SKIN`. Guest bootstraps (portal + marketing) share L0–L2 stack; `admin-bootstrap` is operator-only. `guard-css-bootstrap-integrity` blocks cross-surface and guest↔admin leakage.

**Phase D: closed.**


### Phase E — DTCG pipeline (design token implementation)

**E1 (done):** DTCG is build authority for `themes/light.css`. `generate-dtcg-theme.mjs` emits from `dtcg/platform.tokens.json`; `color.accent` maps to `--color-accent` (not `--color-warning`). `guard-dtcg-css-sync` runs `--check` drift detection.

**E2 (done):** `themes/dark.css` generated from `dtcg/platform.dark.tokens.json` (includes `shadow.*` + `color.accent`). Starter workspace `theme/tokens.css` generated from `dtcg/workspaces/starter.tokens.json` via `generate-workspace-dtcg-css.mjs` (`ws.color-accent` → `var(--color-primary)` under `[data-workspace-theme]`).

**E3 (done):** Workspace DTCG slices for `guest-club`, `urban`, `denali` → `theme/tokens.css`. `guard-dtcg-hex-ban` enforces `@generated` on all workspace `theme/tokens.css` and platform light/dark themes. `design-language/MASTER.md` demoted to design brief (DTCG is build authority).

**E4 (done):** DTCG generates `theme/marketing/semantic-tokens.css` and `theme/portal-semantic-tokens.css` for guest-club, urban, denali. `guard-dtcg-hex-ban` extended — `*-portal.css` and `marketing/tokens.css` are hook-only (no `#` hex). `design-system/denali-club/MASTER.md` confirmed as legacy redirect.

**E5 (done):** Denali `mkt.*` overlay tokens in `denali.marketing.tokens.json`. All `marketing/shell.css` + `marketing/components/*.css` hooks are `#` hex-free (`guard-dtcg-hex-ban` E5 scope). guest-club marketing hooks aligned.

**Phase F (F1–F6 done):** Admin/wizard skin DTCG + platform L0 stack + `operator-admin-appearance` decomposition. See [dtcg-pipeline-spec.mdoc](../dev/dtcg-pipeline-spec.mdoc).

**F1 (done):** Denali `denali.admin.tokens.json` with `blocks[]` (light + dark) → `theme/admin-semantic-tokens.css`. `admin-skin.css` demoted to hook-only (`@import` + layout); `guard-dtcg-hex-ban` F1 scope.

**F2 (done):** `finance-skin.css`, `wizard-skin.css`, `wizard-calendar.css` hex-free — reference `admin-semantic-tokens.css` vars.

**F3 (done):** `denali.wizard.tokens.json` → `wizard-semantic-tokens.css`; `wizard-fields.css` tone swatches hex-free.

**F4 (done):** `platform.primitives.tokens.json` → `primitives.css`; denali `animations.css` + wizard partials in hex-ban scope.

**F5 (done):** `platform.semantics.tokens.json` → `semantics.css`; `interactions.css` in hex-ban scope.

**F6 (done):** `operator-admin-dark-semantics.css` from `platform.dark.tokens.json`; `operator-admin-appearance.css` hook-only.

**F closure (done):** bootstrap CSS-G-02 fix (inline admin body reset); `operator-shell-structure.css` hex ban; denali `theme/` npm pack set; `dtcg-f-closure.spec.mjs`.

**F7 (done):** `guard-admin-feature-appearance-ast` — admin feature TSX (`patterns/`, `dashboard/`, `onboarding/`) bans palette scale + arbitrary hex in `className`; semantic shadcn tokens allowed.

**F8 (done):** CSS-hook purge — 17/17 feature TSX (`patterns/`, `dashboard/`, `onboarding/`) zero `className`; hooks in `admin-skin.css`.

**F9 (done):** ThemeProviderChain vs CSS precedence — audit (F9-1), `guard-denali-admin-dark-primary` + specs (F9-2), precedence table (F9-3), C4 tenant dark fix (F9-4).

**Phase F formal closure (done, 2026-07-06):** fast-track checklist PASS. Full monorepo gate attempted — not green; see spec § Full gate run.

Spec: [dtcg-pipeline-spec.mdoc](../dev/dtcg-pipeline-spec.mdoc).

### Phase F — Admin appearance program

**F1 (done):** Denali admin semantic DTCG (`denali.admin.tokens.json` → `admin-semantic-tokens.css`); `admin-skin.css` hook-only.

**F2 (done):** Finance + wizard shell hooks (`finance-skin`, `wizard-skin`, `wizard-calendar`) hex-free via admin semantic vars.

**F3 (done):** Wizard tone palette DTCG (`denali.wizard.tokens.json` → `wizard-semantic-tokens.css`); `wizard-fields.css` hook-only.

**F4 (done):** Platform primitives DTCG (`platform.primitives.tokens.json` → `primitives.css`).

**F5 (done):** Platform semantics DTCG (`platform.semantics.tokens.json` → `semantics.css`).

**F6 (done):** Admin dark semantics DTCG + `operator-admin-appearance.css` decomposition.

**F7 (done):** `guard-admin-feature-appearance-ast` — palette/hex ban on feature TSX.

**F8 (done):** incremental CSS-hook purge registry — 17/17 feature TSX.

**F9 (done):** ThemeProviderChain precedence audit + dark-primary guard + doc closure + C4 tenant dark fix (F9-4).

**Phase F formal closure (done, 2026-07-06):** fast-track checklist PASS. Full monorepo gate attempted same day — **not green** (`ci:integrity` blocked on `@apps/api` tsc; `phase-4:guard` RLS + kernel host literal). Phase F token scope is closed; unblock path in [dtcg-pipeline-spec.mdoc § Full gate run](../dev/dtcg-pipeline-spec.mdoc).

### Phase G — Codegen modularization (G0–G4 complete)

**Spec:** [workspace-registry-codegen-modularization.mdoc](../dev/workspace-registry-codegen-modularization.mdoc)

| Slice | Status |
| ----- | ------ |
| G0 doc pack | ✅ |
| G1 shared loader + validation modules | ✅ |
| G2 domain emitters (`domains/*.mjs`) | ✅ |
| G3 orchestrator + per-domain `--check` | ✅ |
| G4 member-portal fold (`domains/member-portal.mjs`) | ✅ |

- Monolith split into domain modules under `scripts/codegen/workspace-registry/`.
- Per-domain `--check --domain=<id>` + `guard:workspace-registry-domain-*` npm scripts.
- **Invariant preserved:** generated `*.generated.ts` byte-identical through Phase G closure.
- Legacy `scripts/member-portal-contract-codegen.mjs` is a re-export shim only.

### Phase H — Workspace certification (closed 2026-07-07)

**Spec:** [workspace-certification.mdoc](../dev/workspace-certification.mdoc)

| Slice | Status |
| ----- | ------ |
| H0 doc pack (stub vs certified, enforcement, proof matrix) | ✅ |
| H1 manifest + codegen + resolver | ✅ |
| H2 `provisionTenantProduction` fail-closed | ✅ |
| H3 `guard:workspace-certification` + proof matrix | ✅ |
| H4 Super Admin UX (optional) | ✅ |

- **Technical L0–L4** (guest conformance) exists — Phase H adds **productionTier: stub \| certified**.
- **certified** required for `provisionTenantProduction`; dev provisioning unchanged.
- Closes risk **R10** (stub workspaces in prod matrix) — `productionTier` + provision gates + Super Admin UX.

**Closure verification:**

```bash
pnpm run phase-i:closure
```

Full `ci:integrity` deferred until merge PR — Architect YES only.

### Phase I — Scale hardening (I0–I2 closed 2026-07-07)

**Spec:** [workspace-scale-hardening.mdoc](../dev/workspace-scale-hardening.mdoc)

| Slice | Status |
| ----- | ------ |
| I0 doc pack (theme budget + loader cache policy) | ✅ |
| I1 `guard:theme-import-budget` | ✅ |
| I2 registry load cache policy + dev invalidation | ✅ |
| I3 lazy sync plugin registry (optional) | ⏳ Architect YES |
| G+H+I merge to `main` | ✅ [#19](https://github.com/hrokhbakhsh1991/docs/pull/19) |
| I closure (`phase-i:closure`) | ✅ on `main` |
| GHA `phase-10-guard` on PR #19 | ✅ |

- **I1:** Bounded dynamic theme CSS imports per surface — admin ≤1, guest ≤2 (starter base + plugin overlay); `guard:theme-import-budget`.
- **I2:** `workspace-plugin-load-cache.ts` — promise cache keyed by `pluginId`, max entries = trunk count, revision bust on codegen regen; `invalidateWorkspacePluginLoadCache()` for dev/tests.
- **Local PR bundle:** `pnpm run phase-i:closure` · `pnpm run phase-g-h:handoff` · `pnpm run phase-g-h:create-pr`

**Not in scope:** API `tenant-registry-cache` (DEC-068/074 — already shipped).

---

## Critical assessment (external review lens)

### What is strong

- Manifest-driven registry is **real**, not aspirational—30+ generated outputs.
- Guest shell contract with AST guards is **ahead of most SaaS monorepos**.
- Dynamic theme loading per `pluginId` is the correct white-label pattern.
- Registration state bag centralization is **correct architecture**.
- Physical workspace package isolation matches Shopify-style extension model.

### What is weak

- **Token authority is fiction today** — **partially resolved E/F**; remaining admin feature TSX outside F8 purge.
- **Admin is not architected** — it is a feature-rich app with shadcn defaults (F7/F8 scoped subset only).
- **Workspace equality is marketing** — **mitigated Phase H** (`productionTier` + provision gate); stubs remain technically L3.
- **Codegen monolith** — **resolved Phase G (2026-07-07)** — domain modules + per-domain `--check`.
- **Member portal presets** — folded into `domains/member-portal.mjs`; `MEMBER_PORTAL_PRESETS` catalog remains until manifest-only admission.

### What is over-engineered

- 69 guards while admin appearance unguarded outside F8 registry — misprioritized enforcement (improving with phase-10 + I guards).
- `platform-neutral-portal.css` — **resolved D2** (re-homed to `starter/theme/starter-portal.css`).
- Duplicate dark palettes — **resolved F6** (`operator-admin-dark-semantics.css` under DTCG).

### What must be redesigned (not patched)

1. ~~Token pipeline (DTCG as input, not mirror).~~ **Done — Phase E/F (2026-07-06).**
2. Admin appearance model (skin + vars, not Tailwind soup) — **F7/F8 partial**; broader purge remains.
3. ~~Codegen orchestration (monolith → modules).~~ **Done — Phase G (2026-07-07).**
4. ~~Platform-default guest skin ownership~~ **Done — Phase D** (`starter/theme/starter-portal.css`, `starter-marketing.css`).

---

## Architecture confidence

Scores reflect **conformance to this v2 spec**, not code volume or test count.

| Subsystem | Score | Rationale |
|-----------|-------|-----------|
| Manifest / workspace discovery | **8** | Real manifests, discovery, scaffold; presets leak |
| Codegen / generated registry | **9** | Domain modules + orchestrator; 59 outputs; per-domain `--check` |
| Platform boundary (guest) | **8** | Dynamic loaders, no tenant theme on guest |
| Platform boundary (admin / API) | **5** | C closed — generated loaders only; admin TSX appearance debt |
| Registration contract | **7** | Shared reducer; triple surface wrappers remain |
| Member portal contract | **6** | v2 manifest works; presets + named guards |
| Catalog / guest marketing | **7** | Manifest-driven; Denali-heavy CSS |
| Shell structure (L2) | **7** | D1/D2 split; bootstrap integrity guard |
| Skin / appearance (guest) | **7** | DTCG guest semantics E4/E5; starter default skins D2/D3 |
| Skin / appearance (admin) | **5** | DTCG admin semantics F1–F6; F8 subset purged; rest Tailwind |
| Design tokens / DTCG readiness | **9** | L0 + admin dark under DTCG; hex-ban guards |
| Routing / tenant (WRS, PCMS) | **8** | Documented standards + guards |
| Scalability to 50+ workspaces | **6** | G modular codegen + I1/I2 guards on `DEV`; merge pending |
| Guard / control plane | **8** | Guest + certification + phase-10 11/11 |
| Documentation coherence | **7** | Standards + phase docs; §1/§8 synced 2026-07-07 |

### Overall architecture confidence: **7 / 10**

The **direction** is enterprise-grade. The **implementation** is a strong Phase-1 platform with one reference workspace carried on platform shoulders.

---

## Design token implementation gate

### Is this architecture stable enough to begin the Design Token implementation?

## **CLOSED — E5 marketing component hooks under DTCG semantics**

### Justification (updated 2026-07-06)

Phase E is **closed** for guest marketing skin semantics and hooks:

1. Platform + workspace + skin semantic layers — generated from DTCG.
2. Marketing/portal hooks + denali **shell + 28 component partials** — no raw `#` hex.
3. Denali overlay palette (`--mkt-*`) — DTCG authority in `denali.marketing.tokens.json`.

**Phase F closed (2026-07-06):** F1–F9 complete — admin DTCG semantics, hook hex ban, feature AST guards, 17/17 CSS-hook purge, ThemeProviderChain precedence + C4 tenant dark fix. Fast-track closure checklist PASS; full gate chain deferred until Architect **YES**.

---

*End of Platform Architecture v2 — Architecture Freeze Phase 1.*
