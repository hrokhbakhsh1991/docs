/**
 * Thin Shell Phase 4o — trunk packages/workspaces/acme admitted without hand-written apps/web edits.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const ACME_DIR = join(REPO_ROOT, "packages/workspaces/acme");
const LOADERS = join(
  REPO_ROOT,
  "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts"
);

describe("Thin Shell Phase 4o — trunk acme admission", () => {
  it("trunk acme package exists with canonical plugin contract", () => {
    assert.equal(existsSync(join(ACME_DIR, "workspace.manifest.json")), true);
    const manifest = JSON.parse(readFileSync(join(ACME_DIR, "workspace.manifest.json"), "utf8"));
    assert.equal(manifest.id, "acme");
    assert.equal(manifest.package, "@app-tour/workspace-acme");
    assert.equal(manifest.plugin.entry, "./plugin");
    assert.equal(manifest.plugin.export, "getWorkspacePlugin");
    assert.equal(manifest.web.entry, "./plugin");
    assert.equal(manifest.web.export, "getWorkspacePlugin");
  });

  it("generated web loaders include acme via getWorkspacePlugin (dynamic import)", () => {
    const loaders = readFileSync(LOADERS, "utf8");
    assert.match(loaders, /case "acme":/);
    assert.ok(loaders.includes("@app-tour/workspace-acme/plugin"));
    assert.ok(loaders.includes("mod.getWorkspacePlugin()"));
    assert.ok(!loaders.includes("workspace-acme/host/"));
    assert.doesNotMatch(loaders, /from\s+["']@app-tour\/workspace-acme["']/);
  });
});
