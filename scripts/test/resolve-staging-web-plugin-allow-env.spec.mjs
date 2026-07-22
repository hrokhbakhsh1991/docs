/**
 * Gap Closure D.4 — staging web IgnorePlugin ALLOW env resolver.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveStagingWebPluginAllowEnv,
  STAGING_WEB_LEGACY_ALLOW_EXPORTS,
} from "../vps-deploy/resolve-staging-web-plugin-allow-env.mjs";

const FIXTURES = [
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
    id: "starter",
    package: "@app-tour/workspace-starter",
    themeStylesheets: ["theme/tokens.css"],
  },
];

describe("resolveStagingWebPluginAllowEnv (Gap Closure D.4)", () => {
  it("defaults to legacy Denali-only ALLOW without APPLY", () => {
    const result = resolveStagingWebPluginAllowEnv({}, FIXTURES);
    assert.equal(result.mode, "legacy");
    assert.equal(result.shell, STAGING_WEB_LEGACY_ALLOW_EXPORTS);
    assert.match(result.shell, /ALLOW_DENALI_WEB_PLUGIN/);
    assert.doesNotMatch(result.shell, /ALLOW_URBAN_WEB_PLUGIN/);
  });

  it("uses deploy-profile recommendations when APPLY=1", () => {
    const result = resolveStagingWebPluginAllowEnv(
      {
        WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
        WORKSPACE_DEPLOY_PROFILE: "urban,starter",
      },
      FIXTURES
    );
    assert.equal(result.mode, "deploy-profile");
    assert.match(result.shell, /ALLOW_URBAN_WEB_PLUGIN/);
    assert.doesNotMatch(result.shell, /ALLOW_DENALI_WEB_PLUGIN/);
  });
});
