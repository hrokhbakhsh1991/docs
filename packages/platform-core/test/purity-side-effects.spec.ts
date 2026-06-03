import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk/registry";

import { testRuleContext } from "./fixtures/rule-context.fixture.js";
import { FieldRegistryEngine } from "../src/engine/field-registry.engine.js";
import { RuleEngine } from "../src/engine/rule.engine.js";

const minimalRegistry: WorkspaceFieldRegistry = {
  version: 1,
  fields: [
    {
      id: "field.a",
      canonicalPath: "field.a",
      stepId: "step",
      kind: "text",
      required: true,
    },
  ],
};

function ruleSetWithVariants(count: number): WorkspaceRuleSet {
  const cells = [
    ...Array.from({ length: count }, (_, index) => ({
      cellId: `cell-${index}`,
      dimensions: { variant: `v-${index}` },
      fieldOverrides: [{ fieldId: "field.a", hidden: false }],
    })),
    {
      cellId: "default",
      dimensions: { variant: "default" },
      fieldOverrides: [{ fieldId: "field.a", hidden: false }],
    },
  ];
  return {
    version: 1,
    matrixDimensions: ["variant"],
    defaultCellId: "default",
    cells,
  };
}

describe("RuleEngine scope cache side effects (documented instance state)", () => {
  it("grows per-tenant scope cache under repeated createScope with distinct dimension keys", () => {
    const engine = RuleEngine.create(
      ruleSetWithVariants(8),
      FieldRegistryEngine.create(minimalRegistry),
    );
    const tenantId = "purity-tenant-a";

    for (let i = 0; i < 8; i += 1) {
      const scope = engine.createScope(
        testRuleContext({ variant: `v-${i}` }, { tenantId }),
      );
      assert.equal(scope.resolveCellId(), `cell-${i}`);
    }

    const repeat = engine.createScope(testRuleContext({ variant: "v-0" }, { tenantId }));
    assert.equal(repeat.resolveCellId(), "cell-0");
  });

  it("LRU evicts oldest tenant_A scopes without corrupting tenant_B resolution", () => {
    const engine = RuleEngine.create(
      ruleSetWithVariants(65),
      FieldRegistryEngine.create(minimalRegistry),
    );

    const tenantBContext = testRuleContext({ variant: "default" }, { tenantId: "tenant_b" });
    const tenantBBefore = engine.createScope(tenantBContext);

    for (let i = 0; i < 65; i += 1) {
      engine.createScope(testRuleContext({ variant: `v-${i}` }, { tenantId: "tenant_a" }));
    }

    const tenantBAfter = engine.createScope(tenantBContext);
    assert.equal(tenantBBefore.resolveCellId(), tenantBAfter.resolveCellId());
    assert.deepEqual(
      tenantBBefore.resolveEffectiveField("field.a"),
      tenantBAfter.resolveEffectiveField("field.a"),
    );
  });
});
