/**
 * Thin Shell Phase 4ac / 4ah — flatEditChrome package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveFlatEditChromeCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-warm-ownership-matrix — flatEditChrome capability", () => {
  it("TS-4AC-01 denali publishes capabilities.flatEditChrome.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const flatEditChrome = resolveFlatEditChromeCapability(plugin);
    assert.ok(flatEditChrome);
    assert.equal(typeof flatEditChrome.ensureReady, "function");
    assert.equal(
      "useFlatEditPageCore" in (flatEditChrome as object),
      false,
      "React hook must not sit on frozen capability"
    );
  });

  it("TS-4AH-01 flat-edit chrome binder deleted; warm + hook are registry/capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-flat-edit-chrome-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const flat = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-flat-edit-chrome-registry.ts"),
      "utf8"
    );

    assert.match(warm, /ensureWizardHostReady/);
    assert.match(warm, /loadWorkspacePluginByIdFromRegistry/);
    assert.doesNotMatch(warm, /ensureWizardFlatEditChromeSurfaceFallback/);
    assert.doesNotMatch(warm, /workspace-wizard-flat-edit-chrome-bindings/);

    assert.match(flat, /wizard-flat-edit-chrome-registry/);
    assert.doesNotMatch(flat, /workspace-wizard-flat-edit-chrome-bindings\.generated/);

    assert.match(registry, /app-cloud\.wizardFlatEditChromeSurface/);
    assert.match(registry, /peekWizardFlatEditChromeSurface/);
    assert.match(registry, /Map<string,\s*WizardFlatEditChromeSurface>/);
    assert.match(registry, /plugin\.id/);
    assert.doesNotMatch(registry, /workspace-wizard-flat-edit-chrome-bindings/);
  });

  it("TS-4AC-03 package flat-edit chrome surface uses bundler-visible dynamic import", () => {
    const pkg = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/wizard/flat-edit-chrome-surface.ts"
      ),
      "utf8"
    );
    assert.match(pkg, /WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY/);
    assert.match(pkg, /ensureWizardFlatEditChromePackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*WizardFlatEditChromeSurface>/);
    assert.match(pkg, /import\(/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/chrome\/wizard-flat-edit-chrome-surface\"/);
  });
});


describe("thin-shell-warm-ownership-matrix — runtime ensureReady", () => {
  const CHROME = "app-cloud.wizardFlatEditChromeSurface";
  const FORM = "app-cloud.wizardFlatEditFormSurface";
  const PAGE = "app-cloud.wizardFlatEditPageSurface";
  const CREATE_CHROME = "app-cloud.wizardCreateChromeSurface";
  const CREATE_VIEW = "app-cloud.wizardCreateViewSurface";
  const COMPOSITE = "app-cloud.wizardCompositeSurfaceCache";
  const REVIEW = "app-cloud.wizardReviewSurfaceCache";
  const KEYS = [CHROME, FORM, PAGE, CREATE_CHROME, CREATE_VIEW, COMPOSITE, REVIEW];

  function clear() {
    const g = globalThis as Record<string, unknown>;
    for (const k of KEYS) g[k] = new Map();
  }
  function peek(key: string, id: string) {
    const g = globalThis as Record<string, unknown>;
    const cache = g[key];
    return cache instanceof Map ? (cache.get(id) ?? null) : null;
  }

  it("A) wizardHost.ensureReady leaves flat-edit cold", async () => {
    clear();
    const plugin = getDenaliPlugin();
    await plugin.capabilities?.wizardHost?.ensureReady?.();
    assert.equal(peek(CHROME, plugin.id), null);
    assert.equal(peek(FORM, plugin.id), null);
    assert.equal(peek(PAGE, plugin.id), null);
    assert.ok(peek(CREATE_CHROME, plugin.id));
    assert.ok(peek(CREATE_VIEW, plugin.id));
  });

  it("A2) wizardHost.ensureReady warms composite but leaves review cold", async () => {
    clear();
    const plugin = getDenaliPlugin();
    await plugin.capabilities?.wizardHost?.ensureReady?.();
    assert.ok(peek(COMPOSITE, plugin.id), "create warm must publish composite");
    assert.equal(peek(REVIEW, plugin.id), null, "create warm must not publish review");
  });

  it("B) flatEdit*.ensureReady publish edit surfaces", async () => {
    clear();
    const plugin = getDenaliPlugin();
    await plugin.capabilities?.wizardHost?.ensureReady?.();
    await Promise.all([
      plugin.capabilities?.flatEditChrome?.ensureReady?.(),
      plugin.capabilities?.flatEditForm?.ensureReady?.(),
      plugin.capabilities?.flatEditPage?.ensureReady?.(),
    ]);
    assert.ok(peek(CHROME, plugin.id));
    assert.ok(peek(FORM, plugin.id));
    assert.ok(peek(PAGE, plugin.id));
  });

  it("C) wizardSurfaces.ensureReady publishes review after create warm", async () => {
    clear();
    const plugin = getDenaliPlugin();
    await plugin.capabilities?.wizardHost?.ensureReady?.();
    assert.equal(peek(REVIEW, plugin.id), null);
    await plugin.capabilities?.wizardSurfaces?.ensureReady?.();
    assert.ok(peek(COMPOSITE, plugin.id));
    assert.ok(peek(REVIEW, plugin.id));
  });

  it("source: denali wizardHost.ensureReady omits flat-edit package ensures", () => {
    const hooks = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts"),
      "utf8"
    );
    assert.doesNotMatch(hooks, /ensureWizardFlatEditChromePackageSurface/);
    assert.doesNotMatch(hooks, /ensureWizardFlatEditFormPackageSurface/);
    assert.doesNotMatch(hooks, /ensureWizardFlatEditPagePackageSurface/);
    assert.match(hooks, /ensureWizardCompositePackageSurface/);
    assert.doesNotMatch(hooks, /ensureWizardSurfacesPackageSurface/);
  });
});
