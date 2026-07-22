/**
 * Wave H.j — manifest opt-in for IgnorePlugin env gates; hand module deleted.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_CLIENT_WORKSPACE_IGNORE_RULES,
} from "../src/bootstrap/admin-client-workspace-ignore.generated.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Wave H.j — manifest IgnorePlugin", () => {
  it("H.j-01 generated rules match denali/urban manifests", () => {
    assert.equal(ADMIN_CLIENT_WORKSPACE_IGNORE_RULES.length, 2);
    const byLabel = Object.fromEntries(
      ADMIN_CLIENT_WORKSPACE_IGNORE_RULES.map((r) => [r.label, r])
    );
    assert.equal(byLabel.denali?.envKey, "ALLOW_DENALI_WEB_PLUGIN");
    assert.equal(byLabel.denali?.packageName, "@app-tour/workspace-denali");
    assert.equal(byLabel.urban?.envKey, "ALLOW_URBAN_WEB_PLUGIN");
    assert.equal(byLabel.urban?.packageName, "@app-tour/workspace-urban");
  });

  it("H.j-02 denali/urban manifests declare adminWeb.clientBundleEnvGate", () => {
    for (const id of ["denali", "urban"]) {
      const raw = JSON.parse(
        readFileSync(
          join(REPO_ROOT, `packages/workspaces/${id}/workspace.manifest.json`),
          "utf8"
        )
      );
      assert.equal(typeof raw.adminWeb?.clientBundleEnvGate, "string");
      assert.match(raw.adminWeb.clientBundleEnvGate, /^ALLOW_[A-Z0-9_]+$/);
    }
  });

  it("H.j-03 hand-written bootstrap ignore module is absent", () => {
    assert.equal(
      existsSync(join(WEB_ROOT, "src/bootstrap/admin-client-workspace-ignore.mjs")),
      false
    );
  });
});
