/**
 * Thin Shell Phase 4az — settingsDestination capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveSettingsDestinationCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-settings-destination-capability — Phase 4az", () => {
  it("TS-4AZ-01 denali publishes capabilities.settingsDestination surface", () => {
    const plugin = getDenaliPlugin();
    const surface = resolveSettingsDestinationCapability(plugin);
    assert.ok(surface);
    assert.ok(surface.locationTypes.length > 0);
    assert.equal(typeof surface.normalizeLocationType, "function");
    assert.equal(typeof surface.metadataFieldsForType, "function");
  });

  it("TS-4AZ-02 settings-destination binder deleted; registry is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-settings-destination-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-destination-registry.ts"),
      "utf8"
    );
    const logic = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/destination-form-logic.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/locations/locations-settings-client.tsx"),
      "utf8"
    );

    assert.match(registry, /resolveSettingsDestinationCapability/);
    assert.match(registry, /app-cloud\.settingsDestinationCache/);
    assert.doesNotMatch(registry, /workspace-settings-destination-bindings/);
    assert.doesNotMatch(registry, /@app-cloud\/workspace-denali/);

    assert.match(logic, /settings-destination-registry/);
    assert.doesNotMatch(logic, /workspace-settings-destination-bindings/);
    assert.match(page, /settings-destination-registry/);
    assert.doesNotMatch(page, /workspace-settings-destination-bindings/);
  });

  it("TS-4AZ-03 ensure + sync resolve publish surface under denali plugin id", async () => {
    const { ensureSettingsDestinationSurface, resolveSettingsDestinationSurface } = await import(
      "../src/features/settings/settings-destination-registry"
    );
    const warmed = await ensureSettingsDestinationSurface("denali");
    assert.ok(warmed);
    assert.equal(warmed.normalizeLocationType("peak"), "peak");
    assert.equal(resolveSettingsDestinationSurface("denali"), warmed);
  });
});
