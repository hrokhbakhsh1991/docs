import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  WorkspaceFieldRegistry,
  WorkspaceRuleSet,
  WorkspaceWizardSurface,
} from "@app-tour/workspace-sdk";

import { testRuleContext } from "../__fixtures__/rule-context.fixture";
import {
  starterFieldRegistry,
  starterRuleSet,
  starterWizardSurface,
} from "../__fixtures__/starter.fixture";
import { FieldRegistryEngine } from "./field-registry.engine";
import { RuleEngine } from "./rule.engine";
import type { RuleEngineScope } from "./rule-engine.scope";
import { StepEngine } from "./step.engine";

const minimalRegistry: WorkspaceFieldRegistry = {
  version: 1,
  fields: [
    {
      id: "step.a.field",
      canonicalPath: "step.a.field",
      stepId: "step-a",
      kind: "text",
      required: true,
    },
    {
      id: "step.b.field",
      canonicalPath: "step.b.field",
      stepId: "step-b",
      kind: "text",
      required: false,
      groupSlug: "pricing",
    },
  ],
};

function makeStepEngine(
  registry: WorkspaceFieldRegistry,
  ruleSet: WorkspaceRuleSet,
  wizard: WorkspaceWizardSurface,
): { stepEngine: StepEngine; ruleEngine: RuleEngine } {
  const fieldEngine = new FieldRegistryEngine(registry);
  const ruleEngine = new RuleEngine(ruleSet, fieldEngine);
  return { stepEngine: new StepEngine(wizard, fieldEngine), ruleEngine };
}

function scopeFor(
  ruleEngine: RuleEngine,
  dimensions: Record<string, string>,
): RuleEngineScope {
  return ruleEngine.createScope(testRuleContext(dimensions));
}

describe("StepEngine", () => {
  it("listStepIds follows wizard.roots order when steps have registry fields", () => {
    const { stepEngine } = makeStepEngine(
      starterFieldRegistry,
      starterRuleSet,
      starterWizardSurface,
    );
    assert.deepEqual(stepEngine.listStepIds(), ["basics", "details"]);
  });

  it("listStepIds reorders registry insertion to match wizard.roots", () => {
    const registry: WorkspaceFieldRegistry = {
      version: 1,
      fields: [
        {
          id: "step.a.field",
          canonicalPath: "step.a.field",
          stepId: "step-a",
          kind: "text",
          required: true,
        },
        {
          id: "step.b.field",
          canonicalPath: "step.b.field",
          stepId: "step-b",
          kind: "text",
          required: false,
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["step-b", "step-a"],
      inactiveFieldGroups: [],
      wizardCapacityStepRedundant: false,
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
            { fieldId: "step.a.field", hidden: false },
            { fieldId: "step.b.field", hidden: false },
          ],
        },
      ],
    };
    const { stepEngine } = makeStepEngine(registry, ruleSet, wizard);
    assert.deepEqual(stepEngine.listStepIds(), ["step-b", "step-a"]);
  });

  it("marks step hidden when all fields are hidden by rule overrides", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "step.a.field", hidden: true }],
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["step-a"],
      inactiveFieldGroups: [],
      wizardCapacityStepRedundant: false,
    };
    const { stepEngine, ruleEngine } = makeStepEngine(minimalRegistry, ruleSet, wizard);
    assert.equal(
      stepEngine.getStepVisibility("step-a", scopeFor(ruleEngine, { variant: "default" })),
      "hidden",
    );
  });

  it("inactiveFieldGroups hides step when all fields belong to inactive group", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "step.b.field", hidden: false }],
        },
      ],
    };
    const wizard: WorkspaceWizardSurface = {
      wizardMode: "classic",
      railId: "test",
      roots: ["step-b"],
      inactiveFieldGroups: ["pricing"],
      wizardCapacityStepRedundant: false,
    };
    const { stepEngine, ruleEngine } = makeStepEngine(minimalRegistry, ruleSet, wizard);
    assert.equal(
      stepEngine.getStepVisibility("step-b", scopeFor(ruleEngine, { variant: "default" })),
      "hidden",
    );
  });

  it("returns empty visibility for root step with no registry fields", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [],
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
    const { stepEngine, ruleEngine } = makeStepEngine(minimalRegistry, ruleSet, wizard);
    assert.equal(
      stepEngine.getStepVisibility(
        "orphan-step",
        scopeFor(ruleEngine, { variant: "default" }),
      ),
      "empty",
    );
    assert.deepEqual(stepEngine.listStepIds(), ["orphan-step", "step-a", "step-b"]);
  });

  it("integrates with starter plugin — listActiveSteps includes basics and details", () => {
    const { stepEngine, ruleEngine } = makeStepEngine(
      starterFieldRegistry,
      starterRuleSet,
      starterWizardSurface,
    );
    assert.deepEqual(
      stepEngine.listActiveSteps(scopeFor(ruleEngine, { variant: "default" })),
      ["basics", "details"],
    );
  });
});
