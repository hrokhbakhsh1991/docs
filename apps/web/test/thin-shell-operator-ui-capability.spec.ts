/**
 * Thin Shell Phase 4ao — operatorUi package registration + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveOperatorUiCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-operator-ui-capability — Phase 4ao", () => {
  it("TS-4AO-01 denali publishes capabilities.operatorUi.ensureReady only", () => {
    const plugin = getDenaliPlugin();
    const operatorUi = resolveOperatorUiCapability(plugin);
    assert.ok(operatorUi);
    assert.equal(typeof operatorUi.ensureReady, "function");
    assert.equal(
      "TimeInput" in (operatorUi as object),
      false,
      "React components must not sit on frozen capability"
    );
  });

  it("TS-4AO-02 operator-ui binder deleted; warm + helpers are registry/capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-operator-ui-components-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/operator-ui-components-registry.ts"),
      "utf8"
    );
    const datetime = readFileSync(
      resolve(WEB_ROOT, "src/components/i18n/localized-datetime-picker.tsx"),
      "utf8"
    );
    const leaflet = readFileSync(
      resolve(WEB_ROOT, "src/components/ui/map/leaflet-default-icon.ts"),
      "utf8"
    );

    assert.match(warm, /resolveOperatorUiCapability/);
    assert.match(warm, /ensureOperatorUiWarm/);
    assert.doesNotMatch(warm, /workspace-operator-ui-components-bindings/);

    assert.match(registry, /app-cloud\.operatorUiComponentsSurface/);
    assert.match(registry, /peekOperatorUiComponentsSurface/);
    assert.match(registry, /resolveOperatorUiCapability/);
    assert.match(registry, /Map<string,\s*OperatorUiComponentsSurface>/);
    assert.match(registry, /peekOperatorUiComponentsSurface\(\s*pluginId/);
    assert.doesNotMatch(registry, /workspace-operator-ui-components-bindings/);

    assert.match(datetime, /operator-ui-components-registry/);
    assert.doesNotMatch(datetime, /workspace-operator-ui-components-bindings/);
    assert.match(leaflet, /operator-ui-components-registry/);
    assert.doesNotMatch(leaflet, /workspace-operator-ui-components-bindings/);
  });

  it("TS-4AO-03 package operator-ui surface uses string-keyed dynamic import", () => {
    const pkg = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/wizard/operator-ui-surface.ts"),
      "utf8"
    );
    assert.match(pkg, /OPERATOR_UI_COMPONENTS_SURFACE_KEY/);
    assert.match(pkg, /ensureOperatorUiComponentsPackageSurface/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /Map<string,\s*OperatorUiComponentsSurface>/);
    assert.match(pkg, /const specifier = "/);
    assert.doesNotMatch(pkg, /from \"\.\.\/ui\/operator-ui-components-surface\"/);
  });
});
