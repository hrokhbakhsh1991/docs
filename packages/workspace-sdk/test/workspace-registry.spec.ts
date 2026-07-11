import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WorkspaceRegistry,
  parseWorkspaceManifest,
  parseWorkspaceManifestGlobModules,
  workspaceRegistry,
  workspaceRegistryEntriesFromManifests,
} from "../src/workspace-registry/index.js";

const starterManifest = {
  id: "starter",
  version: 1,
  package: "@app-tour/workspace-starter",
  workspaceTypes: ["starter"],
  plugin: { entry: ".", export: "getStarterWorkspacePlugin" },
  theme: { "color-primary": "#000" },
} as const;

const urbanManifest = {
  id: "urban",
  version: 1,
  package: "@app-tour/workspace-urban",
  workspaceTypes: ["urban"],
  plugin: { entry: "./plugin", export: "getUrbanWorkspacePlugin" },
} as const;

describe("parseWorkspaceManifestGlobModules", () => {
  it("parses glob modules and validates id matches directory name", () => {
    const entries = parseWorkspaceManifestGlobModules({
      "/packages/workspaces/starter/workspace.manifest.json": starterManifest,
      "/packages/workspaces/urban/workspace.manifest.json": urbanManifest,
    });

    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.workspaceId, "starter");
    assert.equal(entries[1]?.workspaceId, "urban");
    assert.equal(entries[0]?.manifest.theme?.["color-primary"], "#000");
  });

  it("rejects manifest id / directory mismatch", () => {
    assert.throws(
      () =>
        parseWorkspaceManifestGlobModules({
          "/packages/workspaces/starter/workspace.manifest.json": {
            ...starterManifest,
            id: "urban",
          },
        }),
      /WORKSPACE_MANIFEST_ID_MISMATCH/,
    );
  });
});

describe("WorkspaceRegistry", () => {
  it("loads via injected discoverer without side effects", async () => {
    const registry = new WorkspaceRegistry();
    assert.equal(registry.isLoaded(), false);

    await registry.load(() =>
      workspaceRegistryEntriesFromManifests({
        starter: parseWorkspaceManifest(starterManifest, "fixture"),
        urban: parseWorkspaceManifest(urbanManifest, "fixture"),
      }),
    );

    assert.equal(registry.isLoaded(), true);
    assert.equal(registry.list().length, 2);
    assert.equal(registry.get("starter")?.manifest.package, "@app-tour/workspace-starter");
    assert.equal(registry.get("missing"), undefined);
    assert.throws(() => registry.getOrThrow("missing"), /WORKSPACE_REGISTRY_UNKNOWN/);
  });

  it("singleton registry exposes get and list after load", async () => {
    workspaceRegistry.resetForTests();

    await workspaceRegistry.load(() =>
      workspaceRegistryEntriesFromManifests({
        starter: parseWorkspaceManifest(starterManifest, "fixture"),
      }),
    );

    assert.equal(workspaceRegistry.get("starter")?.workspaceId, "starter");
    assert.deepEqual(
      workspaceRegistry.list().map((entry) => entry.workspaceId),
      ["starter"],
    );

    workspaceRegistry.resetForTests();
  });

  it("preserves inferred manifest field types from JSON", () => {
    const manifest = parseWorkspaceManifest(starterManifest, "fixture");
    const themePrimary: string | undefined = manifest.theme?.["color-primary"];
    assert.equal(themePrimary, "#000");
  });
});
