import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import {
  starterFieldRegistry,
  starterRuleSet,
} from "../__fixtures__/starter.fixture";
import { PlatformCoreError } from "../errors/platform-core.error";
import type { RuleContext } from "../types/rule-context";
import { FieldRegistryEngine } from "./field-registry.engine";
import { RuleEngine } from "./rule.engine";

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
    {
      id: "field.b",
      canonicalPath: "field.b",
      stepId: "step",
      kind: "text",
      required: false,
    },
  ],
};

function makeEngine(
  registry: WorkspaceFieldRegistry,
  ruleSet: WorkspaceRuleSet,
): RuleEngine {
  return new RuleEngine(ruleSet, new FieldRegistryEngine(registry));
}

describe("RuleEngine", () => {
  it("throws INVALID_RULE_SET when ruleSet.cells exceeds rule cell index limit", () => {
    const cells = Array.from({ length: 257 }, (_, index) => ({
      cellId: `cell-${index}`,
      dimensions: { variant: `v-${index}` },
      fieldOverrides: [{ fieldId: "field.a", hidden: false }],
    }));
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "cell-0",
      cells,
    };
    assert.throws(
      () => makeEngine(minimalRegistry, ruleSet),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        assert.equal(error.details?.cellCount, 257);
        return true;
      },
    );
  });

  it("throws RULE_CONTEXT_UNMATCHED when no dimension match", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "premium",
          dimensions: { variant: "premium" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    assert.throws(
      () => engine.resolveCellId({ dimensions: { variant: "other" } }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "RULE_CONTEXT_UNMATCHED");
        assert.deepEqual(error.details?.defaultCellId, "default");
        return true;
      },
    );
  });

  it("resolves exact dimension match to matching cell", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    assert.equal(
      engine.resolveCellId({ dimensions: { variant: "default" } }),
      "default",
    );
  });

  it("override can set required to false on required base field", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", required: false, hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    const state = engine.resolveEffectiveField("field.a", {
      dimensions: { variant: "default" },
    });
    assert.equal(state.required, false);
  });

  it("hidden fields are excluded from listEffectiveFields", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [
            { fieldId: "field.a", hidden: true },
            { fieldId: "field.b", hidden: false },
          ],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    const visible = engine.listEffectiveFields({ dimensions: { variant: "default" } });
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.fieldId, "field.b");
  });

  it("constructor throws UNKNOWN_FIELD_ID for orphan override fieldId", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "orphan.id", hidden: false }],
        },
      ],
    };
    assert.throws(
      () => makeEngine(minimalRegistry, ruleSet),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "UNKNOWN_FIELD_ID");
        return true;
      },
    );
  });

  it("prefers specific dimension match over catch-all cell", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "fallback",
      cells: [
        {
          cellId: "catch-all",
          dimensions: {},
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "premium",
          dimensions: { variant: "premium" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "fallback",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    assert.equal(
      engine.resolveCellId({ dimensions: { variant: "premium" } }),
      "premium",
    );
  });

  it("prefers more matched context keys over higher priority on fewer keys", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant", "tier"],
      defaultCellId: "fallback",
      cells: [
        {
          cellId: "catch-all",
          dimensions: {},
          priority: 100,
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "partial",
          dimensions: { variant: "premium" },
          priority: 1,
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "full",
          dimensions: { variant: "premium", tier: "gold" },
          priority: 1,
          fieldOverrides: [{ fieldId: "field.a", required: false, hidden: false }],
        },
        {
          cellId: "fallback",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    assert.equal(
      engine.resolveCellId({ dimensions: { variant: "premium", tier: "gold" } }),
      "full",
    );
  });

  it("prefers specificity over priority when partial cell matches", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "fallback",
      cells: [
        {
          cellId: "catch-all",
          dimensions: {},
          priority: 100,
          fieldOverrides: [{ fieldId: "field.a", required: true, hidden: false }],
        },
        {
          cellId: "premium",
          dimensions: { variant: "premium" },
          priority: 1,
          fieldOverrides: [{ fieldId: "field.a", required: false, hidden: false }],
        },
        {
          cellId: "fallback",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    assert.equal(
      engine.resolveCellId({ dimensions: { variant: "premium" } }),
      "premium",
    );
    const state = engine.resolveEffectiveField("field.a", {
      dimensions: { variant: "premium" },
    });
    assert.equal(state.required, false);
  });

  it("prefers higher priority when multiple catch-all cells match", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "fallback",
      cells: [
        {
          cellId: "low-priority-catch-all",
          dimensions: {},
          priority: 1,
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "high-priority-catch-all",
          dimensions: {},
          priority: 10,
          fieldOverrides: [{ fieldId: "field.a", required: false, hidden: false }],
        },
        {
          cellId: "fallback",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    assert.equal(engine.resolveCellId({ dimensions: { variant: "premium" } }), "high-priority-catch-all");
    const state = engine.resolveEffectiveField("field.a", {
      dimensions: { variant: "premium" },
    });
    assert.equal(state.required, false);
  });

  it("throws AMBIGUOUS_RULE_RESOLUTION when priority and specificity tie", () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "fallback",
      cells: [
        {
          cellId: "z-last",
          dimensions: { variant: "x" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "a-first",
          dimensions: { variant: "x" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
        {
          cellId: "fallback",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", hidden: false }],
        },
      ],
    };
    const engine = makeEngine(minimalRegistry, ruleSet);
    assert.throws(
      () => engine.resolveCellId({ dimensions: { variant: "x" } }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "AMBIGUOUS_RULE_RESOLUTION");
        assert.deepEqual(error.details?.tiedCellIds, ["z-last", "a-first"]);
        return true;
      },
    );
  });

  it("throws RULE_CONTEXT_UNMATCHED for empty dimensions without catch-all cell", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    assert.throws(
      () => engine.resolveCellId({ dimensions: {} }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "RULE_CONTEXT_UNMATCHED");
        return true;
      },
    );
  });

  it("throws INVALID_RULE_CONTEXT for dimension keys outside matrixDimensions", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    assert.throws(
      () =>
        engine.resolveCellId({
          dimensions: { variant: "default", attack_dim_0: "x" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_CONTEXT");
        return true;
      },
    );
  });

  it("throws RULE_CONTEXT_UNMATCHED when null dimensions coerce to empty object", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    assert.throws(
      () =>
        engine.resolveCellId({ dimensions: null } as unknown as RuleContext),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "RULE_CONTEXT_UNMATCHED");
        return true;
      },
    );
  });

  it("integrates with starter plugin registry and ruleSet", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    const fields = engine.listEffectiveFields({ dimensions: { variant: "default" } });
    assert.equal(fields.length, 2);
    const title = fields.find((f) => f.fieldId === "basics.title");
    assert.ok(title);
    assert.equal(title.required, true);
    assert.equal(title.hidden, false);
  });

  it("forceCellId returns requested cell when valid", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    assert.equal(
      engine.resolveCellId({
        dimensions: { variant: "other" },
        forceCellId: "default",
      }),
      "default",
    );
  });

  it("forceCellId throws INVALID_RULE_CONTEXT outside test NODE_ENV", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const engine = makeEngine(starterFieldRegistry, starterRuleSet);
      assert.throws(
        () =>
          engine.resolveCellId({
            dimensions: { variant: "default" },
            forceCellId: "default",
          }),
        (error: unknown) => {
          assert.ok(error instanceof PlatformCoreError);
          assert.equal(error.code, "INVALID_RULE_CONTEXT");
          return true;
        },
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("forceCellId throws INVALID_RULE_SET when cell missing", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    assert.throws(
      () =>
        engine.resolveCellId({
          dimensions: { variant: "default" },
          forceCellId: "missing",
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      },
    );
  });

  it("reuses RuleEngineScope for repeated calls with the same context", () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    const context: RuleContext = { dimensions: { variant: "default" } };
    const scopeA = engine.createScope(context);
    const scopeB = engine.createScope(context);
    assert.equal(scopeA, scopeB);
    assert.equal(engine.resolveCellId(context), "default");
    assert.equal(scopeA.resolveCellId(), "default");
  });
});
