/**
 * Thin Shell Phase 4as — wizardSurfaces package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveWizardSurfacesCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-wizard-surfaces-capability — Phase 4as", () => {
  it("TS-4AS-01 denali publishes capabilities.wizardSurfaces.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const wizardSurfaces = resolveWizardSurfacesCapability(plugin);
    assert.ok(wizardSurfaces);
    assert.equal(typeof wizardSurfaces.ensureReady, "function");
    assert.equal(
      "createCompositeSurface" in (wizardSurfaces as object),
      false,
      "factories must not sit on frozen capability"
    );
  });

  it("TS-4AS-02 surface binder deleted; warm + registries are capability-only", () => {
    const binder = resolve(WEB_ROOT, "src/bootstrap/wizard-surface-bindings.generated.ts");
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const shellRegistry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-surface-registry.ts"),
      "utf8"
    );
    const composite = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-composite-surface-registry.tsx"),
      "utf8"
    );
    const review = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-review-surface-registry.tsx"),
      "utf8"
    );

    assert.match(warm, /ensureWizardHostReady/);
    assert.match(warm, /loadWorkspacePluginByIdFromRegistry/);
    assert.doesNotMatch(warm, /wizard-surface-bindings/);

    assert.match(shellRegistry, /app-cloud\.wizardCompositeSurfaceCache/);
    assert.match(shellRegistry, /app-cloud\.wizardReviewSurfaceCache/);
    assert.match(shellRegistry, /resolveWizardSurfacesCapability/);
    assert.doesNotMatch(shellRegistry, /wizard-surface-bindings/);

    assert.match(composite, /wizard-surface-registry/);
    assert.doesNotMatch(composite, /wizard-surface-bindings/);
    assert.match(review, /wizard-surface-registry/);
    assert.doesNotMatch(review, /wizard-surface-bindings/);
  });

  it("TS-4AS-03 package surface uses bundler-visible dynamic import", () => {
    const pkg = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/wizard/wizard-surfaces-surface.ts"),
      "utf8"
    );
    assert.match(pkg, /WIZARD_COMPOSITE_SURFACE_CACHE_KEY/);
    assert.match(pkg, /WIZARD_REVIEW_SURFACE_CACHE_KEY/);
    assert.match(pkg, /ensureWizardSurfacesPackageSurface/);
    assert.match(pkg, /const compositeSpecifier = "/);
    assert.match(pkg, /const reviewSpecifier = "/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/surfaces\/composite-surface\"/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/surfaces\/review-surface\"/);
  });

  it("TS-4AS-04 ensureReady publishes composite + review under denali surface id", async () => {
    const plugin = getDenaliPlugin();
    await resolveWizardSurfacesCapability(plugin)!.ensureReady();
    const {
      resolveGeneratedCompositeSurface,
      resolveGeneratedReviewSurface,
    } = await import("../src/wizard/wizard-surface-registry");
    const composite = resolveGeneratedCompositeSurface("denali");
    const review = resolveGeneratedReviewSurface("denali");
    assert.ok(composite);
    assert.equal(typeof composite.renderCompositeField, "function");
    assert.ok(review);
    assert.equal(typeof review.renderValidationSummary, "function");
  });
});
