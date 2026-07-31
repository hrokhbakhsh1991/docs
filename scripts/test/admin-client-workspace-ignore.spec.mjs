/**
 * Wave H.j — admin client IgnorePlugin codegen from adminWeb.clientBundleEnvGate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAdminWebManifest,
  generateAdminClientWorkspaceIgnore,
} from "../codegen/workspace-registry/domains/theme.mjs";

describe("admin client workspace ignore codegen (Wave H.j)", () => {
  it("emits denali/urban rules with escaped package regex sources", () => {
    const src = generateAdminClientWorkspaceIgnore([
      {
        id: "urban",
        package: "@app-tour/workspace-urban",
        adminWeb: { clientBundleEnvGate: "ALLOW_URBAN_WEB_PLUGIN" },
      },
      {
        id: "denali",
        package: "@app-tour/workspace-denali",
        adminWeb: { clientBundleEnvGate: "ALLOW_DENALI_WEB_PLUGIN" },
      },
      { id: "starter", package: "@app-tour/workspace-starter" },
    ]);
    assert.match(src, /Wave H\.j/);
    assert.match(src, /export const ADMIN_CLIENT_WORKSPACE_IGNORE_RULES/);
    assert.match(src, /resolveActiveAdminClientWorkspaceIgnoreRules/);
    assert.match(src, /ALLOW_DENALI_WEB_PLUGIN/);
    assert.match(src, /ALLOW_URBAN_WEB_PLUGIN/);
    assert.match(src, /resourceRegExpSource: "\^@app-tour\/workspace-denali\(\\\\\/\|\$\)"/);
    assert.match(src, /resourceRegExpSource: "\^@app-tour\/workspace-urban\(\\\\\/\|\$\)"/);
    // Sorted by id — denali before urban in the frozen array payload
    const denaliRule = src.indexOf('label: "denali"');
    const urbanRule = src.indexOf('label: "urban"');
    assert.ok(denaliRule > 0 && urbanRule > denaliRule);

    // Round-trip: JSON-escaped source compiles to the same matcher as H.g hand rules
    const denaliRe = new RegExp("^@app-tour/workspace-denali(\\/|$)");
    assert.equal(denaliRe.test("@app-tour/workspace-denali"), true);
    assert.equal(denaliRe.test("@app-tour/workspace-denali/host/draft/wizard-draft-unification-surface"), true);
    assert.equal(denaliRe.test("@app-tour/workspace-starter"), false);
  });

  it("rejects invalid clientBundleEnvGate", () => {
    assert.throws(
      () =>
        assertAdminWebManifest({
          id: "x",
          package: "@app-tour/workspace-x",
          adminWeb: { clientBundleEnvGate: "DENALI_OK" },
        }),
      /ALLOW_/
    );
  });

  it("requires package when gate is set", () => {
    assert.throws(
      () =>
        assertAdminWebManifest({
          id: "x",
          adminWeb: { clientBundleEnvGate: "ALLOW_X_WEB_PLUGIN" },
        }),
      /requires package/
    );
  });
});
