/**
 * Wave I.7 — admin host install classification (product deps ≠ dependencies).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_PKG = join(REPO, "apps/web/package.json");
const GUARD = join(REPO, "scripts/guards/guard-host-workspace-deps.mjs");

describe("Wave I.7 — host install classification", () => {
  it("I.7-01 starter is not in apps/web dependencies", () => {
    const pkg = JSON.parse(readFileSync(WEB_PKG, "utf8"));
    assert.equal(pkg.dependencies?.["@app-tour/workspace-starter"], undefined);
    assert.equal(pkg.devDependencies?.["@app-tour/workspace-starter"], "workspace:*");
  });

  it("I.7-02 no product workspace packages in apps/web dependencies", () => {
    const pkg = JSON.parse(readFileSync(WEB_PKG, "utf8"));
    const products = Object.keys(pkg.dependencies ?? {}).filter(
      (name) =>
        name.startsWith("@app-tour/workspace-") && name !== "@app-tour/workspace-sdk"
    );
    assert.deepEqual(products, []);
  });

  it("I.7-03 host guard encodes I.8 verifyAdminWebPackageJson", () => {
    const source = readFileSync(GUARD, "utf8");
    assert.match(source, /verifyAdminWebPackageJson/);
    assert.match(source, /Wave I\.8/);
  });
});
