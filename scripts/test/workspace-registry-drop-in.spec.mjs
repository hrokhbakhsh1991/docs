/**
 * P7-T06 — drop-in workspace manifest fixture validates without trunk package dir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  discoverManifests,
  generateSdkBindings,
} from "../generate-workspace-registry.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_MANIFEST = join(
  REPO_ROOT,
  "test/fixtures/workspaces/climbing-club/workspace.manifest.json"
);

describe("workspace registry drop-in (P7-T06)", () => {
  it("trunk manifests discover starter, denali, urban", () => {
    const manifests = discoverManifests();
    const ids = manifests.map((m) => m.id).sort();
    assert.deepEqual(ids, ["denali", "starter", "urban"]);
  });

  it("climbing-club fixture merges into generated bindings without packages/workspaces/climbing-club", () => {
    const trunk = discoverManifests();
    const fixture = JSON.parse(readFileSync(FIXTURE_MANIFEST, "utf8"));
    const merged = [...trunk, fixture].sort((a, b) => a.id.localeCompare(b.id));
    const sdk = generateSdkBindings(merged);
    assert.match(sdk, /workspaceType: "climbing-club"/);
    assert.match(sdk, /pluginId: "climbing-club"/);
    assert.equal(
      merged.find((m) => m.id === "climbing-club")?.workspaceTypes[0],
      "climbing-club"
    );
  });
});
