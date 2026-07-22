/**
 * Wave I.8 — apps/web product deps match product trunk (codegen-owned).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { collectAdminHostProductPackages } from "../../../scripts/codegen/workspace-registry/domains/theme.mjs";
import { discoverManifests } from "../../../scripts/codegen/workspace-registry/manifest-loader.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_PKG = join(REPO, "apps/web/package.json");

describe("Wave I.8 — admin web product deps", () => {
  it("I.8-01 web product trunk deps equal collectAdminHostProductPackages", () => {
    const pkg = JSON.parse(readFileSync(WEB_PKG, "utf8"));
    const expected = collectAdminHostProductPackages(discoverManifests());
    const actual = Object.keys(pkg.devDependencies ?? {})
      .filter(
        (name) =>
          name.startsWith("@app-tour/workspace-") && name !== "@app-tour/workspace-sdk"
      )
      .sort((a, b) => a.localeCompare(b));
    assert.deepEqual(actual, expected);
    assert.equal(pkg.devDependencies?.["@app-tour/workspace-finance-ws4"], undefined);
  });

  it("I.8-02 no product workspace packages in dependencies", () => {
    const pkg = JSON.parse(readFileSync(WEB_PKG, "utf8"));
    const products = Object.keys(pkg.dependencies ?? {}).filter(
      (name) =>
        name.startsWith("@app-tour/workspace-") && name !== "@app-tour/workspace-sdk"
    );
    assert.deepEqual(products, []);
  });
});
