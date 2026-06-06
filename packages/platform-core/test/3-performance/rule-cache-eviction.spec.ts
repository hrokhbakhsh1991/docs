import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk/registry";

import { testRuleContext } from "../fixtures/rule-context.fixture.js";
import { FieldRegistryEngine } from "../../src/engine/field-registry.engine.js";
import type { RuleEngineScope } from "../../src/engine/rule-engine.scope.js";
import { RuleEngine } from "../../src/engine/rule.engine.js";

/** Mirrors `MAX_SCOPE_CACHE_SIZE` in `rule.engine.ts` — inner LRU cap per tenant. */
const MAX_INNER_SCOPE_CACHE = 64;

/** Mirrors default `MAX_TENANT_PARTITIONS` in `rule.engine.ts` — outer LRU cap. */
const MAX_TENANT_PARTITIONS = 128;

/** Tenants beyond outer cap to force eviction of the first partition. */
const TENANTS_OVER_CAP = MAX_TENANT_PARTITIONS + 8;

/** Soft heap budget for capped tenant partitions (MB). */
const HEAP_BUDGET_MB = 24;

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
  ],
};

function buildEvictionRuleSet(extraVariantCells: number): WorkspaceRuleSet {
  const cells = [
    {
      cellId: "victim",
      dimensions: { variant: "victim" },
      fieldOverrides: [{ fieldId: "field.a", required: true, hidden: false }],
    },
    {
      cellId: "recent",
      dimensions: { variant: "recent" },
      fieldOverrides: [{ fieldId: "field.a", required: false, hidden: false }],
    },
    ...Array.from({ length: extraVariantCells }, (_, index) => ({
      cellId: `fill-${index}`,
      dimensions: { variant: `fill-${index}` },
      fieldOverrides: [{ fieldId: "field.a", hidden: false }],
    })),
  ];
  return {
    version: 1,
    matrixDimensions: ["variant"],
    defaultCellId: "victim",
    cells,
  };
}

function makeEngine(extraVariantCells = MAX_INNER_SCOPE_CACHE + 8): RuleEngine {
  return RuleEngine.create(
    buildEvictionRuleSet(extraVariantCells),
    FieldRegistryEngine.create(fieldRegistry)
  );
}

function tenantId(index: number): string {
  return `cache_evict_t_${index.toString().padStart(4, "0")}`;
}

describe("3-performance — rule engine scope cache eviction", () => {
  it("evicts the oldest scope within one tenant when a 65th distinct scope is cached", () => {
    const engine = makeEngine();
    const tenant = "inner_lru_tenant";
    const ctxVictim = testRuleContext({ variant: "victim" }, { tenantId: tenant });
    const victimRef = engine.createScope(ctxVictim);

    for (let i = 0; i < MAX_INNER_SCOPE_CACHE; i += 1) {
      engine.createScope(testRuleContext({ variant: `fill-${i}` }, { tenantId: tenant }));
    }

    const victimAgain = engine.createScope(ctxVictim);
    assert.notEqual(
      victimAgain,
      victimRef,
      "oldest scope must be evicted from the per-tenant inner LRU at 64 entries"
    );
    assert.equal(victimAgain.resolveCellId(), "victim");
  });

  it("promotes recently used scopes so they survive inner-LRU eviction", () => {
    const engine = makeEngine();
    const tenant = "inner_lru_touch_tenant";
    const ctxPinned = testRuleContext({ variant: "victim" }, { tenantId: tenant });
    const pinnedRef = engine.createScope(ctxPinned);

    for (let i = 0; i < MAX_INNER_SCOPE_CACHE - 1; i += 1) {
      engine.createScope(testRuleContext({ variant: `fill-${i}` }, { tenantId: tenant }));
    }
    // Inner cache full: victim (LRU) + fill-0..fill-62.

    assert.equal(
      engine.createScope(ctxPinned),
      pinnedRef,
      "cache hit must promote victim to MRU before overflow insert"
    );

    const ctxOverflow = testRuleContext({ variant: "fill-63" }, { tenantId: tenant });
    engine.createScope(ctxOverflow);

    assert.equal(
      engine.createScope(ctxPinned),
      pinnedRef,
      "touched scope must remain cached while the coldest entry is evicted"
    );
  });

  it("evicts the oldest tenant partition when outer LRU exceeds MAX_TENANT_PARTITIONS", () => {
    const engine = makeEngine(0);
    const firstTenant = tenantId(0);
    const firstCtx = testRuleContext({ variant: "victim" }, { tenantId: firstTenant });
    const firstRef = engine.createScope(firstCtx);

    for (let i = 1; i < TENANTS_OVER_CAP; i += 1) {
      engine.createScope(testRuleContext({ variant: "victim" }, { tenantId: tenantId(i) }));
    }

    const firstAgain = engine.createScope(firstCtx);
    assert.notEqual(
      firstAgain,
      firstRef,
      `tenant ${firstTenant} partition must be evicted after ${TENANTS_OVER_CAP} distinct tenants`
    );
    assert.equal(firstAgain.resolveCellId(), "victim");
  });

  it("keeps per-tenant inner LRU isolated when many tenants each hold one scope", () => {
    const engine = makeEngine(MAX_INNER_SCOPE_CACHE + 4);
    const pressureTenant = "inner_lru_under_load";
    const stableTenant = tenantId(MAX_TENANT_PARTITIONS - 1);

    for (let i = 0; i < MAX_TENANT_PARTITIONS - 1; i += 1) {
      engine.createScope(testRuleContext({ variant: "victim" }, { tenantId: tenantId(i) }));
    }

    const stableCtx = testRuleContext({ variant: "victim" }, { tenantId: stableTenant });
    const stableRef = engine.createScope(stableCtx);

    const pressureVictimCtx = testRuleContext({ variant: "victim" }, { tenantId: pressureTenant });
    const pressureVictimRef = engine.createScope(pressureVictimCtx);
    for (let i = 0; i < MAX_INNER_SCOPE_CACHE; i += 1) {
      engine.createScope(testRuleContext({ variant: `fill-${i}` }, { tenantId: pressureTenant }));
    }
    assert.notEqual(
      engine.createScope(pressureVictimCtx),
      pressureVictimRef,
      "pressure tenant inner LRU must evict locally"
    );

    const stableAfter = engine.createScope(stableCtx);
    assert.equal(
      stableAfter,
      stableRef,
      "stable tenant scope must survive another tenant's inner-LRU churn"
    );
  });

  it("adds bounded heap when filling outer tenant LRU to cap (scope-count proxy)", () => {
    if (globalThis.gc) {
      globalThis.gc();
    }
    const heapBefore = process.memoryUsage().heapUsed;
    const engine = makeEngine(0);
    const refs: RuleEngineScope[] = [];

    for (let i = 0; i < MAX_TENANT_PARTITIONS; i += 1) {
      refs.push(
        engine.createScope(testRuleContext({ variant: "victim" }, { tenantId: tenantId(i) }))
      );
    }

    for (let i = 0; i < MAX_TENANT_PARTITIONS; i += 1) {
      assert.equal(
        engine.createScope(testRuleContext({ variant: "victim" }, { tenantId: tenantId(i) })),
        refs[i]
      );
    }

    const heapAfter = process.memoryUsage().heapUsed;
    const deltaMb = (heapAfter - heapBefore) / (1024 * 1024);
    assert.ok(
      deltaMb < HEAP_BUDGET_MB,
      `heap grew ${deltaMb.toFixed(2)} MB for ${MAX_TENANT_PARTITIONS} tenants — exceeds ${HEAP_BUDGET_MB} MB budget`
    );
  });
});
