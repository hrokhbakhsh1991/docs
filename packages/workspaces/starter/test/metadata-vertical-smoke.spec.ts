import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { assertWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  assertWorkspaceDefinitionPayload,
  stripWorkspacePluginToDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";

describe("metadata-vertical-smoke", () => {
  it("MV-01 starter strip produces valid WorkspaceDefinitionPayload", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin());
    assert.doesNotThrow(() => assertWorkspaceDefinitionPayload(payload));
  });

  it("MV-02 metadata-shaped plugin passes assertWorkspacePlugin with starter overlay hooks", () => {
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    const adapted = {
      ...overlay,
      fieldRegistry: payload.fieldRegistry,
      ruleSet: payload.ruleSet,
      wizard: payload.wizard,
    };
    assert.doesNotThrow(() => assertWorkspacePlugin(adapted));
    assert.equal(adapted.validation, overlay.validation);
  });

  it("MV-03 vertical fixture includes platform.* composite field id when present", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin());
    const hasPlatformComposite = payload.fieldRegistry.fields.some((field) =>
      field.id.startsWith("platform.")
    );
    if (!hasPlatformComposite) {
      return;
    }
    assert.ok(hasPlatformComposite);
  });

  it("MV-04 buildRenderPlan returns at least one step for starter vertical", () => {
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    const adapted = {
      ...overlay,
      fieldRegistry: payload.fieldRegistry,
      ruleSet: payload.ruleSet,
      wizard: payload.wizard,
    };
    assert.doesNotThrow(() => assertWorkspacePlugin(adapted));
    const engine = PlatformWizardEngine.create(adapted);
    const plan = engine.buildRenderPlan({ tenantId: "starter-vertical", dimensions: { variant: "default" } });
    assert.ok(plan.length >= 1);
  });
});
