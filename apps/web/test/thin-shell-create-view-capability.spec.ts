/**
 * Thin Shell Phase 4ad / 4ak — createView package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveCreateViewCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-create-view-capability — Phase 4ad/4ak", () => {
  it("TS-4AD-01 denali publishes capabilities.createView.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const createView = resolveCreateViewCapability(plugin);
    assert.ok(createView);
    assert.equal(typeof createView.ensureReady, "function");
    assert.equal(
      "CreateTourWizardView" in (createView as object),
      false,
      "React component must not sit on frozen capability"
    );
  });

  it("TS-4AK-01 create-view binder deleted; warm + create-ready are registry/capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-create-view-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const ready = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-create-view-registry.ts"),
      "utf8"
    );

    assert.match(warm, /ensureWizardHostReady/);
    assert.match(warm, /loadWorkspacePluginByIdFromRegistry/);
    assert.doesNotMatch(warm, /ensureWizardCreateViewSurfaceFallback/);
    assert.doesNotMatch(warm, /workspace-wizard-create-view-bindings/);

    assert.match(ready, /wizard-create-view-registry/);
    assert.doesNotMatch(ready, /workspace-wizard-create-view-bindings\.generated/);

    assert.match(registry, /app-cloud\.wizardCreateViewSurface/);
    assert.match(registry, /peekWizardCreateViewSurface/);
    assert.match(registry, /Map<string,\s*WizardCreateViewSurface>/);
    assert.match(registry, /resolveWizardCreateViewSurface\(\s*pluginId/);
    assert.doesNotMatch(registry, /workspace-wizard-create-view-bindings/);
  });

  it("TS-4AD-03 package create-view surface uses bundler-visible dynamic import", () => {
    const pkg = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/wizard/create-view-surface.ts"),
      "utf8"
    );
    assert.match(pkg, /WIZARD_CREATE_VIEW_SURFACE_KEY/);
    assert.match(pkg, /ensureWizardCreateViewPackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*WizardCreateViewSurface>/);
    assert.match(pkg, /importUiSurface\(/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/chrome\/wizard-create-view-surface\"/);
  });
});
