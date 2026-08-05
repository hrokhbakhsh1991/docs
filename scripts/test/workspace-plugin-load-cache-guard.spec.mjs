/**
 * Phase I2 — workspace plugin load cache policy unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { productWorkspaceManifests } from "../codegen/workspace-registry/domains/core-registry.mjs";
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import { collectWorkspacePluginLoadCacheViolations } from "../guards/lib/workspace-plugin-load-cache-guard.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("workspace plugin load cache guard (Phase I2)", () => {
  it("generated web loaders match product trunk revision and max entries", () => {
    const product = productWorkspaceManifests(discoverManifests());
    const sortedIds = product.map((m) => m.id).sort();
    const generated = readFileSync(
      join(REPO_ROOT, "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts"),
      "utf8"
    );
    const violations = collectWorkspacePluginLoadCacheViolations(
      generated,
      sortedIds.length,
      sortedIds.join(",")
    );
    assert.deepEqual(violations, []);
  });

  it("accepts multiline WORKSPACE_PLUGIN_REGISTRY_REVISION export", () => {
    const violations = collectWorkspacePluginLoadCacheViolations(
      `
import { getOrCreateWorkspacePluginLoad, invalidateWorkspacePluginLoadCache } from "./workspace-plugin-load-cache";
export { invalidateWorkspacePluginLoadCache };
export const WORKSPACE_PLUGIN_REGISTRY_REVISION =
  "denali";
export const WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES = 1;
export async function loadWorkspacePluginByIdFromRegistry() {
  return getOrCreateWorkspacePluginLoad("denali", async () => ({}), {});
}
`,
      1,
      "denali"
    );
    assert.deepEqual(violations, []);
  });

  it("rejects SYNC eager map and static product imports", () => {
    const violations = collectWorkspacePluginLoadCacheViolations(
      `
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
const SYNC_WORKSPACE_PLUGINS = {};
export function resolveSyncWorkspacePluginFromRegistry() {}
export const WORKSPACE_PLUGIN_REGISTRY_REVISION = "denali";
export const WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES = 1;
import { getOrCreateWorkspacePluginLoad, invalidateWorkspacePluginLoadCache } from "./workspace-plugin-load-cache";
export { invalidateWorkspacePluginLoadCache };
`,
      1,
      "denali"
    );
    assert.ok(violations.some((v) => v.includes("SYNC_WORKSPACE_PLUGINS")));
    assert.ok(violations.some((v) => v.includes("resolveSyncWorkspacePluginFromRegistry")));
    assert.ok(violations.some((v) => v.includes("static-import")));
  });
});
