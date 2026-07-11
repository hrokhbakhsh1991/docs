import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  WorkspaceRegistry,
  readWorkspaceManifestTheme,
  resolveWorkspaceManifestThemeForPlugin,
  workspaceRegistryEntriesFromManifests,
} from "../src/workspace-registry/index.js";
import { discoverWorkspaceManifestsFromDirectory } from "../src/workspace-registry/server.js";

describe("readWorkspaceManifestTheme", () => {
  it("returns undefined for missing or empty theme blocks", () => {
    assert.equal(readWorkspaceManifestTheme(undefined), undefined);
    assert.equal(readWorkspaceManifestTheme({ theme: {} }), undefined);
  });

  it("returns frozen theme map from manifest", () => {
    const theme = readWorkspaceManifestTheme({
      theme: { "--color-primary": "#f00", "color-secondary": "#00f" },
    });

    assert.deepEqual(theme, {
      "--color-primary": "#f00",
      "color-secondary": "#00f",
    });
    assert.equal(Object.isFrozen(theme), true);
  });
});

describe("resolveWorkspaceManifestThemeForPlugin", () => {
  it("reads theme for a loaded workspace id", async () => {
    const registry = new WorkspaceRegistry();
    await registry.load(() =>
      workspaceRegistryEntriesFromManifests({
        demo: {
          id: "demo",
          version: 1,
          package: "@app-tour/workspace-demo",
          workspaceTypes: ["demo"],
          plugin: { entry: ".", export: "getDemoWorkspacePlugin" },
          theme: { "--color-primary": "#f00" },
        },
      }),
    );

    const theme = resolveWorkspaceManifestThemeForPlugin("demo", registry);
    assert.deepEqual(theme, { "--color-primary": "#f00" });
  });
});

describe("discoverWorkspaceManifestsFromDirectory", () => {
  it("discovers manifests from a workspaces directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ws-theme-"));
    const workspaceDir = path.join(root, "demo");
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceDir, "workspace.manifest.json"),
      JSON.stringify({
        id: "demo",
        version: 1,
        package: "@app-tour/workspace-demo",
        workspaceTypes: ["demo"],
        plugin: { entry: ".", export: "getDemoWorkspacePlugin" },
        theme: { "--color-primary": "#f00" },
      }),
    );

    try {
      const entries = await discoverWorkspaceManifestsFromDirectory(root);
      assert.equal(entries.length, 1);
      assert.equal(readWorkspaceManifestTheme(entries[0]?.manifest)?.["--color-primary"], "#f00");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
