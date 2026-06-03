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
import { RuleEngine } from "../../../src/engine/rule.engine.js";
import type { RuleEngineScope } from "../../../src/engine/rule-engine.scope.js";
import {
  getStepVisibility,
  listActiveSteps,
  listStepIds,
} from "../../../src/engine/render-plan.steps.js";

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

function makeStepContext(
  registry: WorkspaceFieldRegistry,
  ruleSet: WorkspaceRuleSet,
  wizard: WorkspaceWizardSurface,
): { wizard: WorkspaceWizardSurface; fieldEngine: FieldRegistryEngine; ruleEngine: RuleEngine } {
  const fieldEngine = FieldRegistryEngine.create(registry);
  const ruleEngine = RuleEngine.create(ruleSet, fieldEngine);
  return { wizard, fieldEngine, ruleEngine };
}

function scopeFor(
  ruleEngine: RuleEngine,
  dimensions: Record<string, string>,
): RuleEngineScope {
  return ruleEngine.createScope(testRuleContext(dimensions));
}

describe("render-plan steps", () => {
  it("listStepIds follows wizard.roots order when steps have registry fields", () => {
    const { wizard, fieldEngine } = makeStepContext(
      testStarterFieldRegistry(),
      testStarterRuleSet(),
      testStarterWizardSurface(),
    );
    assert.deepEqual(listStepIds(wizard, fieldEngine), ["basics", "details"]);
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
    const { wizard: w, fieldEngine } = makeStepContext(registry, ruleSet, wizard);
    assert.deepEqual(listStepIds(w, fieldEngine), ["step-b", "step-a"]);
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
    const { wizard: w, fieldEngine, ruleEngine } = makeStepContext(minimalRegistry, ruleSet, wizard);
    assert.equal(
      getStepVisibility(w, fieldEngine, "step-a", scopeFor(ruleEngine, { variant: "default" })),
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
    const { wizard: w, fieldEngine, ruleEngine } = makeStepContext(minimalRegistry, ruleSet, wizard);
    assert.equal(
      getStepVisibility(w, fieldEngine, "step-b", scopeFor(ruleEngine, { variant: "default" })),
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
    const { wizard: w, fieldEngine, ruleEngine } = makeStepContext(minimalRegistry, ruleSet, wizard);
    assert.equal(
      getStepVisibility(w, fieldEngine, "orphan-step", scopeFor(ruleEngine, { variant: "default" })),
      "empty",
    );
    assert.deepEqual(listStepIds(w, fieldEngine), ["orphan-step", "step-a", "step-b"]);
  });

  it("integrates with starter plugin — listActiveSteps includes basics and details", () => {
    const { wizard, fieldEngine, ruleEngine } = makeStepContext(
      testStarterFieldRegistry(),
      testStarterRuleSet(),
      testStarterWizardSurface(),
    );
    assert.deepEqual(
      listActiveSteps(wizard, fieldEngine, scopeFor(ruleEngine, { variant: "default" })),
      ["basics", "details"],
    );
  });
});
