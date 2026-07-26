/**
 * Thin Shell Phase 3e / Wave 5a — acme web plugin-loader admission without apps/web edits.
 * Complements Gap Closure E.* (transpile/API/allowlist) with the DoD claim for web loaders.
 * @see TEMP/THIN_SHELL_TARGET_ARCHITECTURE_PLAN.md Wave 5
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import { generateWebLoaders } from "../codegen/workspace-registry/domains/core-registry.mjs";
import { scaffoldWorkspace } from "../workspace-create.mjs";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const WEB_SRC = join(REPO_ROOT, "apps/web/src");
const WEB_APP = join(REPO_ROOT, "apps/web/app");
const ACME_ID = "acme-thin";
const ACME_PKG = "@app-tour/workspace-acme-thin";

function hashFile(abs) {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function collectHandWrittenWebPaths(root) {
  /** @type {string[]} */
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (name.includes(".generated.")) continue;
      if (!/\.(ts|tsx|js|jsx|mjs|cjs|css|mdoc|md)$/.test(name)) continue;
      out.push(abs);
    }
  }
  walk(root);
  return out;
}

function hashHandWrittenWebSources() {
  const paths = [
    ...collectHandWrittenWebPaths(WEB_SRC),
    ...collectHandWrittenWebPaths(WEB_APP),
  ].sort();
  /** @type {Record<string, string>} */
  const map = {};
  for (const abs of paths) {
    map[relative(REPO_ROOT, abs)] = hashFile(abs);
  }
  return map;
}

function withTempRepo(fn) {
  const repoRoot = mkdtempSync(join(tmpdir(), "thin-shell-acme-"));
  try {
    return fn(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("Thin Shell Wave 5a — acme web loader admission", () => {
  it("generateWebLoaders admits acme-thin without hand-written apps/web hash drift", () => {
    const before = hashHandWrittenWebSources();
    assert.ok(Object.keys(before).length > 50, "expected a non-trivial hand-written web tree");

    const trunk = discoverManifests();
    assert.ok(trunk.some((m) => m.id === "denali"));

    withTempRepo((repoRoot) => {
      const { pkgName } = scaffoldWorkspace({
        repoRoot,
        id: ACME_ID,
        guest: false,
      });
      assert.equal(pkgName, ACME_PKG);

      const acme = discoverManifests(join(repoRoot, "packages/workspaces"));
      assert.equal(acme.length, 1);
      assert.equal(acme[0]?.id, ACME_ID);
      assert.equal(acme[0]?.plugin?.entry, "./plugin");
      assert.equal(acme[0]?.plugin?.export, "getWorkspacePlugin");
      assert.equal(acme[0]?.web?.entry, "./plugin");
      assert.equal(acme[0]?.web?.export, "getWorkspacePlugin");
      const tsconfig = JSON.parse(
        readFileSync(join(repoRoot, "packages/workspaces", ACME_ID, "tsconfig.json"), "utf8")
      );
      assert.ok(Array.isArray(tsconfig.exclude));


      const union = [...trunk, ...acme].sort((a, b) => a.id.localeCompare(b.id));
      const loaders = generateWebLoaders(union);

      assert.match(loaders, new RegExp(`case "${ACME_ID}":`));
      assert.match(loaders, new RegExp(ACME_PKG.replace("/", "\\/")));
      assert.match(loaders, /mod\.getWorkspacePlugin\(\)/);
      assert.doesNotMatch(loaders, /getAcmeThinWorkspacePlugin/);
      assert.match(loaders, /await import\(/);
      assert.doesNotMatch(
        loaders,
        /(?:^|\n)\s*import\s+(?:type\s+)?[^;]*\s+from\s+["']@app-tour\/workspace-(?!sdk)[^"']+["']/m
      );
      assert.doesNotMatch(loaders, /from\s+["']@app-tour\/workspace-acme-thin/);
      assert.match(loaders, /WORKSPACE_PLUGIN_NOT_FOUND/);
    });

    const after = hashHandWrittenWebSources();
    assert.deepEqual(
      after,
      before,
      "hand-written apps/web sources must not change during in-memory acme admission"
    );
    assert.equal(
      existsSync(join(REPO_ROOT, `packages/workspaces/${ACME_ID}`)),
      false,
      `${ACME_ID} must not remain on trunk`
    );
  });
});
