import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  WorkspaceFieldRegistry,
  WorkspaceRuleSet,
  WorkspaceWizardSurface,
} from "@app-tour/workspace-sdk";

import {
  starterFieldRegistry,
  starterRuleSet,
  starterWizardSurface,
} from "../__fixtures__/starter.fixture";
import { FieldRegistryEngine } from "./field-registry.engine";
import { RenderPlanBuilder } from "./render-plan.builder";
import { RuleEngine } from "./rule.engine";

const STARTER_PLAN_SNAPSHOT = JSON.stringify([
  {
    stepId: "basics",
    fields: [
      {
        fieldId: "basics.title",
        kind: "text",
        canonicalPath: "basics.title",
        required: true,
        hidden: false,
        stepId: "basics",
      },
    ],
  },
  {
    stepId: "details",
    fields: [
      {
        fieldId: "details.summary",
        kind: "text",
        canonicalPath: "details.summary",
        required: false,
        hidden: false,
        stepId: "details",
      },
    ],
  },
]);

function makeBuilder(
  registry: WorkspaceFieldRegistry,
  ruleSet: WorkspaceRuleSet,
  wizard: WorkspaceWizardSurface,
): RenderPlanBuilder {
  const fieldEngine = new FieldRegistryEngine(registry);
  const ruleEngine = new RuleEngine(ruleSet, fieldEngine);
  return new RenderPlanBuilder(wizard, fieldEngine, ruleEngine);
}

describe("RenderPlanBuilder", () => {
  it("builds full plan for starter plugin", () => {
    const builder = makeBuilder(
      starterFieldRegistry,
      starterRuleSet,
      starterWizardSurface,
    );
    const plan = builder.build({ dimensions: { variant: "default" } });
    assert.equal(plan.length, 2);
    assert.equal(plan[0]?.stepId, "basics");
    assert.equal(plan[0]?.fields.length, 1);
    assert.equal(plan[1]?.stepId, "details");
    assert.equal(plan[1]?.fields.length, 1);
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
    const plan = makeBuilder(registry, ruleSet, wizard).build({
      dimensions: { variant: "default" },
    });
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
    const plan = makeBuilder(registry, ruleSet, wizard).build({
      dimensions: { variant: "default" },
    });
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
    const plan = makeBuilder(registry, ruleSet, wizard).build({
      dimensions: { variant: "default" },
    });
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.stepId, "step-a");
    assert.ok(!plan.some((step) => step.stepId === "orphan-step"));
  });

  it("includes canonicalPath on every plan row", () => {
    const builder = makeBuilder(
      starterFieldRegistry,
      starterRuleSet,
      starterWizardSurface,
    );
    const plan = builder.build({ dimensions: { variant: "default" } });
    for (const step of plan) {
      for (const field of step.fields) {
        assert.equal(field.canonicalPath, field.fieldId);
        assert.ok(field.canonicalPath.length > 0);
      }
    }
  });

  it("exposes wizardCapacityStepRedundant on step uiHints when enabled", () => {
    const wizard: WorkspaceWizardSurface = {
      ...starterWizardSurface,
      wizardCapacityStepRedundant: true,
    };
    const builder = makeBuilder(starterFieldRegistry, starterRuleSet, wizard);
    const plan = builder.build({ dimensions: { variant: "default" } });
    assert.equal(plan[0]?.uiHints?.wizardCapacityStepRedundant, "true");
    assert.equal(plan[1]?.uiHints?.wizardCapacityStepRedundant, "true");
  });

  it("produces stable JSON snapshot for starter plan", () => {
    const builder = makeBuilder(
      starterFieldRegistry,
      starterRuleSet,
      starterWizardSurface,
    );
    const plan = builder.build({ dimensions: { variant: "default" } });
    assert.equal(JSON.stringify(plan), STARTER_PLAN_SNAPSHOT);
  });
});
