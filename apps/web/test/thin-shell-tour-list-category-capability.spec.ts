/**
 * Thin Shell Phase 4ax — tourListCategory capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveTourListCategoryCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-tour-list-category-capability — Phase 4ax", () => {
  it("TS-4AX-01 denali publishes capabilities.tourListCategory surface", () => {
    const plugin = getDenaliPlugin();
    const surface = resolveTourListCategoryCapability(plugin);
    assert.ok(surface);
    assert.ok(surface.tourKindValues.length > 0);
    assert.equal(typeof surface.isTourKindSlug, "function");
    assert.equal(typeof surface.resolveTourKindDuration, "function");
  });

  it("TS-4AX-02 tour-list-category binder deleted; registry is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-tour-list-category-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/features/tours/tour-list-category-registry.ts"),
      "utf8"
    );
    const logic = readFileSync(
      resolve(WEB_ROOT, "src/features/tours/tour-list-category-logic.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/tours-page-client.tsx"),
      "utf8"
    );

    assert.match(registry, /resolveTourListCategoryCapability/);
    assert.match(registry, /app-cloud\.tourListCategoryCache/);
    assert.doesNotMatch(registry, /workspace-tour-list-category-bindings/);
    assert.doesNotMatch(registry, /@app-cloud\/workspace-denali/);

    assert.match(logic, /tour-list-category-registry/);
    assert.doesNotMatch(logic, /workspace-tour-list-category-bindings/);
    assert.match(page, /tour-list-category-registry/);
    assert.doesNotMatch(page, /workspace-tour-list-category-bindings/);
  });

  it("TS-4AX-03 ensure + sync resolve publish surface under denali plugin id", async () => {
    const { ensureTourListCategorySurface, resolveTourListCategorySurface } = await import(
      "../src/features/tours/tour-list-category-registry"
    );
    const warmed = await ensureTourListCategorySurface("denali");
    assert.ok(warmed);
    assert.ok(warmed.isTourKindSlug("mountain_day"));
    assert.equal(resolveTourListCategorySurface("denali"), warmed);
  });
});
