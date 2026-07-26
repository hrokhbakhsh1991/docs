/**
 * Thin Shell Phase 4ba — settingsEquipmentUi package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveSettingsEquipmentUiCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-settings-equipment-ui-capability — Phase 4ba", () => {
  it("TS-4BA-01 denali publishes capabilities.settingsEquipmentUi.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const settingsEquipmentUi = resolveSettingsEquipmentUiCapability(plugin);
    assert.ok(settingsEquipmentUi);
    assert.equal(typeof settingsEquipmentUi.ensureReady, "function");
    assert.equal(
      "EquipmentCatalogAvatar" in (settingsEquipmentUi as object),
      false,
      "React components must not sit on frozen capability"
    );
  });

  it("TS-4BA-02 settings-equipment-ui binder deleted; registry is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-settings-equipment-ui-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-equipment-ui-registry.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/equipment/equipment-settings-client.tsx"),
      "utf8"
    );

    assert.match(registry, /app-cloud\.settingsEquipmentUiSurface/);
    assert.match(registry, /peekSettingsEquipmentUiSurface/);
    assert.match(registry, /resolveSettingsEquipmentUiCapability/);
    assert.match(registry, /Map<string,\s*SettingsEquipmentUiSurface>/);
    assert.match(registry, /peekSettingsEquipmentUiSurface\(\s*pluginId/);
    assert.doesNotMatch(registry, /workspace-settings-equipment-ui-bindings/);
    assert.doesNotMatch(registry, /@app-cloud\/workspace-denali/);

    assert.match(page, /settings-equipment-ui-registry/);
    assert.doesNotMatch(page, /workspace-settings-equipment-ui-bindings/);
  });

  it("TS-4BA-03 package settings-equipment surface uses string-keyed dynamic import", () => {
    const pkg = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/settings/settings-equipment-ui-package-surface.ts"
      ),
      "utf8"
    );
    assert.match(pkg, /SETTINGS_EQUIPMENT_UI_SURFACE_KEY/);
    assert.match(pkg, /ensureSettingsEquipmentUiPackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*SettingsEquipmentUiPackageSurface>/);
    assert.match(pkg, /const specifier = "/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/settings\/settings-equipment-ui-surface\"/);
  });
});
