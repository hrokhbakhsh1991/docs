/**
 * Wave H.i — Urban owner settings panel lives in workspace-urban package.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("Wave H.i — urban owner panel package SoT", () => {
  it("H.i-01 web urban-owner-settings-panel.tsx is absent", () => {
    assert.equal(
      existsSync(join(WEB_ROOT, "app/(app)/settings/workspace-owner/urban-owner-settings-panel.tsx")),
      false
    );
  });

  it("H.i-02 package panel + page host wiring exist", () => {
    assert.equal(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/urban/src/settings/urban-owner-settings-panel.tsx")
      ),
      true
    );
    const page = readFileSync(join(WEB_ROOT, "app/(app)/settings/workspace-owner/page.tsx"), "utf8");
    assert.match(page, /loadWorkspaceOwnerSettingsPanel/);
    assert.match(page, /workspace-owner-settings-panel-loaders\.generated/);
    assert.doesNotMatch(page, /@app-cloud\/workspace-urban/);
    assert.match(page, /resolveTourOpsApiBaseUrl/);
    assert.match(page, /getTranslations\("settings\.workspaceOwner"\)/);
    assert.doesNotMatch(page, /\/urban\/settings/);
  });

  it("H.i-03 package uses URBAN_OWNER_SETTINGS_HTTP_PATH constant", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/workspaces/urban/src/settings/urban-owner-settings-panel.tsx"),
      "utf8"
    );
    assert.match(source, /URBAN_OWNER_SETTINGS_HTTP_PATH/);
    assert.match(source, /data-urban-owner-settings-panel/);
    assert.match(source, /WorkspaceOwnerSettingsPanel/);
  });
});
