# @app-tour/workspace-denali

> **Maintenance mode (P3-D)** — product workspace plugin; metadata cutover complete on trunk.

**Phase 6.2–6.3 — registry, rules, composites + theme** (product workspace; not a guard probe).

Denali is the first full `WorkspacePlugin` product workspace on trunk. P0 domain files from `legacy/packages/denali-domain/` are ported under `src/` with `types/legacy/` shims (no runtime `legacy/` imports).

## Layout

| Path                               | Role                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| `src/field-registry/`              | Field registry + matrix recipes (P0 port)                     |
| `src/rules/`                       | `evaluateFormRules` + generated rule set                      |
| `src/composites/`                  | `denali.*` widget registry + platform renderer id map         |
| `src/denali-plugin-adapter.ts`     | Maps registry → `WorkspaceFieldRegistry` / `WorkspaceRuleSet` |
| `src/denali.plugin.ts`             | `getDenaliWorkspacePlugin()`                                  |
| `src/acl/`                         | `normalizeLegacyTripDetails`, `toCanonicalDocument`           |
| `scripts/denali-codegen.mjs`       | Regenerates `src/rules/generated/`                            |
| `test/registry-parity.spec.ts`     | Legacy parity + `validateCanonical` gate                      |
| `test/composites.contract.spec.ts` | Widget registry + theme ingress (6.3)                         |
| `test/fixtures/golden/`            | 3 golden wizard JSON fixtures                                 |
| `theme/tokens.css`                 | `--ws-*` workspace brand tokens                               |

## Metadata export (P3-D)

Workspace metadata definitions are exported from the live Denali plugin for seed parity:

```bash
pnpm --filter @apps/api run export:workspace-definition -- --workspace denali --out scripts/seed/definitions/denali-v1.json
```

Regenerate `denali-v1.json` after field-registry or composite changes; DP/RP parity specs compare the export to the package strip.

## Commands

```bash
pnpm --filter @app-tour/workspace-denali build
pnpm --filter @app-tour/workspace-denali run denali:codegen
git diff --exit-code packages/workspaces/denali/src/rules/generated
pnpm --filter @app-tour/workspace-denali test test/registry-parity.spec.ts
pnpm --filter @app-tour/workspace-denali test test/composites.contract.spec.ts
```

## Policy

| Rule                                                                | Detail                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Product code lives here only                                        | No Denali-specific logic in `platform-core` / generic `apps/api` |
| No runtime `legacy/` imports in `src/` (except `src/acl/` boundary) | Port is manual copy + shims                                      |
| API resolver binding                                                | Subphase **6.5** wires `resolveWorkspacePluginForType('denali')` |
