/**
 * Thin Shell Phase 4af / 4aj — flatEditPage package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveFlatEditPageCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-flat-edit-page-capability — Phase 4af/4aj", () => {
  it("TS-4AF-01 denali publishes capabilities.flatEditPage.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const flatEditPage = resolveFlatEditPageCapability(plugin);
    assert.ok(flatEditPage);
    assert.equal(typeof flatEditPage.ensureReady, "function");
    assert.equal(
      "FlatEditPageView" in (flatEditPage as object),
      false,
      "React component must not sit on frozen capability"
    );
  });

  it("TS-4AJ-01 flat-edit page binder deleted; warm + page client are registry/capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-flat-edit-page-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const client = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-flat-edit-page-registry.ts"),
      "utf8"
    );

    assert.match(warm, /ensureWizardHostReady/);
    assert.match(warm, /loadWorkspacePluginByIdFromRegistry/);
    assert.doesNotMatch(warm, /ensureWizardFlatEditPageSurfaceFallback/);
    assert.doesNotMatch(warm, /workspace-wizard-flat-edit-page-bindings/);

    assert.match(client, /wizard-flat-edit-page-registry/);
    assert.doesNotMatch(client, /workspace-wizard-flat-edit-page-bindings\.generated/);

    assert.match(registry, /app-cloud\.wizardFlatEditPageSurface/);
    assert.match(registry, /peekWizardFlatEditPageSurface/);
    assert.match(registry, /Map<string,\s*WizardFlatEditPageSurface>/);
    assert.match(registry, /resolveWizardFlatEditPageSurface\(\s*pluginId/);
    assert.doesNotMatch(registry, /workspace-wizard-flat-edit-page-bindings/);
  });

  it("TS-4AF-03 package flat-edit page surface uses bundler-visible dynamic import", () => {
    const pkg = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/wizard/flat-edit-page-surface.ts"
      ),
      "utf8"
    );
    assert.match(pkg, /WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY/);
    assert.match(pkg, /ensureWizardFlatEditPagePackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*WizardFlatEditPageSurface>/);
    assert.match(pkg, /import\(/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/chrome\/wizard-flat-edit-page-surface\"/);
  });
});
