/**
 * Phase 10.2 S4 — manifest ↔ codegen ↔ DEFAULT_WORKSPACE_TYPE_BINDINGS parity (P2-T17).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "@app-tour/workspace-sdk";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../..");
const WORKSPACES_DIR = join(REPO_ROOT, "packages/workspaces");

type WorkspaceManifest = {
  readonly id: string;
  readonly workspaceTypes: readonly string[];
};

function loadManifests(): WorkspaceManifest[] {
  const out: WorkspaceManifest[] = [];
  for (const ent of readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const manifestPath = join(WORKSPACES_DIR, ent.name, "workspace.manifest.json");
    if (!existsSync(manifestPath)) continue;
    out.push(JSON.parse(readFileSync(manifestPath, "utf8")) as WorkspaceManifest);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

describe("workspace manifest codegen contract (P2-T17)", () => {
  it("every manifest workspaceType resolves via DEFAULT_WORKSPACE_TYPE_BINDINGS", () => {
    const manifests = loadManifests();
    assert.ok(manifests.length >= 3);

    for (const manifest of manifests) {
      for (const workspaceType of manifest.workspaceTypes) {
        const pluginId = resolveWorkspacePluginIdForType(
          workspaceType,
          DEFAULT_WORKSPACE_TYPE_BINDINGS
        );
        assert.equal(
          pluginId,
          manifest.id,
          `workspaceType ${workspaceType} should bind to plugin ${manifest.id}`
        );
      }
    }
  });

  it("bindings row count equals manifest workspaceType entries", () => {
    const manifests = loadManifests();
    const expectedRows = manifests.reduce((n, m) => n + m.workspaceTypes.length, 0);
    assert.equal(DEFAULT_WORKSPACE_TYPE_BINDINGS.length, expectedRows);
  });
});
