/**
 * Thin Shell Phase 4ab / 4ag — createChrome package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveCreateChromeCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-create-chrome-capability — Phase 4ab/4ag", () => {
  it("TS-4AB-01 denali publishes capabilities.createChrome.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const createChrome = resolveCreateChromeCapability(plugin);
    assert.ok(createChrome);
    assert.equal(typeof createChrome.ensureReady, "function");
    assert.equal(
      "useCreateTourWizardCore" in (createChrome as object),
      false,
      "React hook must not sit on frozen capability"
    );
  });

  it("TS-4AG-01 create-chrome binder deleted; warm + hook are registry/capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-create-chrome-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-create-chrome-registry.ts"),
      "utf8"
    );
    const draftShell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");

    assert.match(warm, /resolveCreateChromeCapability/);
    assert.match(warm, /ensureCreateChromeWarm/);
    assert.doesNotMatch(warm, /ensureWizardCreateChromeSurfaceFallback/);
    assert.doesNotMatch(warm, /workspace-wizard-create-chrome-bindings/);

    assert.match(create, /wizard-create-chrome-registry/);
    assert.doesNotMatch(create, /workspace-wizard-create-chrome-bindings\.generated/);

    assert.match(registry, /app-cloud\.wizardCreateChromeSurface/);
    assert.match(registry, /peekWizardCreateChromeSurface/);
    assert.match(registry, /Map<string,\s*WizardCreateChromeSurface>/);
    assert.match(registry, /session\.pluginId/);
    assert.doesNotMatch(registry, /workspace-wizard-create-chrome-bindings/);

    assert.doesNotMatch(draftShell, /workspace-wizard-create-chrome-bindings/);
  });

  it("TS-4AB-03 package create-chrome surface uses string-keyed dynamic import", () => {
    const pkg = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/wizard/create-chrome-surface.ts"
      ),
      "utf8"
    );
    assert.match(pkg, /WIZARD_CREATE_CHROME_SURFACE_KEY/);
    assert.match(pkg, /ensureWizardCreateChromePackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*WizardCreateChromeSurface>/);
    assert.match(pkg, /const specifier = "/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/chrome\/wizard-create-chrome-surface\"/);
  });
});
