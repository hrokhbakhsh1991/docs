/**
 * Gap Closure D.3 / C.3c — applyDeployProfile orchestrator unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDeployProfile } from "../apply-deploy-profile.mjs";

const FIXTURES = [
  {
    id: "starter",
    package: "@app-tour/workspace-starter",
    plugin: { entry: "./plugin", export: "createStarterPlugin" },
    themeStylesheets: ["theme/tokens.css"],
  },
  {
    id: "denali",
    package: "@app-tour/workspace-denali",
    plugin: { entry: "./plugin", export: "createDenaliPlugin" },
    memberPortal: {},
    themeStylesheets: ["theme/denali-admin.css"],
    adminWeb: { clientBundleEnvGate: "ALLOW_DENALI_WEB_PLUGIN" },
  },
  {
    id: "urban",
    package: "@app-tour/workspace-urban",
    plugin: { entry: "./plugin", export: "createUrbanPlugin" },
    memberPortal: {},
    themeStylesheets: ["theme/tokens.css"],
    adminWeb: { clientBundleEnvGate: "ALLOW_URBAN_WEB_PLUGIN" },
    guestThemeStylesheets: { portal: ["theme/u.css"], marketing: ["theme/u.css"] },
  },
];

describe("applyDeployProfile (Gap Closure D.3 / C.3c)", () => {
  it("dry-run does not write and does not require APPLY", () => {
    /** @type {string[]} */
    const writes = [];
    const result = applyDeployProfile({
      manifests: FIXTURES,
      env: { WORKSPACE_DEPLOY_PROFILE: "urban,starter" },
      write: false,
      writeFile: (path, contents) => {
        writes.push(path);
        void contents;
      },
      syncGuestRuntime: () => {
        throw new Error("should not sync on dry-run");
      },
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.applied, false);
    assert.equal(writes.length, 0);
    assert.match(result.allowExports, /ALLOW_DENALI_WEB_PLUGIN/);
    assert.match(result.registerOutputs.portalRegisterManifest, /"denali"/);
  });

  it("--write without APPLY fails closed", () => {
    assert.throws(
      () =>
        applyDeployProfile({
          manifests: FIXTURES,
          env: { WORKSPACE_DEPLOY_PROFILE: "urban,starter" },
          write: true,
        }),
      /WORKSPACE_DEPLOY_PROFILE_APPLY=1/
    );
  });

  it("--write with APPLY filters emit and records writes", () => {
    /** @type {string[]} */
    const writes = [];
    let synced = false;
    const result = applyDeployProfile({
      manifests: FIXTURES,
      env: {
        WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
        WORKSPACE_DEPLOY_PROFILE: "urban,starter",
      },
      write: true,
      outputs: {
        portal: "/tmp/portal.mjs",
        marketing: "/tmp/marketing.mjs",
        admin: "/tmp/admin.mjs",
      },
      themeOutputs: {
        adminTheme: "/tmp/admin-theme.ts",
        portalTheme: "/tmp/portal-theme.ts",
        marketingTheme: "/tmp/marketing-theme.ts",
      },
      registerPaths: {
        portalRegisterManifest: "/tmp/portal-register-manifest.ts",
        hostRegisterManifest: "/tmp/host-register-manifest.ts",
        portalRegister_starter: "/tmp/register-starter.ts",
        portalRegister_urban: "/tmp/register-urban.ts",
        portalRegister_denali: "/tmp/register-denali.ts",
      },
      writeFile: (path, contents) => {
        writes.push(path);
        void contents;
      },
      syncGuestRuntime: () => {
        synced = true;
        return {
          written: true,
          products: ["@app-tour/workspace-starter", "@app-tour/workspace-urban"],
          profile: "urban,starter",
        };
      },
    });
    assert.equal(result.mode, "write");
    assert.equal(result.applied, true);
    assert.deepEqual(writes, [
      "/tmp/portal.mjs",
      "/tmp/marketing.mjs",
      "/tmp/admin.mjs",
      "/tmp/admin-theme.ts",
      "/tmp/portal-theme.ts",
      "/tmp/marketing-theme.ts",
      "/tmp/register-starter.ts",
      "/tmp/register-urban.ts",
      "/tmp/portal-register-manifest.ts",
      "/tmp/host-register-manifest.ts",
    ]);
    assert.equal(synced, true);
    assert.ok(!result.adminTranspileProducts.includes("@app-tour/workspace-denali"));
    assert.ok(result.adminTranspileProducts.includes("@app-tour/workspace-urban"));
    assert.doesNotMatch(result.adminSrc, /workspace-denali/);
    assert.doesNotMatch(result.adminThemeSrc, /workspace-denali/);
    assert.match(result.adminThemeSrc, /workspace-urban/);
    assert.match(result.allowExports, /ALLOW_URBAN_WEB_PLUGIN/);
    assert.doesNotMatch(result.allowExports, /ALLOW_DENALI_WEB_PLUGIN/);
    assert.match(result.registerOutputs.portalRegisterManifest, /"starter"/);
    assert.match(result.registerOutputs.portalRegisterManifest, /"urban"/);
    assert.doesNotMatch(result.registerOutputs.portalRegisterManifest, /"denali"/);
    assert.equal(result.registerOutputs.portalRegister_denali, undefined);
  });
});
