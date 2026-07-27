/**
 * Thin Shell Phase 4aq — labels package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveLabelsCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-labels-capability — Phase 4aq", () => {
  it("TS-4AQ-01 denali publishes capabilities.labels.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const labels = resolveLabelsCapability(plugin);
    assert.ok(labels);
    assert.equal(typeof labels.ensureReady, "function");
    assert.equal(
      "resolveFieldLabel" in (labels as object),
      false,
      "resolver methods must not sit on frozen capability"
    );
  });

  it("TS-4AQ-02 label binder deleted; warm + helpers are registry/capability-only", () => {
    const binder = resolve(WEB_ROOT, "src/bootstrap/wizard-label-bindings.generated.ts");
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const registry = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-label-registry.ts"), "utf8");
    const surface = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-label-surface-registry.ts"),
      "utf8"
    );
    const submit = readFileSync(
      resolve(WEB_ROOT, "src/wizard/resolve-wizard-submit-error-message.ts"),
      "utf8"
    );

    assert.match(warm, /ensureWizardHostReady/);
    assert.match(warm, /loadWorkspacePluginByIdFromRegistry/);
    assert.doesNotMatch(warm, /wizard-label-bindings/);

    assert.match(registry, /app-cloud\.wizardLabelResolverCache/);
    assert.match(registry, /ensureGeneratedLabelResolver/);
    assert.match(registry, /resolveLabelsCapability/);
    assert.doesNotMatch(registry, /wizard-label-bindings/);

    assert.match(surface, /wizard-label-registry/);
    assert.doesNotMatch(surface, /wizard-label-bindings/);
    assert.match(submit, /wizard-label-registry/);
    assert.doesNotMatch(submit, /wizard-label-bindings/);
  });

  it("TS-4AQ-03 package label surface uses string-keyed dynamic import", () => {
    const pkg = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/wizard/label-resolver-surface.ts"),
      "utf8"
    );
    assert.match(pkg, /WIZARD_LABEL_RESOLVER_CACHE_KEY/);
    assert.match(pkg, /ensureWizardLabelResolverPackageSurface/);
    assert.match(pkg, /const specifier = "/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/surfaces\/field-label-resolver\"/);
  });

  it("TS-4AQ-04 ensureReady publishes resolver under denali surface id", async () => {
    const plugin = getDenaliPlugin();
    await resolveLabelsCapability(plugin)!.ensureReady();
    const { resolveGeneratedLabelResolver } = await import("../src/wizard/wizard-label-registry");
    const resolver = resolveGeneratedLabelResolver("denali");
    assert.ok(resolver);
    assert.equal(typeof resolver.resolveFieldLabel, "function");
  });
});
