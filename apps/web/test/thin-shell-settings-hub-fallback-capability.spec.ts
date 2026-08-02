/**
 * Thin Shell Phase 4av — settingsHubFallback capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveSettingsHubFallbackCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-settings-hub-fallback-capability — Phase 4av", () => {
  it("TS-4AV-01 denali publishes capabilities.settingsHubFallback policy data", () => {
    const plugin = getDenaliPlugin();
    const policy = resolveSettingsHubFallbackCapability(plugin);
    assert.ok(policy);
    assert.ok(policy.requiredModuleIds.length > 0);
    assert.ok(policy.fallbackModules.integrations);
    assert.equal(policy.fallbackModules.integrations?.id, "integrations");
  });

  it("TS-4AV-02 settings-hub binder deleted; registry is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-settings-hub-fallback-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-hub-fallback-registry.ts"),
      "utf8"
    );
    const guard = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-module-consistency-guard.ts"),
      "utf8"
    );
    const hub = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/settings-hub-client.tsx"),
      "utf8"
    );

    assert.match(registry, /resolveSettingsHubFallbackCapability/);
    assert.match(registry, /app-cloud\.settingsHubFallbackCache/);
    assert.doesNotMatch(registry, /workspace-settings-hub-fallback-bindings/);
    assert.doesNotMatch(registry, /DENALI_/);

    assert.match(guard, /settings-hub-fallback-registry/);
    assert.doesNotMatch(guard, /workspace-settings-hub-fallback-bindings/);
    assert.match(hub, /settings-hub-fallback-registry/);
    assert.doesNotMatch(hub, /workspace-settings-hub-fallback-bindings/);
  });

  it("TS-4AV-03 ensure + sync resolve publish policy under denali plugin id", async () => {
    const {
      ensureSettingsHubFallbackPolicy,
      resolveSettingsHubFallbackPolicy,
    } = await import("../src/features/settings/settings-hub-fallback-registry");
    const warmed = await ensureSettingsHubFallbackPolicy("denali");
    assert.ok(warmed);
    assert.ok(warmed.requiredModuleIds.includes("integrations"));
    const sync = resolveSettingsHubFallbackPolicy("denali");
    assert.equal(sync, warmed);
  });
});
