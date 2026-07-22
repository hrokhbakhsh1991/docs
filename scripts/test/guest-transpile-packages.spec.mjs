/**
 * Wave C.b — guest transpilePackages codegen unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectGuestProductTranspilePackages,
  filterManifestsByDeployProfile,
  filterProductPackagesByDeployProfile,
  generateAdminThemeStylesheetLoader,
  generateGuestTranspilePackages,
  MARKETING_PLATFORM_TRANSPILE_PACKAGES,
  PORTAL_PLATFORM_TRANSPILE_PACKAGES,
} from "../codegen/workspace-registry/domains/theme.mjs";

const FIXTURES = [
  {
    id: "starter",
    package: "@app-tour/workspace-starter",
  },
  {
    id: "denali",
    package: "@app-tour/workspace-denali",
    guestThemeStylesheets: { portal: ["theme/a.css"], marketing: ["theme/b.css"] },
    marketingCatalog: { module: "host/m", export: "x" },
  },
  {
    id: "urban",
    package: "@app-tour/workspace-urban",
    guestThemeStylesheets: { portal: ["theme/u.css"], marketing: ["theme/u.css"] },
  },
  {
    id: "finance-ws2",
    package: "@app-tour/workspace-finance-ws2",
    workspaceFinance: { registryOnly: true },
  },
];

describe("guest transpilePackages codegen (Wave C.b)", () => {
  it("includes starter + themed products; skips registryOnly", () => {
    const portal = collectGuestProductTranspilePackages(FIXTURES, "portal");
    assert.ok(portal.includes("@app-tour/workspace-starter"));
    assert.ok(portal.includes("@app-tour/workspace-denali"));
    assert.ok(portal.includes("@app-tour/workspace-urban"));
    assert.ok(!portal.includes("@app-tour/workspace-finance-ws2"));
  });

  it("marketing includes marketingCatalog packages", () => {
    const marketing = collectGuestProductTranspilePackages(FIXTURES, "marketing");
    assert.ok(marketing.includes("@app-tour/workspace-denali"));
  });

  it("generated module lists platform then products", () => {
    const src = generateGuestTranspilePackages(FIXTURES, "portal", {});
    assert.match(src, /export const GUEST_TRANSPILE_PACKAGES/);
    for (const pkg of PORTAL_PLATFORM_TRANSPILE_PACKAGES) {
      assert.match(src, new RegExp(pkg.replace("/", "\\/")));
    }
    assert.match(src, /@app-tour\/workspace-denali/);
  });

  it("marketing platform set excludes portal-only catalog packages", () => {
    assert.ok(!MARKETING_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/catalog-intake-ui"));
    assert.ok(PORTAL_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/catalog-intake-ui"));
  });
});

describe("guest-runtime product deps (Wave C.c)", () => {
  it("buildGuestRuntimeDependencies keeps platform deps and syncs products", async () => {
    const { buildGuestRuntimeDependencies, collectGuestRuntimeProductPackages } = await import(
      "../codegen/workspace-registry/domains/theme.mjs"
    );
    const products = collectGuestRuntimeProductPackages(FIXTURES);
    const next = buildGuestRuntimeDependencies(
      {
        "@app-tour/catalog-registration-flow-ui": "workspace:*",
        "@app-tour/workspace-sdk": "workspace:*",
        "@app-tour/workspace-plugin-host": "workspace:*",
        "@app-tour/workspace-denali": "workspace:*",
        "@app-tour/workspace-obsolete": "workspace:*",
      },
      products
    );
    assert.equal(next["@app-tour/catalog-registration-flow-ui"], "workspace:*");
    assert.equal(next["@app-tour/workspace-sdk"], "workspace:*");
    assert.equal(next["@app-tour/workspace-plugin-host"], "workspace:*");
    assert.ok(next["@app-tour/workspace-denali"]);
    assert.ok(next["@app-tour/workspace-starter"]);
    assert.equal(next["@app-tour/workspace-obsolete"], undefined);
  });
});

describe("guest-runtime deploy profile (Gap Closure C.2c)", () => {
  it("ForEnv ignores profile without APPLY", async () => {
    const { collectGuestRuntimeProductPackages, collectGuestRuntimeProductPackagesForEnv } =
      await import("../codegen/workspace-registry/domains/theme.mjs");
    const full = collectGuestRuntimeProductPackages(FIXTURES);
    const filtered = collectGuestRuntimeProductPackagesForEnv(FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.deepEqual(filtered, full);
  });

  it("ForEnv filters when APPLY=1", async () => {
    const { collectGuestRuntimeProductPackagesForEnv } = await import(
      "../codegen/workspace-registry/domains/theme.mjs"
    );
    const filtered = collectGuestRuntimeProductPackagesForEnv(FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.deepEqual(filtered, [
      "@app-tour/workspace-starter",
      "@app-tour/workspace-urban",
    ]);
  });

  it("ForDeploy throws without APPLY gate", async () => {
    const { syncGuestWorkspaceRuntimePackageJsonForDeploy } = await import(
      "../codegen/workspace-registry/domains/theme.mjs"
    );
    assert.throws(
      () =>
        syncGuestWorkspaceRuntimePackageJsonForDeploy(FIXTURES, {
          WORKSPACE_DEPLOY_PROFILE: "urban",
        }),
      /WORKSPACE_DEPLOY_PROFILE_APPLY=1/
    );
  });
});

describe("filterProductPackagesByDeployProfile (Gap Closure C.2a)", () => {
  const ALL = [
    "@app-tour/workspace-denali",
    "@app-tour/workspace-starter",
    "@app-tour/workspace-urban",
  ];

  it("full / empty / star leave the list unchanged", () => {
    assert.deepEqual(filterProductPackagesByDeployProfile(ALL, "full"), ALL);
    assert.deepEqual(filterProductPackagesByDeployProfile(ALL, "*"), ALL);
    assert.deepEqual(filterProductPackagesByDeployProfile(ALL, ""), ALL);
    assert.deepEqual(filterProductPackagesByDeployProfile(ALL, null), ALL);
  });

  it("filters by workspace id or package name", () => {
    assert.deepEqual(filterProductPackagesByDeployProfile(ALL, "urban,starter"), [
      "@app-tour/workspace-starter",
      "@app-tour/workspace-urban",
    ]);
    assert.deepEqual(
      filterProductPackagesByDeployProfile(ALL, "@app-tour/workspace-denali"),
      ["@app-tour/workspace-denali"]
    );
  });
});

describe("deploy profile transpile emit (Gap Closure C.2b)", () => {
  it("profile env alone does not filter (APPLY gate)", () => {
    const src = generateGuestTranspilePackages(FIXTURES, "portal", {
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.match(src, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(src, /Deploy profile apply=1/);
  });

  it("APPLY=1 + profile filters guest emit and annotates banner", () => {
    const src = generateGuestTranspilePackages(FIXTURES, "portal", {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.match(src, /Deploy profile apply=1/);
    assert.match(src, /@app-tour\/workspace-urban/);
    assert.match(src, /@app-tour\/workspace-starter/);
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
  });
});

describe("filterManifestsByDeployProfile / theme loaders (Gap Closure C.3)", () => {
  const THEME_FIXTURES = [
    {
      id: "starter",
      package: "@app-tour/workspace-starter",
      themeStylesheets: ["theme/tokens.css"],
    },
    {
      id: "denali",
      package: "@app-tour/workspace-denali",
      themeStylesheets: ["theme/denali-admin.css"],
    },
    {
      id: "urban",
      package: "@app-tour/workspace-urban",
      themeStylesheets: ["theme/tokens.css"],
    },
  ];

  it("without APPLY returns all manifests", () => {
    const scoped = filterManifestsByDeployProfile(THEME_FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.equal(scoped.length, 3);
  });

  it("APPLY=1 filters manifests and admin theme loader", () => {
    const env = {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    };
    const scoped = filterManifestsByDeployProfile(THEME_FIXTURES, env);
    assert.deepEqual(
      scoped.map((m) => m.id),
      ["starter", "urban"]
    );
    const src = generateAdminThemeStylesheetLoader(THEME_FIXTURES, env);
    assert.match(src, /workspace-urban/);
    assert.match(src, /workspace-starter/);
    assert.doesNotMatch(src, /workspace-denali/);
  });
});

describe("generatePortalRegisterOutputs deploy profile (Gap Closure C.3c)", () => {
  const REGISTER_FIXTURES = [
    {
      id: "starter",
      package: "@app-tour/workspace-starter",
      plugin: { entry: "./plugin", export: "createStarterPlugin" },
    },
    {
      id: "denali",
      package: "@app-tour/workspace-denali",
      plugin: { entry: "./plugin", export: "createDenaliPlugin" },
      memberPortal: {},
    },
    {
      id: "urban",
      package: "@app-tour/workspace-urban",
      plugin: { entry: "./plugin", export: "createUrbanPlugin" },
      memberPortal: {},
    },
  ];

  it("APPLY=1 drops out-of-profile register membership", async () => {
    const { generatePortalRegisterOutputs } = await import(
      "../codegen/workspace-registry/domains/registration.mjs"
    );
    const out = generatePortalRegisterOutputs(REGISTER_FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.match(out.portalRegisterManifest, /"starter"/);
    assert.match(out.portalRegisterManifest, /"urban"/);
    assert.doesNotMatch(out.portalRegisterManifest, /"denali"/);
    assert.doesNotMatch(out.hostRegisterManifest, /"denali"/);
    assert.ok(out.portalRegister_urban);
    assert.equal(out.portalRegister_denali, undefined);
  });
});
