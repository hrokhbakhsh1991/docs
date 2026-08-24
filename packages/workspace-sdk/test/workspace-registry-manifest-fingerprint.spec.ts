import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ensureWorkspaceRegistryLoaded, resetWorkspaceRegistryLoadStateForTests } from "../src/workspace-registry/ensure-loaded.js";
import { computeWorkspaceManifestFingerprint } from "../src/workspace-registry/manifest-fingerprint.js";
import { workspaceRegistry } from "../src/workspace-registry/singleton.js";

const starterManifest = {
  id: "starter",
  version: 1,
  package: "@app-tour/workspace-starter",
  workspaceTypes: ["starter"],
  plugin: { entry: ".", export: "getStarterWorkspacePlugin" },
} as const;

describe("workspace-registry manifest fingerprint (REM-007)", () => {
  it("computeWorkspaceManifestFingerprint is stable for unchanged manifests", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ws-fp-"));
    await fs.mkdir(path.join(dir, "starter"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "starter", "workspace.manifest.json"),
      `${JSON.stringify(starterManifest, null, 2)}\n`,
      "utf8"
    );

    const first = await computeWorkspaceManifestFingerprint(dir);
    const second = await computeWorkspaceManifestFingerprint(dir);
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it("fingerprint changes when manifest content changes", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ws-fp-"));
    const manifestDir = path.join(dir, "starter");
    await fs.mkdir(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "workspace.manifest.json");
    await fs.writeFile(manifestPath, `${JSON.stringify(starterManifest, null, 2)}\n`, "utf8");

    const before = await computeWorkspaceManifestFingerprint(dir);
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify({ ...starterManifest, version: 2 }, null, 2)}\n`,
      "utf8"
    );
    const after = await computeWorkspaceManifestFingerprint(dir);
    assert.notEqual(before, after);
  });

  it("ensureWorkspaceRegistryLoaded reloads when fingerprint changes", async () => {
    if (process.env.NODE_ENV !== "test") {
      return;
    }

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ws-fp-reload-"));
    const manifestDir = path.join(dir, "starter");
    await fs.mkdir(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "workspace.manifest.json");
    await fs.writeFile(manifestPath, `${JSON.stringify(starterManifest, null, 2)}\n`, "utf8");

    const previousDir = process.env.WORKSPACES_DIR;
    process.env.WORKSPACES_DIR = dir;
    resetWorkspaceRegistryLoadStateForTests();

    try {
      await ensureWorkspaceRegistryLoaded();
      assert.equal(workspaceRegistry.get("starter")?.manifest.version, 1);

      await fs.writeFile(
        manifestPath,
        `${JSON.stringify({ ...starterManifest, version: 3 }, null, 2)}\n`,
        "utf8"
      );

      await ensureWorkspaceRegistryLoaded();
      assert.equal(workspaceRegistry.get("starter")?.manifest.version, 3);
    } finally {
      if (previousDir === undefined) {
        delete process.env.WORKSPACES_DIR;
      } else {
        process.env.WORKSPACES_DIR = previousDir;
      }
      resetWorkspaceRegistryLoadStateForTests();
    }
  });
});
