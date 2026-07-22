/**
 * Wave H.g + H.j — admin client IgnorePlugin gate is codegen’d from manifests (@app-tour + subpaths).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_CLIENT_WORKSPACE_IGNORE_RULES,
  resolveActiveAdminClientWorkspaceIgnoreRules,
} from "../src/bootstrap/admin-client-workspace-ignore.generated.mjs";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Wave H.g/H.j — IgnorePlugin gate", () => {
  it("H.g-01 rules use @app-tour scope and match root + subpaths", () => {
    assert.equal(ADMIN_CLIENT_WORKSPACE_IGNORE_RULES.length, 2);
    for (const rule of ADMIN_CLIENT_WORKSPACE_IGNORE_RULES) {
      assert.match(rule.resourceRegExpSource, /@app-tour/);
      assert.doesNotMatch(rule.resourceRegExpSource, /app-cloud/);
      const pkg =
        rule.label === "denali" ? "@app-tour/workspace-denali" : "@app-tour/workspace-urban";
      const re = new RegExp(rule.resourceRegExpSource);
      assert.equal(re.test(pkg), true);
      assert.equal(re.test(`${pkg}/host/draft`), true);
      assert.equal(re.test(`${pkg}/plugin`), true);
      assert.equal(re.test("@app-tour/workspace-starter"), false);
    }
  });

  it("H.g-02 active rules respect ALLOW_*_WEB_PLUGIN env", () => {
    assert.equal(resolveActiveAdminClientWorkspaceIgnoreRules({}).length, 2);
    assert.equal(
      resolveActiveAdminClientWorkspaceIgnoreRules({
        ALLOW_DENALI_WEB_PLUGIN: "true",
        ALLOW_URBAN_WEB_PLUGIN: "true",
      }).length,
      0
    );
    const onlyUrbanBlocked = resolveActiveAdminClientWorkspaceIgnoreRules({
      ALLOW_DENALI_WEB_PLUGIN: "true",
    });
    assert.equal(onlyUrbanBlocked.length, 1);
    assert.equal(onlyUrbanBlocked[0]?.label, "urban");
  });

  it("H.g-03 next.config wires generated ignore helper (no @app-cloud literals)", () => {
    const source = readFileSync(join(WEB_ROOT, "next.config.ts"), "utf8");
    assert.match(source, /admin-client-workspace-ignore\.generated\.mjs/);
    assert.match(source, /resolveActiveAdminClientWorkspaceIgnoreRules/);
    assert.doesNotMatch(source, /@app-cloud\/workspace-(denali|urban)/);
    assert.doesNotMatch(source, /resourceRegExp:\s*\/\^@app-tour\\\/workspace-denali\$\//);
  });

  it("H.j-01 hand-written ignore module is gone", () => {
    assert.equal(
      existsSync(join(WEB_ROOT, "src/bootstrap/admin-client-workspace-ignore.mjs")),
      false
    );
  });
});
