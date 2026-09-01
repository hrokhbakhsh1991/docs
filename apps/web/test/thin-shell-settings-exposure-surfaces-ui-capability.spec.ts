/**
 * Thin Shell Phase 4bb — settingsExposureSurfacesUi package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveSettingsExposureSurfacesUiCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-settings-exposure-surfaces-ui-capability — Phase 4bb", () => {
  it("TS-4BB-01 denali publishes capabilities.settingsExposureSurfacesUi.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const settingsExposureSurfacesUi = resolveSettingsExposureSurfacesUiCapability(plugin);
    assert.ok(settingsExposureSurfacesUi);
    assert.equal(typeof settingsExposureSurfacesUi.ensureReady, "function");
    assert.equal(
      "WorkspaceSurfacesPanel" in (settingsExposureSurfacesUi as object),
      false,
      "React components must not sit on frozen capability"
    );
  });

  it("TS-4BB-02 settings-exposure-surfaces-ui binder deleted; registry is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-settings-exposure-surfaces-ui-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-exposure-surfaces-ui-registry.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/exposure/exposure-settings-client.tsx"),
      "utf8"
    );

    assert.match(registry, /app-cloud\.settingsExposureSurfacesUiSurface/);
    assert.match(registry, /peekSettingsExposureSurfacesUiSurface/);
    assert.match(registry, /resolveSettingsExposureSurfacesUiCapability/);
    assert.match(registry, /Map<string,\s*SettingsExposureSurfacesUiSurface>/);
    assert.match(registry, /peekSettingsExposureSurfacesUiSurface\(\s*pluginId/);
    assert.doesNotMatch(registry, /workspace-settings-exposure-surfaces-ui-bindings/);
    assert.doesNotMatch(registry, /@app-cloud\/workspace-denali/);

    assert.match(page, /settings-exposure-surfaces-ui-registry/);
    assert.doesNotMatch(page, /workspace-settings-exposure-surfaces-ui-bindings/);
  });

  it("TS-4BB-03 package settings-exposure surface loads through static importUiSurface registry", () => {
    const pkg = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/settings/settings-exposure-surfaces-ui-package-surface.ts"),
      "utf8"
    );
    const loaders = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/wizard/import-ui-surface.loaders.ts"),
      "utf8"
    );
    assert.match(pkg, /importUiSurface\("..\/ui\/settings\/settings-exposure-surfaces-ui-binding"\)/);
    assert.doesNotMatch(pkg, /from \"..\/ui\/settings\/settings-exposure-surfaces-ui-binding\"/);
    assert.match(loaders, /"..\/ui\/settings\/settings-exposure-surfaces-ui-binding":/);
    assert.doesNotMatch(loaders, /webpackIgnore/);
  });
});
