/** Monorepo guard (g5) excludes H-01 negative-proof fixture from the crawl graph. */
const monorepoGuardExclude =
  process.env.DEPCRUISE_MONOREPO_GUARD === "1"
    ? {
        path: "^packages/workspace-sdk/test/__fixtures__/denali-breach\\.ts$",
      }
    : undefined;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "workspace-sdk-no-workspaces",
      comment: "Contract package must not depend on workspace implementations",
      severity: "error",
      from: { path: "^packages/workspace-sdk" },
      to: { path: "^packages/workspaces" },
    },
    {
      name: "no-legacy-imports",
      comment: "New packages must not import the archived monorepo",
      severity: "error",
      from: { path: "^packages" },
      to: { path: "^legacy" },
    },
    {
      name: "no-denali-product-ids",
      comment:
        "Foundation packages must not import Denali product workspaces or domain (H-01 grep-free)",
      severity: "error",
      from: { path: "^packages/(workspace-sdk|config)" },
      to: {
        path: "(^packages/workspaces/denali(/|$)|^packages/[^/]*denali-domain|^legacy/packages/[^/]*denali|^packages/types/.*/denali/)",
      },
    },
    {
      name: "platform-core-no-workspaces",
      comment: "Platform engine must not depend on workspace implementations",
      severity: "error",
      from: { path: "^packages/platform-core" },
      to: { path: "^packages/workspaces" },
    },
    {
      name: "platform-core-only-sdk",
      comment: "Platform core may only depend on workspace-sdk and config",
      severity: "error",
      from: { path: "^packages/platform-core" },
      to: { path: "^packages/(?!workspace-sdk|config|platform-core)" },
    },
    {
      name: "platform-core-no-apps",
      comment: "Platform core must not depend on application layers",
      severity: "error",
      from: { path: "^packages/platform-core" },
      to: { path: "^apps/" },
    },
    {
      name: "platform-core-no-workspace-starter-plugin",
      comment:
        "Phase 1 — production platform-core src must not import SDK starter reference or workspaces/starter",
      severity: "error",
      from: {
        path: "^packages/platform-core/src",
        pathNot: "\\.spec\\.ts$",
      },
      to: {
        path: "(^packages/workspaces/starter(/|$)|starter-workspace\\.plugin|reference/starter-workspace)",
      },
    },
    {
      name: "workspace-sdk-no-apps",
      comment: "SDK contract must not depend on application layers",
      severity: "error",
      from: { path: "^packages/workspace-sdk" },
      to: { path: "^apps/" },
    },
    {
      name: "design-tokens-isolated",
      comment: "Design tokens must not depend on other packages",
      severity: "error",
      from: { path: "^packages/design-tokens" },
      to: { path: "^packages/(?!design-tokens)" },
    },
    {
      name: "design-tokens-no-workspaces",
      comment: "Design tokens must not depend on workspace implementations",
      severity: "error",
      from: { path: "^packages/design-tokens" },
      to: { path: "^packages/workspaces" },
    },
    {
      name: "design-tokens-no-apps",
      comment: "Design tokens must not depend on application layers",
      severity: "error",
      from: { path: "^packages/design-tokens" },
      to: { path: "^apps/" },
    },
    {
      name: "ui-primitives-only-design-tokens",
      comment: "UI primitives may only depend on design-tokens among workspace packages",
      severity: "error",
      from: { path: "^packages/ui-primitives" },
      to: { path: "^packages/(?!ui-primitives|design-tokens|workspace-sdk|theme-react|config)" },
    },
    {
      name: "ui-primitives-no-workspaces",
      comment: "UI primitives must not depend on workspace implementations",
      severity: "error",
      from: { path: "^packages/ui-primitives" },
      to: { path: "^packages/workspaces" },
    },
    {
      name: "theme-react-allowed-deps",
      comment: "Theme react may depend on design-tokens and workspace-sdk only",
      severity: "error",
      from: { path: "^packages/theme-react" },
      to: { path: "^packages/(?!theme-react|design-tokens|workspace-sdk|config)" },
    },
    {
      name: "theme-react-no-workspaces",
      comment: "Theme react must not depend on workspace implementations",
      severity: "error",
      from: { path: "^packages/theme-react" },
      to: { path: "^packages/workspaces" },
    },
    {
      name: "apps-web-no-workspaces-except-starter",
      comment: "Web shell may import starter only — other workspace plugins are dynamic (Phase 3.3+)",
      severity: "error",
      from: { path: "^apps/web" },
      to: { path: "^packages/workspaces/(?!starter)" },
    },
    {
      name: "workspace-starter-no-apps",
      comment: "P3-E-WS-01 — starter plugin must not depend on apps",
      severity: "error",
      from: { path: "^packages/workspaces/starter" },
      to: { path: "^apps/" },
    },
    {
      name: "workspace-starter-allowed-deps",
      comment: "P3-E-WS-01 — starter may depend on sdk, platform-core, design-tokens only",
      severity: "error",
      from: { path: "^packages/workspaces/starter" },
      to: {
        path: "^packages/(?!workspaces/starter|workspace-sdk|platform-core|design-tokens|config)",
      },
    },
    {
      name: "apps-web-no-legacy",
      comment: "Web shell must not import archived monorepo",
      severity: "error",
      from: { path: "^apps/web" },
      to: { path: "^legacy" },
    },
    {
      name: "apps-web-allowed-packages",
      comment: "Web shell Phase 3 allowed workspace dependencies",
      severity: "error",
      from: { path: "^apps/web" },
      to: {
        path: "^packages/(?!design-tokens|platform-core|theme-react|ui-primitives|workspace-sdk|workspaces/starter|config)",
      },
    },
    {
      name: "apps-api-no-ui-primitives",
      comment: "P3-E-API-01 — API must not depend on UI packages",
      severity: "error",
      from: { path: "^apps/api" },
      to: { path: "^packages/(ui-primitives|theme-react|design-tokens)" },
    },
    {
      name: "apps-api-no-legacy",
      comment: "Phase 3 API must not import archived monorepo",
      severity: "error",
      from: { path: "^apps/api" },
      to: { path: "^legacy" },
    },
    {
      name: "apps-api-allowed-packages",
      comment: "Phase 3.2+ API allowed workspace dependencies (incl. phase-4 tenant-kernel / platform-events)",
      severity: "error",
      from: { path: "^apps/api" },
      to: {
        path: "^packages/(?!workspace-sdk|platform-core|platform-events|tenant-kernel|workspaces/starter|config)",
      },
    },
    {
      name: "apps-no-platform-core-src-deep-import",
      comment:
        "Phase 1 facade integrity — apps must import @app-tour/platform-core entry, not packages/platform-core/src",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^packages/platform-core/src" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules|dist|legacy" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    ...(monorepoGuardExclude ? { exclude: monorepoGuardExclude } : {}),
  },
};
