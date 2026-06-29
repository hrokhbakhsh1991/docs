import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk/registry";

import { FieldRegistryEngine } from "../../../src/engine/field-registry.engine.js";
import { RuleEngine } from "../../../src/engine/rule.engine.js";
import { adaptWorkspaceRuleSetToFieldPolicy } from "../../../src/field-policy/adapters/workspace-rule-set-to-policy.js";
import { resolveFieldState } from "../../../src/field-policy/resolve-field-state.js";
import { testStarterFieldRegistry, testStarterRuleSet } from "../../fixtures/starter.fixture";

function stateFromRuleEngine(input: {
  readonly registry: WorkspaceFieldRegistry;
  readonly ruleSet: WorkspaceRuleSet;
  readonly variant: string;
}) {
  const fieldEngine = FieldRegistryEngine.create(input.registry);
  const ruleEngine = RuleEngine.create(input.ruleSet, fieldEngine);
  const scope = ruleEngine.createScope({
    tenantId: "tenant-1",
    dimensions: { variant: input.variant },
  });

  return input.registry.fields
    .map((field) => {
      const effective = scope.resolveEffectiveField(field.id);
      return {
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        state: effective.hidden ? "hidden" : effective.required ? "required" : "visible",
      };
    })
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

describe("adaptWorkspaceRuleSetToFieldPolicy", () => {
  it("maps starter field registry entries to field definitions", () => {
    const registry = testStarterFieldRegistry();
    const result = adaptWorkspaceRuleSetToFieldPolicy({
      workspaceType: "starter",
      fieldRegistry: registry,
      ruleSet: testStarterRuleSet(),
    });

    assert.equal(result.definitions.length, registry.fields.length);
    assert.deepEqual(
      result.definitions.find((definition) => definition.id === "details.status")?.validation,
      { enumOptions: ["draft", "open", "published"] },
    );
  });

  it("matches starter RuleEngine effective state for supported cells", () => {
    const registry = testStarterFieldRegistry();
    const ruleSet = testStarterRuleSet();
    const result = adaptWorkspaceRuleSetToFieldPolicy({
      workspaceType: "starter",
      fieldRegistry: registry,
      ruleSet,
    });

    assert.deepEqual(result.unsupportedCells, []);

    for (const variant of ["default", "basic"]) {
      const resolved = resolveFieldState({
        tenantId: "tenant-1",
        workspaceType: "starter",
        surface: "wizard",
        entityState: { dimensions: { variant } },
        definitions: result.definitions,
        rules: result.rules,
      }).map(({ fieldId, canonicalPath, state }) => ({ fieldId, canonicalPath, state }));

      assert.deepEqual(
        resolved,
        stateFromRuleEngine({
          registry,
          ruleSet,
          variant,
        }),
      );
    }
  });

  it("reports multi-dimension cells instead of expanding the condition DSL", () => {
    const registry: WorkspaceFieldRegistry = {
      version: 1,
      fields: [
        {
          id: "title",
          canonicalPath: "title",
          stepId: "basics",
          kind: "text",
          required: false,
        },
      ],
    };
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant", "audience"],
      defaultCellId: "complex",
      cells: [
        {
          cellId: "complex",
          dimensions: { variant: "default", audience: "public" },
          fieldOverrides: [{ fieldId: "title", hidden: false }],
        },
      ],
    };

    const result = adaptWorkspaceRuleSetToFieldPolicy({
      workspaceType: "starter",
      fieldRegistry: registry,
      ruleSet,
    });

    assert.deepEqual(result.rules, []);
    assert.deepEqual(result.unsupportedCells, [
      {
        cellId: "complex",
        reason: "MULTI_DIMENSION_CONDITION_UNSUPPORTED",
        dimensions: { variant: "default", audience: "public" },
      },
    ]);
  });
});
