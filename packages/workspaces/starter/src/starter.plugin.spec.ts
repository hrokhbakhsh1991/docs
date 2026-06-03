import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  assertWorkspacePlugin,
  getWorkspaceRuleCell,
  isWorkspacePlugin,
  STARTER_WORKSPACE_PLUGIN_ID,
  STARTER_WORKSPACE_TYPE,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceTypesFromPlugin,
} from "@app-tour/workspace-sdk";

import { STARTER_THEME_TOKENS_STYLESHEET, getStarterWorkspacePlugin } from "./starter.plugin";

describe("getStarterWorkspacePlugin()", () => {
  it("is declarative metadata validated by workspace-sdk", () => {
    assert.equal(isWorkspacePlugin(getStarterWorkspacePlugin()), true);
    assert.doesNotThrow(() => assertWorkspacePlugin(getStarterWorkspacePlugin()));
  });

  it("exposes expected plugin id, version, and workspace type", () => {
    assert.equal(getStarterWorkspacePlugin().id, STARTER_WORKSPACE_PLUGIN_ID);
    assert.equal(getStarterWorkspacePlugin().version, 1);
    assert.deepEqual(getStarterWorkspacePlugin().supportedWorkspaceTypes, [STARTER_WORKSPACE_TYPE]);
    assert.deepEqual(
      [...workspaceTypesFromPlugin(getStarterWorkspacePlugin())],
      [STARTER_WORKSPACE_TYPE],
    );
  });

  it("uses noop validation hooks (no side effects at registration)", () => {
    const hooks = getStarterWorkspacePlugin().validation;
    assert.equal(hooks.checkCapacity(99), null);
    assert.equal(hooks.checkTripDetails({}), null);
  });

  it("wires theme contract to theme/tokens.css and --ws-* variables", () => {
    assert.ok(getStarterWorkspacePlugin().theme);
    assert.equal(getStarterWorkspacePlugin().theme.optionalStylesheet, STARTER_THEME_TOKENS_STYLESHEET);
    assert.equal(
      getStarterWorkspacePlugin().theme.cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent],
      "var(--color-primary)",
    );
  });

  it("loads in platform-core without mutation", () => {
    const cell = getWorkspaceRuleCell(getStarterWorkspacePlugin().ruleSet, "default");
    assert.ok(cell);
    const loaded = PlatformWizardEngine.tryFromPlugin(getStarterWorkspacePlugin());
    assert.equal(loaded.ok, true);
    const engine = loaded.value;
    const plan = engine.buildRenderPlan({
      tenantId: "tenant-starter-test",
      dimensions: { variant: "default" },
    });
    assert.ok(plan.length >= 2);
  });
});
