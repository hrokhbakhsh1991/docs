/**
 * Thin Shell Phase 4ae / 4ai — flatEditForm package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveFlatEditFormCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-flat-edit-form-capability — Phase 4ae/4ai", () => {
  it("TS-4AE-01 denali publishes capabilities.flatEditForm.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const flatEditForm = resolveFlatEditFormCapability(plugin);
    assert.ok(flatEditForm);
    assert.equal(typeof flatEditForm.ensureReady, "function");
    assert.equal(
      "FlatEditForm" in (flatEditForm as object),
      false,
      "React component must not sit on frozen capability"
    );
  });

  it("TS-4AI-01 flat-edit form binder deleted; warm + form shell are registry/capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-flat-edit-form-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const formShell = readFileSync(resolve(WEB_ROOT, "src/wizard/flat-edit-form-shell.tsx"), "utf8");
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-flat-edit-form-registry.ts"),
      "utf8"
    );

    assert.match(warm, /resolveFlatEditFormCapability/);
    assert.match(warm, /ensureFlatEditFormWarm/);
    assert.doesNotMatch(warm, /ensureWizardFlatEditFormSurfaceFallback/);
    assert.doesNotMatch(warm, /workspace-wizard-flat-edit-form-bindings/);

    assert.match(formShell, /wizard-flat-edit-form-registry/);
    assert.doesNotMatch(formShell, /workspace-wizard-flat-edit-form-bindings\.generated/);

    assert.match(registry, /app-cloud\.wizardFlatEditFormSurface/);
    assert.match(registry, /peekWizardFlatEditFormSurface/);
    assert.match(registry, /resolveOperatorFlatEditTestIds/);
    assert.match(registry, /Map<string,\s*WizardFlatEditFormSurface>/);
    assert.match(registry, /resolveWizardFlatEditFormSurface\(\s*pluginId/);
    assert.doesNotMatch(registry, /workspace-wizard-flat-edit-form-bindings/);
  });

  it("TS-4AE-03 package flat-edit form surface uses string-keyed dynamic import", () => {
    const pkg = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/wizard/flat-edit-form-surface.ts"
      ),
      "utf8"
    );
    assert.match(pkg, /WIZARD_FLAT_EDIT_FORM_SURFACE_KEY/);
    assert.match(pkg, /ensureWizardFlatEditFormPackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*WizardFlatEditFormSurface>/);
    assert.match(pkg, /const specifier = "/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/chrome\/wizard-flat-edit-form-surface\"/);
  });
});
