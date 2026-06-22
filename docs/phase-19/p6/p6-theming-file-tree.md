# P6 — Theming file tree (mandatory)

```yaml
epic: P6-1
nano: P6-1-N-015
authority: ../p6-enterprise-theming-architecture.mdoc
gate_spec: apps/portal/test/p6-theming-file-tree.spec.ts
```

## Rule

Every guest/admin UI change in P6 must match this tree. **No page CSS in `apps/*/globals.css`.** Workspace skins own surface rules.

---

## Canonical tree

```text
packages/design-tokens/src/
  index.css              ← primitives + semantics + light/dark platform
  shell-bridge.css       ← @theme inline + shadcn ↔ --color-* bridge (NO tailwind)
  guest-shell.css        ← index + shell-bridge + body reset (guest apps)

packages/workspaces/<workspace>/theme/
  denali-admin.css       ← operator bundle (admin only)
  denali-portal.css      ← guest portal skin
  denali-marketing.css   ← public catalog skin
  tokens.css             ← --ws-color-accent contract (starter/urban)

packages/workspaces/<workspace>/workspace.manifest.json
  themeStylesheets[]           → apps/web bootstrap
  guestThemeStylesheets.portal → apps/portal bootstrap
  guestThemeStylesheets.marketing → apps/marketing bootstrap

apps/web/
  app/globals.css                    ← styles.css + shell-bridge + tailwind + admin-only dark extras
  app/layout.tsx                     ← workspace-theme-stylesheets.generated + data-workspace-plugin
  src/bootstrap/workspace-theme-stylesheets.generated.ts

apps/portal/
  app/globals.css                    ← guest-shell + tailwind ONLY (2 lines)
  app/layout.tsx                     ← guest-theme-stylesheets + fonts + data-* attrs
  src/bootstrap/workspace-guest-theme-stylesheets.generated.ts
  src/features/<domain>/*-logic.ts   ← pure logic (no inline constants in TSX)
  src/i18n/app-fonts.ts              ← Vazirmatn / Inter (parity with admin)

apps/marketing/
  app/globals.css                    ← guest-shell + tailwind ONLY
  app/layout.tsx                     ← guest-theme-stylesheets + fonts + data-* attrs
  src/bootstrap/workspace-guest-theme-stylesheets.generated.ts
  src/i18n/app-fonts.ts
```

---

## Body attributes (all club surfaces)

| Attribute | Example | Source |
| --------- | ------- | ------ |
| `data-workspace-plugin` | `denali` | `resolve*BootstrapForHost` |
| `data-app-surface` | `portal` \| `marketing` | layout (guest) |
| `data-tenant-id` | UUID | bootstrap |

Admin uses `data-workspace-plugin` only (no `data-app-surface`).

---

## CSS scope selectors

| Skin | Selector |
| ---- | -------- |
| Denali admin | `body[data-workspace-plugin="denali"]` |
| Denali portal | `body[data-app-surface="portal"][data-workspace-plugin="denali"]` |
| Denali marketing | `body[data-app-surface="marketing"][data-workspace-plugin="denali"]` |

Urban/starter: add `urban-portal.css` / `urban-marketing.css` when P6+ needs guest chrome — same manifest keys.

---

## Generator

```bash
pnpm run generate:workspace-registry
```

Produces:

- `apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts`
- `apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts`
- `apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts`

**Never** hand-edit generated files except when generator is blocked — then fix manifest and re-run.

---

## Verify (P6-1-N-015)

```bash
pnpm run generate:workspace-registry -- --check   # when manifest complete
pnpm --filter @app-tour/design-tokens run build
pnpm --filter @apps/portal run test -- test/p6-theming-file-tree.spec.ts
pnpm --filter @apps/portal run test -- test/guest-theme-stack.spec.ts
pnpm --filter @apps/marketing run test -- test/guest-theme-stack.spec.ts
pnpm --filter @apps/web test -- test/denali-admin-theme.spec.ts
```

---

## Anti-patterns (fail review)

| ❌ | ✅ |
| -- | -- |
| `#f8fafc` in app CSS | `var(--background)` |
| Page rules in `globals.css` | Workspace `theme/*.css` |
| `import from "@app-tour/ui-primitives"` barrel | Subpath `/input`, `/button` |
| OTP constants in 500-line TSX | `features/auth/*-logic.ts` |
| Hard-coded `denali-admin.css` in portal layout | Generated guest bootstrap |
