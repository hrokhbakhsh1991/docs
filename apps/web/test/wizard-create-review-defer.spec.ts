/**
 * Create warm must not publish Denali review; review loads on review step.
 * @see docs/dev/wizard-create-warm-ownership.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveWizardSurfacesCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const HOST = resolve(WEB_ROOT, "src/wizard/workspace-wizard-host.tsx");
const SURFACES = resolve(
  REPO_ROOT,
  "packages/workspaces/denali/src/wizard/wizard-surfaces-surface.ts"
);
const COMPOSITE = "app-cloud.wizardCompositeSurfaceCache";
const REVIEW = "app-cloud.wizardReviewSurfaceCache";

function clearCaches() {
  const g = globalThis as Record<string, unknown>;
  g[COMPOSITE] = new Map();
  g[REVIEW] = new Map();
}

function peek(key: string, id: string) {
  const g = globalThis as Record<string, unknown>;
  const cache = g[key];
  return cache instanceof Map ? (cache.get(id) ?? null) : null;
}

describe("wizard-create-review-defer", () => {
  it("/tours/new create warm (wizardHost.ensureReady) does not warm review surface", async () => {
    clearCaches();
    const plugin = getDenaliPlugin();
    await plugin.capabilities?.wizardHost?.ensureReady?.();
    assert.ok(peek(COMPOSITE, plugin.id), "composite must warm on create");
    assert.equal(peek(REVIEW, plugin.id), null, "review must stay cold on create warm");
  });

  it("navigating to review (wizardSurfaces.ensureReady) loads review surface", async () => {
    clearCaches();
    const plugin = getDenaliPlugin();
    await plugin.capabilities?.wizardHost?.ensureReady?.();
    assert.equal(peek(REVIEW, plugin.id), null);

    await resolveWizardSurfacesCapability(plugin)!.ensureReady();
    assert.ok(peek(COMPOSITE, plugin.id));
    assert.ok(peek(REVIEW, plugin.id), "review must publish after surfaces ensureReady");
    const review = peek(REVIEW, plugin.id) as {
      renderReviewChrome?: unknown;
      renderValidationSummary?: unknown;
    };
    assert.equal(typeof review.renderReviewChrome, "function");
    assert.equal(typeof review.renderValidationSummary, "function");
  });

  it("shell does not eagerly ensure review on mount; review step awaits readiness", () => {
    const host = readFileSync(HOST, "utf8");
    assert.match(host, /ensureGeneratedCompositeSurface/);
    assert.match(host, /ensureGeneratedReviewSurface/);
    assert.match(host, /data-workspace-wizard-review-loading/);
    assert.match(host, /reviewSurfaceStatus/);
    assert.match(host, /activeStepIdForReviewWarm/);
    // Mount effects warm labels + composite only (no review in those Promise.all lists).
    assert.match(
      host,
      /void Promise\.all\(\[\s*ensureGeneratedLabelResolver\(pluginId\),\s*ensureGeneratedCompositeSurface\(pluginId\),\s*\]\)/s
    );
    assert.doesNotMatch(
      host,
      /void Promise\.all\(\[\s*ensureGeneratedLabelResolver\(pluginId\),\s*ensureGeneratedCompositeSurface\(pluginId\),\s*ensureGeneratedReviewSurface\(pluginId\),\s*\]\)/s
    );
  });

  it("package splits composite vs review ensure helpers; capability still warms both", () => {
    const pkg = readFileSync(SURFACES, "utf8");
    assert.match(pkg, /export async function ensureWizardCompositePackageSurface/);
    assert.match(pkg, /export async function ensureWizardReviewPackageSurface/);
    assert.match(pkg, /export async function ensureWizardSurfacesPackageSurface/);
    assert.match(
      pkg,
      /ensureWizardSurfacesPackageSurface[\s\S]*ensureWizardCompositePackageSurface[\s\S]*ensureWizardReviewPackageSurface/
    );
  });
});
