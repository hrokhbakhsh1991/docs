/**
 * Wave G.a — admin transpilePackages codegen unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_PLATFORM_TRANSPILE_PACKAGES,
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
  collectAdminProductTranspilePackages,
  formatDeployProfileAllowEnvExports,
  generateAdminTranspilePackages,
} from "../codegen/workspace-registry/domains/theme.mjs";

const FIXTURES = [
  {
    id: "starter",
    package: "@app-tour/workspace-starter",
    themeStylesheets: ["theme/tokens.css"],
  },
  {
    id: "denali",
    package: "@app-tour/workspace-denali",
    themeStylesheets: ["theme/denali-admin.css"],
    adminWeb: { clientBundleEnvGate: "ALLOW_DENALI_WEB_PLUGIN" },
  },
  {
    id: "urban",
    package: "@app-tour/workspace-urban",
    themeStylesheets: ["theme/tokens.css"],
    adminWeb: { clientBundleEnvGate: "ALLOW_URBAN_WEB_PLUGIN" },
  },
  {
    id: "guest-club",
    package: "@app-tour/workspace-guest-club",
    themeStylesheets: ["theme/tokens.css"],
  },
  {
    id: "finance-ws2",
    package: "@app-tour/workspace-finance-ws2",
    workspaceFinance: { registryOnly: true },
    themeStylesheets: ["theme/x.css"],
  },
];

describe("admin transpilePackages codegen (Wave G.a)", () => {
  it("includes starter + themeStylesheets products; skips registryOnly", () => {
    const products = collectAdminProductTranspilePackages(FIXTURES);
    assert.ok(products.includes("@app-tour/workspace-starter"));
    assert.ok(products.includes("@app-tour/workspace-denali"));
    assert.ok(products.includes("@app-tour/workspace-urban"));
    assert.ok(products.includes("@app-tour/workspace-guest-club"));
    assert.ok(!products.includes("@app-tour/workspace-finance-ws2"));
  });

  it("generated module lists platform then products", () => {
    const src = generateAdminTranspilePackages(FIXTURES, {});
    assert.match(src, /export const ADMIN_TRANSPILE_PACKAGES/);
    assert.match(src, /Wave G\.a/);
    for (const pkg of ADMIN_PLATFORM_TRANSPILE_PACKAGES) {
      assert.match(src, new RegExp(pkg.replace("/", "\\/")));
    }
    assert.match(src, /@app-tour\/workspace-denali/);
    assert.match(src, /@app-tour\/workspace-guest-club/);
  });

  it("C.2b APPLY=1 filters admin product transpile emit", () => {
    const src = generateAdminTranspilePackages(FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    assert.match(src, /Deploy profile apply=1/);
    assert.match(src, /@app-tour\/workspace-urban/);
    assert.match(src, /@app-tour\/workspace-starter/);
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(src, /@app-tour\/workspace-guest-club/);
  });

  it("platform set uses @app-tour kernel packages (Wave H.k)", () => {
    assert.ok(ADMIN_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/draft-engine"));
    assert.ok(ADMIN_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/platform-core"));
    assert.ok(ADMIN_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/workspace-sdk"));
    assert.ok(
      ADMIN_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/finance-case-encounter-ui")
    );
    assert.ok(!ADMIN_PLATFORM_TRANSPILE_PACKAGES.includes("@app-tour/workspace-denali"));
    assert.equal(
      ADMIN_PLATFORM_TRANSPILE_PACKAGES.every((pkg) => pkg.startsWith("@app-tour/")),
      true
    );
  });
});

describe("deploy-profile bundle plan (Gap Closure D.1)", () => {
  it("full-trunk plan is coherent and recommends ALLOW for gated products in set", () => {
    const plan = buildDeployProfileBundlePlan(FIXTURES, {});
    const check = assertDeployProfileBundlePlanCoherent(plan);
    assert.equal(check.ok, true);
    assert.equal(plan.applied, false);
    assert.equal(plan.recommendedProcessEnv.ALLOW_DENALI_WEB_PLUGIN, "true");
    assert.equal(plan.recommendedProcessEnv.ALLOW_URBAN_WEB_PLUGIN, "true");
  });

  it("profiled plan keeps urban allow and drops denali", () => {
    const plan = buildDeployProfileBundlePlan(FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    const check = assertDeployProfileBundlePlanCoherent(plan);
    assert.equal(check.ok, true);
    assert.equal(plan.applied, true);
    const denali = plan.clientIgnore.find((row) => row.id === "denali");
    const urban = plan.clientIgnore.find((row) => row.id === "urban");
    assert.equal(denali?.inProfile, false);
    assert.equal(urban?.inProfile, true);
    assert.equal(plan.recommendedProcessEnv.ALLOW_DENALI_WEB_PLUGIN, undefined);
    assert.equal(plan.recommendedProcessEnv.ALLOW_URBAN_WEB_PLUGIN, "true");
    assert.ok(!plan.adminTranspileProducts.includes("@app-tour/workspace-denali"));
    assert.ok(plan.adminTranspileProducts.includes("@app-tour/workspace-urban"));
  });

  it("D.2 formats shell ALLOW exports from the plan", () => {
    const plan = buildDeployProfileBundlePlan(FIXTURES, {
      WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
      WORKSPACE_DEPLOY_PROFILE: "urban,starter",
    });
    const text = formatDeployProfileAllowEnvExports(plan);
    assert.match(text, /^export ALLOW_URBAN_WEB_PLUGIN="true"$/m);
    assert.doesNotMatch(text, /ALLOW_DENALI_WEB_PLUGIN/);
  });
});
