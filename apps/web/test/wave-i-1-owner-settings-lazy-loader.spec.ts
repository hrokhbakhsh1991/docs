/**
 * Wave I.1 — workspace-owner settings panel loads via codegen lazy loader (no static Urban import).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("Wave I.1 — owner settings lazy loader", () => {
  it("I.1-01 page has no static workspace-urban import", () => {
    const page = readFileSync(join(WEB_ROOT, "app/(app)/settings/workspace-owner/page.tsx"), "utf8");
    assert.doesNotMatch(page, /@app-tour\/workspace-urban/);
    assert.match(page, /loadWorkspaceOwnerSettingsPanel/);
    assert.match(page, /workspace-owner-settings-panel-loaders\.generated/);
  });

  it("I.1-02 generated loader declares urban case from manifest", () => {
    const loader = readFileSync(
      join(WEB_ROOT, "src/bootstrap/workspace-owner-settings-panel-loaders.generated.ts"),
      "utf8"
    );
    assert.match(loader, /case "urban"/);
    assert.match(loader, /@app-tour\/workspace-urban\/host\/settings\/owner-panel/);
    assert.match(loader, /WorkspaceOwnerSettingsPanel/);
  });

  it("I.1-03 urban manifest declares ownerSettingsPanel", () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, "packages/workspaces/urban/workspace.manifest.json"), "utf8")
    ) as {
      operatorShell?: { ownerSettingsPanel?: { module?: string; exportName?: string } };
    };
    assert.equal(
      manifest.operatorShell?.ownerSettingsPanel?.module,
      "@app-tour/workspace-urban/host/settings/owner-panel"
    );
    assert.equal(
      manifest.operatorShell?.ownerSettingsPanel?.exportName,
      "WorkspaceOwnerSettingsPanel"
    );
  });
});
