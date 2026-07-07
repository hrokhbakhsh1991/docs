/**
 * Phase I2 — workspace plugin load cache policy unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import { collectWorkspacePluginLoadCacheViolations } from "../guards/lib/workspace-plugin-load-cache-guard.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("workspace plugin load cache guard (Phase I2)", () => {
  it("generated web loaders match trunk manifest revision and max entries", () => {
    const manifests = discoverManifests();
    const sortedIds = manifests.map((m) => m.id).sort();
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
});
