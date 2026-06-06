import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk/registry";

import { testRuleContext } from "../fixtures/rule-context.fixture.js";
import { PlatformCoreError } from "../../src/errors/platform-core.error.js";
import type { RuleEngineScope } from "../../src/engine/rule-engine.scope.js";
import { FieldRegistryEngine } from "../../src/engine/field-registry.engine.js";
import { RuleEngine } from "../../src/engine/rule.engine.js";
import { buildRuleContextScopeKey } from "../../src/utils/rule-context-scope-key.js";

const TENANT_A = "cache_poison_tenant_a";
const TENANT_B = "cache_poison_tenant_b";

const fieldRegistry: WorkspaceFieldRegistry = {
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

function buildCachePoisonRuleSet(extraVariantCells: number): WorkspaceRuleSet {
  const cells = [
    {
      cellId: "default",
      dimensions: { variant: "default" },
      fieldOverrides: [
        { fieldId: "field.a", required: true, hidden: false },
        { fieldId: "field.b", required: false, hidden: false },
      ],
    },
    {
      cellId: "poison",
      dimensions: { variant: "poison" },
      fieldOverrides: [
        { fieldId: "field.a", required: false, hidden: true },
        { fieldId: "field.b", required: true, hidden: true },
      ],
    },
    ...Array.from({ length: extraVariantCells }, (_, index) => ({
      cellId: `lru-filler-${index}`,
      dimensions: { variant: `lru-v-${index}` },
      fieldOverrides: [{ fieldId: "field.a", hidden: false }],
    })),
  ];
  return {
    version: 1,
    matrixDimensions: ["variant"],
    defaultCellId: "default",
    cells,
  };
}

type ScopeSnapshot = {
  readonly cellId: string;
  readonly fieldA: { readonly required: boolean; readonly hidden: boolean };
  readonly fieldB: { readonly required: boolean; readonly hidden: boolean };
};

function snapshotScope(scope: RuleEngineScope): ScopeSnapshot {
  const fieldA = scope.resolveEffectiveField("field.a");
  const fieldB = scope.resolveEffectiveField("field.b");
  return {
    cellId: scope.resolveCellId(),
    fieldA: { required: fieldA.required, hidden: fieldA.hidden },
    fieldB: { required: fieldB.required, hidden: fieldB.hidden },
  };
}

function makeEngine(extraVariantCells = 0): RuleEngine {
  return RuleEngine.create(
    buildCachePoisonRuleSet(extraVariantCells),
    FieldRegistryEngine.create(fieldRegistry)
  );
}

describe("1-reliability — rule engine scope cache poisoning", () => {
  it("isolates scope cache keys per tenant for identical matrix dimensions", () => {
    const dimensions = { variant: "default" };
    const keyA = buildRuleContextScopeKey(testRuleContext(dimensions, { tenantId: TENANT_A }), [
      "variant",
    ]);
    const keyB = buildRuleContextScopeKey(testRuleContext(dimensions, { tenantId: TENANT_B }), [
      "variant",
    ]);
    assert.match(keyA, new RegExp(`^t:${TENANT_A}\\0`));
    assert.match(keyB, new RegExp(`^t:${TENANT_B}\\0`));
    assert.notEqual(keyA, keyB);
  });

  it("does not return Tenant B cached scope on Tenant A cache hit after B malformed barrage", () => {
    const engine = makeEngine(65);
    const sharedDimensions = { variant: "default" };
    const ctxA = testRuleContext(sharedDimensions, { tenantId: TENANT_A });
    const ctxB = testRuleContext(sharedDimensions, { tenantId: TENANT_B });

    const scopeAInitial = engine.createScope(ctxA);
    const goldenA = snapshotScope(scopeAInitial);
    assert.equal(
      engine.createScope(ctxA),
      scopeAInitial,
      "Tenant A warm-cache miss on repeat context"
    );

    const scopeBInitial = engine.createScope(ctxB);
    const goldenB = snapshotScope(scopeBInitial);
    assert.notEqual(
      scopeAInitial,
      scopeBInitial,
      "identical dimensions must still yield distinct scope instances per tenant"
    );
    assert.deepEqual(
      goldenA,
      goldenB,
      "shared matrix dimensions must resolve identically per tenant"
    );

    const poisonAttempts: Array<() => void> = [
      () => {
        const scope = engine.createScope(
          testRuleContext({ variant: "poison" }, { tenantId: TENANT_B })
        );
        snapshotScope(scope);
      },
      () => {
        const scope = engine.createScope(
          testRuleContext({ variant: "__rule_context_unmatched__" }, { tenantId: TENANT_B })
        );
        assert.throws(() => scope.resolveCellId(), PlatformCoreError);
      },
      () => {
        assert.throws(
          () =>
            engine.createScope({
              tenantId: TENANT_B,
              dimensions: { variant: 42 as unknown as string },
            }),
          PlatformCoreError
        );
      },
      () => {
        assert.throws(
          () => engine.createScope(testRuleContext(sharedDimensions, { tenantId: "bad tenant!" })),
          PlatformCoreError
        );
      },
      () => {
        const scope = engine.createScope(
          testRuleContext({ variant: "e\u0301" }, { tenantId: TENANT_B })
        );
        assert.throws(
          () => scope.resolveCellId(),
          (error: unknown) => {
            assert.ok(error instanceof PlatformCoreError);
            assert.equal(error.code, "RULE_CONTEXT_UNMATCHED");
            return true;
          }
        );
      },
      () => {
        for (let i = 0; i < 65; i += 1) {
          engine.createScope(testRuleContext({ variant: `lru-v-${i}` }, { tenantId: TENANT_B }));
        }
      },
    ];

    for (let round = 0; round < 120; round += 1) {
      const scopeA = engine.createScope(ctxA);
      assert.equal(
        scopeA,
        scopeAInitial,
        `round ${round}: Tenant A cache hit returned a foreign scope instance`
      );
      assert.deepEqual(
        snapshotScope(scopeA),
        goldenA,
        `round ${round}: Tenant A effective state mutated`
      );

      const attack = poisonAttempts[round % poisonAttempts.length];
      attack();

      const scopeB = engine.createScope(ctxB);
      assert.notEqual(
        scopeB,
        scopeAInitial,
        `round ${round}: Tenant B scope aliased Tenant A cache entry`
      );
      assert.deepEqual(
        snapshotScope(scopeB),
        goldenB,
        `round ${round}: Tenant B baseline scope was corrupted`
      );
    }

    assert.deepEqual(snapshotScope(engine.createScope(ctxA)), goldenA);
    assert.equal(engine.createScope(ctxA), scopeAInitial);
  });

  it("rapid Tenant A validations interleaved with Tenant B malformed paths preserve Tenant A cache semantics", () => {
    const engine = makeEngine();
    const ctxA = testRuleContext({ variant: "default" }, { tenantId: TENANT_A });
    const scopeARef = engine.createScope(ctxA);
    const goldenA = snapshotScope(scopeARef);

    for (let i = 0; i < 300; i += 1) {
      const scopeA = engine.createScope(ctxA);
      assert.equal(scopeA, scopeARef);
      assert.deepEqual(snapshotScope(scopeA), goldenA);

      if (i % 3 === 0) {
        const unmatched = engine.createScope(
          testRuleContext({ variant: `missing-${i}` }, { tenantId: TENANT_B })
        );
        assert.throws(
          () => unmatched.resolveCellId(),
          (error: unknown) => {
            assert.ok(error instanceof PlatformCoreError);
            assert.equal(error.code, "RULE_CONTEXT_UNMATCHED");
            return true;
          }
        );
      } else if (i % 3 === 1) {
        const poisoned = engine.createScope(
          testRuleContext({ variant: "poison" }, { tenantId: TENANT_B })
        );
        assert.equal(poisoned.resolveCellId(), "poison");
        assert.equal(poisoned.resolveEffectiveField("field.a").hidden, true);
      } else {
        assert.throws(
          () =>
            engine.createScope({
              tenantId: TENANT_B,
              dimensions: ["not", "plain"] as unknown as Record<string, string>,
            }),
          (error: unknown) => {
            assert.ok(error instanceof PlatformCoreError);
            assert.equal(error.code, "INVALID_RULE_CONTEXT");
            return true;
          }
        );
      }
    }

    const scopeAFinal = engine.createScope(ctxA);
    assert.equal(scopeAFinal, scopeARef);
    assert.deepEqual(snapshotScope(scopeAFinal), goldenA);
  });

  it("LRU eviction in Tenant B partition does not repoint Tenant A cache hits", () => {
    const engine = makeEngine(65);
    const ctxA = testRuleContext({ variant: "default" }, { tenantId: TENANT_A });
    const scopeARef = engine.createScope(ctxA);
    const goldenA = snapshotScope(scopeARef);

    for (let i = 0; i < 65; i += 1) {
      engine.createScope(testRuleContext({ variant: `lru-v-${i}` }, { tenantId: TENANT_B }));
      const scopeA = engine.createScope(ctxA);
      assert.equal(scopeA, scopeARef);
      assert.deepEqual(snapshotScope(scopeA), goldenA);
    }
  });
});
