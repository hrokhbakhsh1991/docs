/** Monorepo guard (g5) excludes intentional negative-proof fixtures from the crawl graph. */
const monorepoGuardExclude =
  process.env.DEPCRUISE_MONOREPO_GUARD === "1"
    ? {
        path: "^(packages/workspace-sdk/test/__fixtures__/denali-breach\\.ts|packages/finance-core/test/fixtures/illegal-prisma-import\\.ts)$",
      }
    : undefined;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment:
        "Circular dependency chains are forbidden. Break the cycle or extract shared code to a neutral module (G-02 / RF-P0-IMP-06).",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "workspace-sdk-no-workspaces",
      comment: "Contract package must not depend on workspace implementations",
      severity: "error",
      from: {
        path: "^packages/workspace-sdk",
        pathNot: "^packages/workspace-sdk/test/.*\\.spec\\.ts$",
      },
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
      from: {
        path: "^packages/(workspace-sdk|config)",
        pathNot: "^packages/workspace-sdk/test/.*\\.spec\\.ts$",
      },
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
      comment:
        "Web shell: starter always; denali/urban only via workspace-plugin-loaders.generated.ts (Phase 10.2)",
      severity: "error",
      from: { path: "^apps/web" },
      to: { path: "^packages/workspaces/(?!starter|denali|urban|guest-club)" },
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
      comment:
        "Web shell Phase 3+ / 4+ / 19+ allowed packages (denali/urban lazy chunk; tenant-kernel + session-client + guest-surface-host for WRS/PCMS)",
      severity: "error",
      from: { path: "^apps/web" },
      to: {
        path: "^packages/(?!design-tokens|platform-core|theme-react|ui-primitives|workspace-sdk|draft-engine|wizard-navigation|tenant-kernel|session-client|guest-surface-host|workspaces/starter|workspaces/denali|workspaces/urban|workspaces/guest-club|config)",
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
      name: "apps-api-workspace-plugin-registry-only",
      comment:
        "Phase 10.2 — eager workspace plugin packages only via workspace-plugin-registry.generated.ts",
      severity: "error",
      from: {
        path: "^apps/api/src",
        pathNot:
          "(workspace-plugin-registry\\.generated|workspace-tour-write-bindings\\.generated|\\.spec\\.ts$|denali-finance|workspace-finance|urban|canonical|internal/provisioning|settings/|tours/|tenant/tenant-branding-storage)",
      },
      to: {
        path: "^packages/workspaces/(starter|denali|urban)(/plugin)?(/|$)",
      },
    },
    {
      name: "apps-api-allowed-packages",
      comment:
        "Phase 3.2+ / 6.5 / 7.3 / 10 API allowed workspace dependencies (starter + denali + urban + guest-club plugin registry)",
      severity: "error",
      from: { path: "^apps/api" },
      to: {
        path: "^packages/(?!workspace-sdk|platform-core|platform-events|tenant-kernel|finance-core|finance-http|finance-http-contracts|booking-http-contracts|workspaces/starter|workspaces/denali|workspaces/urban|workspaces/guest-club|workspaces/finance-ws2|workspaces/finance-ws3|workspaces/finance-ws4|workspaces/booking-ws2|config)",
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
    {
      name: "finance-core-no-apps",
      comment: "Phase 2.2.2 — finance-core must not depend on application layers",
      severity: "error",
      from: {
        path: "^packages/finance-core",
        pathNot: "^packages/finance-core/test/fixtures/",
      },
      to: { path: "^apps/" },
    },
    {
      name: "finance-core-no-workspaces",
      comment: "Phase 2.2.2 — finance-core must not depend on packages/workspaces/**",
      severity: "error",
      from: {
        path: "^packages/finance-core",
        pathNot: "^packages/finance-core/test/fixtures/",
      },
      to: { path: "^packages/workspaces" },
    },
    {
      name: "finance-core-no-workspace-packages",
      comment: "Phase 2.2.2 — finance-core must not depend on @app-tour/workspace-* packages",
      severity: "error",
      from: {
        path: "^packages/finance-core",
        pathNot: "^packages/finance-core/test/fixtures/",
      },
      to: {
        path: "(node_modules/@app-tour/workspace-|@app-tour/workspace-)",
      },
    },
    {
      name: "finance-core-no-generated",
      comment: "Phase 2.2.2 — finance-core must not depend on generated workspace bindings",
      severity: "error",
      from: {
        path: "^packages/finance-core",
        pathNot: "^packages/finance-core/test/fixtures/",
      },
      to: { path: "\\.generated(\\.|$)" },
    },
    {
      name: "finance-core-no-db-infra",
      comment:
        "Phase 2.2.2 — finance-core must not depend on apps/api database / outbox infrastructure",
      severity: "error",
      from: {
        path: "^packages/finance-core",
        pathNot: "^packages/finance-core/test/fixtures/",
      },
      to: {
        path: "(^apps/.*/(db|outbox)/|with-tenant-rls|enqueue-domain-event|prisma-workspace-outbox)",
      },
    },
    {
      name: "finance-core-no-prisma",
      comment: "Phase 2.2.2 — finance-core must not depend on Prisma packages",
      severity: "error",
      from: { path: "^packages/finance-core" },
      to: { path: "(node_modules/@prisma/|@prisma/)" },
    },
    {
      name: "finance-core-allowed-package-deps",
      comment:
        "Phase 2.2.2 — among monorepo packages, finance-core may only depend on itself and finance-http-contracts",
      severity: "error",
      from: {
        path: "^packages/finance-core",
        pathNot: "^packages/finance-core/test/fixtures/",
      },
      to: {
        path: "^packages/(?!finance-core|finance-http-contracts)(/|$)",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules|dist|legacy" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    ...(monorepoGuardExclude ? { exclude: monorepoGuardExclude } : {}),
  },
};
