/**
 * Thin Shell Phase 4bi — mountain dictionary relocated; install fan-in honesty.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

describe("thin-shell-domain-residue — Phase 4bi", () => {
  it("TS-4BI-01 iran-mountain-landmarks is not under apps/web/src", () => {
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/lib/geocoding/iran-mountain-landmarks.ts")),
      false
    );
    assert.equal(
      existsSync(resolve(REPO_ROOT, "packages/iran-mountain-landmarks/src/index.ts")),
      true
    );
    const search = readFileSync(
      resolve(WEB_ROOT, "src/lib/geocoding/geocoding-search.ts"),
      "utf8"
    );
    assert.match(search, /@app-tour\/iran-mountain-landmarks/);
    assert.doesNotMatch(search, /\.\/iran-mountain-landmarks/);
  });

  it("TS-4BI-02 product workspaces stay out of web production dependencies (Wave I.7)", () => {
    const pkg = JSON.parse(readFileSync(resolve(WEB_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies ?? {};
    const devDeps = pkg.devDependencies ?? {};
    for (const name of Object.keys(deps)) {
      if (name.startsWith("@app-tour/workspace-") && name !== "@app-tour/workspace-sdk") {
        assert.fail(`product workspace in production dependencies: ${name}`);
      }
    }
    assert.equal(typeof deps["@app-tour/iran-mountain-landmarks"], "string");
    assert.equal(
      typeof devDeps["@app-tour/workspace-denali"],
      "string",
      "product trunk remains installable via devDependencies (Wave I.8)"
    );
  });
});
