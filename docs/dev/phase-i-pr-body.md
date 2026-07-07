## Summary

Phase I hardens workspace platform **runtime scale** on `DEV`:

- **I1 — Theme import budget:** `guard:theme-import-budget` enforces bounded dynamic CSS imports (admin ≤1, guest ≤2 per path) across admin, portal, and marketing layouts.
- **I2 — Plugin load cache:** `workspace-plugin-load-cache.ts` + codegen-wired `loadWorkspacePluginByIdFromRegistry` with revision bust, max-entry cap, and `invalidateWorkspacePluginLoadCache()` for dev/tests.
- **Docs:** [`docs/dev/workspace-scale-hardening.mdoc`](docs/dev/workspace-scale-hardening.mdoc) · architecture v2 § Phase I.

**Prerequisite:** Phase G+H on same `DEV` branch — prefer `pnpm run phase-g-h:create-pr` for a single G+H+I PR; use this script only for I-only follow-up PRs.

## Enforcement stack

| Layer | Mechanism |
| ----- | --------- |
| Theme ingress | `guard:theme-import-budget` → delegates portal/marketing guest loaders + admin budget |
| Plugin loader | `guard:workspace-plugin-load-cache` → generated loaders use cache module, revision constants |
| Host invariants | `phase-10:guard` → `p10_theme_import_budget` + `p10_workspace_plugin_load_cache` (11 checks) |

## Verification

```bash
pnpm run phase-i:closure
# or separately:
pnpm run phase-g-h:fast-track
pnpm run phase-i:fast-track
```

## Out of scope (deferred)

- **I3** lazy sync plugin registry codegen — Architect YES
- **`ci:integrity`** full gate — Architect YES only

## Test plan

- [ ] `pnpm run phase-i:closure` green on CI
- [ ] Admin layout loads one theme CSS chain per `pluginId`
- [ ] `loadWorkspacePluginById("denali")` still lazy-loads after cache policy
- [ ] `invalidateWorkspacePluginLoadCache()` clears cache in dev/tests
- [ ] No regression in `phase-g-h:fast-track` certification gates
