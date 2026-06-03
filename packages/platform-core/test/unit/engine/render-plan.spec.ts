import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  WorkspaceFieldRegistry,
  WorkspaceRuleSet,
  WorkspaceWizardSurface,
} from "@app-tour/workspace-sdk/plugin-types";

import { testRuleContext } from "../../fixtures/rule-context.fixture.js";
import {
  testStarterFieldRegistry,
  testStarterRuleSet,
  testStarterWizardSurface,
} from "../../fixtures/starter.fixture.js";
import { FieldRegistryEngine } from "../../../src/engine/field-registry.engine.js";
import { buildRenderPlan } from "../../../src/engine/render-plan.js";
import { RuleEngine } from "../../../src/engine/rule.engine.js";
import { STARTER_PLAN_SNAPSHOT } from "../../fixtures/starter-plan-golden.js";

function buildPlan(
  registry: WorkspaceFieldRegistry,
  ruleSet: WorkspaceRuleSet,
  wizard: WorkspaceWizardSurface,
  options?: Parameters<typeof buildRenderPlan>[4],
) {
  const fieldEngine = FieldRegistryEngine.create(registry);
  const ruleEngine = RuleEngine.create(ruleSet, fieldEngine);
  return buildRenderPlan(wizard, fieldEngine, ruleEngine, testRuleContext({ variant: "default" }), options);
}

describe("buildRenderPlan", () => {
  it("builds full plan for starter plugin", () => {
    const plan = buildPlan(testStarterFieldRegistry(), testStarterRuleSet(), testStarterWizardSurface());
    assert.equal(plan.length, 2);
    assert.equal(plan[0]?.stepId, "basics");
    assert.equal(plan[0]?.fields.length, 1);
    assert.equal(plan[1]?.stepId, "details");
    assert.equal(plan[1]?.fields.length, 1);
    const title = plan[0]?.fields[0];
    const summary = plan[1]?.fields[0];
    assert.equal(title?.fieldId, "basics.title");
    assert.equal(title?.kind, "text");
    assert.equal(title?.required, true);
    assert.equal(summary?.fieldId, "details.summary");
    assert.equal(summary?.kind, "text");
    assert.equal(summary?.required, false);
  });

  it("omits hidden fields from plan rows (row.hidden false is not visibility authority)", () => {
    const registry: WorkspaceFieldRegistry = {
      version: 1,
      fields: [
        {
          id: "step.visible",
          canonicalPath: "step.visible",
          stepId: "step",
          kind: "text",
          required: true,
        },
        {
          id: "step.hidden",
          canonicalPath: "step.hidden",
          stepId: "step",
          kind: "text",
          required: false,
        },
      ],
    };
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [
            { fieldId: "step.visible", hidden: false },
            { fieldId: "step.hidden", hidden: true },
          ],
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["step"],
      inactiveFieldGroups: [],
      wizardCapacityStepRedundant: false,
    };
    const plan = buildPlan(registry, ruleSet, wizard);
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.fields.length, 1);
    assert.equal(plan[0]?.fields[0]?.fieldId, "step.visible");
    assert.equal(plan[0]?.fields[0]?.hidden, false);
    assert.ok(!plan[0]?.fields.some((row) => row.fieldId === "step.hidden"));
  });

  it("excludes hidden fields from plan", () => {
    const registry: WorkspaceFieldRegistry = {
      version: 1,
      fields: [
        {
          id: "only.field",
          canonicalPath: "only.field",
          stepId: "step",
          kind: "text",
          required: true,
        },
      ],
    };
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "only.field", hidden: true }],
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["step"],
      inactiveFieldGroups: [],
      wizardCapacityStepRedundant: false,
    };
    const plan = buildPlan(registry, ruleSet, wizard);
    assert.deepEqual(plan, []);
  });

  it("preserves composite kind with uiHints.compositeId", () => {
    const registry: WorkspaceFieldRegistry = {
      version: 1,
      fields: [
        {
          id: "widget.peak",
          canonicalPath: "widget.peak",
          stepId: "step",
          kind: "composite",
          required: false,
        },
      ],
    };
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "widget.peak", hidden: false }],
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["step"],
      inactiveFieldGroups: [],
      wizardCapacityStepRedundant: false,
    };
    const plan = buildPlan(registry, ruleSet, wizard);
    assert.equal(plan[0]?.fields[0]?.kind, "composite");
    assert.deepEqual(plan[0]?.fields[0]?.uiHints, { compositeId: "widget.peak" });
  });

  it("omits empty root steps from plan", () => {
    const registry: WorkspaceFieldRegistry = {
      version: 1,
      fields: [
        {
          id: "a.field",
          canonicalPath: "a.field",
          stepId: "step-a",
          kind: "text",
          required: true,
        },
      ],
    };
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "a.field", hidden: false }],
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["orphan-step", "step-a"],
      inactiveFieldGroups: [],
      wizardCapacityStepRedundant: false,
    };
    const plan = buildPlan(registry, ruleSet, wizard);
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.stepId, "step-a");
    assert.ok(!plan.some((step) => step.stepId === "orphan-step"));
  });

  it("includes canonicalPath on every plan row", () => {
    const plan = buildPlan(testStarterFieldRegistry(), testStarterRuleSet(), testStarterWizardSurface());
    for (const step of plan) {
      for (const field of step.fields) {
        assert.equal(field.canonicalPath, field.fieldId);
        assert.ok(field.canonicalPath.length > 0);
      }
    }
  });

  it("exposes wizardCapacityStepRedundant on step uiHints when enabled", () => {
    const wizard: WorkspaceWizardSurface = {
      ...testStarterWizardSurface(),
      wizardCapacityStepRedundant: true,
    };
    const plan = buildPlan(testStarterFieldRegistry(), testStarterRuleSet(), wizard, {
      includeWorkspaceStepUiHints: true,
    });
    assert.equal(plan[0]?.uiHints?.wizardCapacityStepRedundant, "true");
    assert.equal(plan[1]?.uiHints?.wizardCapacityStepRedundant, "true");
  });

  it("produces stable JSON snapshot for starter plan", () => {
    const plan = buildPlan(testStarterFieldRegistry(), testStarterRuleSet(), testStarterWizardSurface());
    assert.equal(JSON.stringify(plan), STARTER_PLAN_SNAPSHOT);
  });
});
