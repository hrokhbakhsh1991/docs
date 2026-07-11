import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  WorkspaceRegistry,
  parseWorkspaceManifest,
  resetWorkspaceRegistryTelemetryForTests,
  setWorkspaceRegistryTelemetrySink,
  workspaceRegistryEntriesFromManifests,
  type WorkspaceRegistryTelemetryEvent,
} from "../src/workspace-registry/index.js";
import { createNodeWorkspaceManifestDiscoverer } from "../src/workspace-registry/server.js";

const validManifest = {
  id: "starter",
  version: 1,
  package: "@app-tour/workspace-starter",
  workspaceTypes: ["starter"],
  plugin: { entry: ".", export: "getStarterWorkspacePlugin" },
} as const;

function captureTelemetry(): {
  readonly events: WorkspaceRegistryTelemetryEvent[];
  readonly restore: () => void;
} {
  const events: WorkspaceRegistryTelemetryEvent[] = [];
  setWorkspaceRegistryTelemetrySink((event) => {
    events.push(event);
  });
  return {
    events,
    restore: () => {
      resetWorkspaceRegistryTelemetryForTests();
    },
  };
}

afterEach(() => {
  resetWorkspaceRegistryTelemetryForTests();
});

describe("workspace registry chaos — corrupted manifests", () => {
  it("throws WORKSPACE_MANIFEST_INVALID when id is missing (does not mark registry loaded)", async () => {
    const telemetry = captureTelemetry();
    const registry = new WorkspaceRegistry();

    const corrupt = {
      version: 1,
      package: "@app-tour/workspace-evil",
      workspaceTypes: ["evil"],
      plugin: { entry: ".", export: "getEvilWorkspacePlugin" },
    };

    await assert.rejects(
      () =>
        registry.load(() => {
          parseWorkspaceManifest(corrupt, "packages/workspaces/evil/workspace.manifest.json");
          return [];
        }),
      /WORKSPACE_MANIFEST_INVALID:packages\/workspaces\/evil\/workspace\.manifest\.json/,
    );

    assert.equal(registry.isLoaded(), false);
    assert.equal(telemetry.events.length, 1);
    assert.equal(telemetry.events[0]?.code, "WORKSPACE_MANIFEST_INVALID");
    assert.match(telemetry.events[0]?.message ?? "", /Required/);
    telemetry.restore();
  });

  it("throws WORKSPACE_REGISTRY_DUPLICATE_ID and does not overwrite the first entry", async () => {
    const telemetry = captureTelemetry();
    const registry = new WorkspaceRegistry();
    const manifest = parseWorkspaceManifest(validManifest, "fixture");

    const duplicateEntries = workspaceRegistryEntriesFromManifests({
      "workspace-a": { ...manifest, id: "workspace-a" },
      "workspace-b": { ...manifest, id: "workspace-b" },
    });

    const entriesWithDuplicateWorkspaceId = [
      { ...duplicateEntries[0]!, workspaceId: "dup" },
      { ...duplicateEntries[1]!, workspaceId: "dup" },
    ] as const;

    await assert.rejects(
      () => registry.load(() => [...entriesWithDuplicateWorkspaceId]),
      /WORKSPACE_REGISTRY_DUPLICATE_ID:dup/,
    );

    assert.equal(registry.isLoaded(), false);
    assert.equal(registry.get("dup"), undefined);
    assert.equal(telemetry.events.length, 1);
    assert.equal(telemetry.events[0]?.code, "WORKSPACE_REGISTRY_DUPLICATE_ID");
    telemetry.restore();
  });

  it("emits telemetry for corrupted on-disk manifest via node discoverer", async () => {
    const telemetry = captureTelemetry();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ws-chaos-"));
    const workspaceDir = path.join(root, "broken");
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceDir, "workspace.manifest.json"),
      JSON.stringify({
        version: 1,
        package: "@app-tour/workspace-broken",
        workspaceTypes: ["broken"],
        plugin: { entry: ".", export: "getBrokenWorkspacePlugin" },
      }),
    );

    const registry = new WorkspaceRegistry();

    try {
      await assert.rejects(
        () => registry.load(createNodeWorkspaceManifestDiscoverer(root)),
        /WORKSPACE_MANIFEST_INVALID/,
      );

      assert.equal(registry.isLoaded(), false);
      assert.equal(telemetry.events.length, 1);
      assert.equal(telemetry.events[0]?.code, "WORKSPACE_MANIFEST_INVALID");
      assert.match(telemetry.events[0]?.message ?? "", /workspace\.manifest\.json/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      telemetry.restore();
    }
  });
});
