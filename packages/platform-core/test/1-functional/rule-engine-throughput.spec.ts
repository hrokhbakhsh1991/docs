import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { testRuleContext } from "../fixtures/rule-context.fixture.js";
import { createTestStarterPlugin } from "../fixtures/starter.fixture.js";
import { PlatformCoreError } from "../../src/errors/platform-core.error.js";
import { FieldRegistryEngine } from "../../src/engine/field-registry.engine.js";
import { RuleEngine } from "../../src/engine/rule.engine.js";
import type { RuleEngineScope } from "../../src/engine/rule-engine.scope.js";
import { validateCanonicalDocument } from "../../src/engine/validate-canonical-document.js";
import { buildRuleContextScopeKey } from "../../src/utils/rule-context-scope-key.js";

const TENANT_A = "throughput_tenant_a";
const TENANT_B = "throughput_tenant_b";
const BURST_TASK_COUNT = 320;
const BURST_TIMEOUT_MS = 30_000;

const VALID_TOUR = createCanonicalDocument({
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: { title: "Throughput golden tour" },
    details: { summary: "Isolation baseline summary" },
  },
});

const INCOMPLETE_TOUR = createCanonicalDocument({
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: {},
    details: { summary: "Missing title" },
  },
});

function buildThroughputPlugin(lruFillerCells = 32): WorkspacePlugin {
  const starter = createTestStarterPlugin();
  return {
    ...starter,
    ruleSet: {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "basics.title", required: true, hidden: false }],
        },
        {
          cellId: "alt",
          dimensions: { variant: "alt" },
          fieldOverrides: [{ fieldId: "basics.title", required: false, hidden: false }],
        },
        {
          cellId: "stress",
          dimensions: { variant: "stress" },
          fieldOverrides: [{ fieldId: "basics.title", required: true, hidden: true }],
        },
        ...Array.from({ length: lruFillerCells }, (_, index) => ({
          cellId: `lru-${index}`,
          dimensions: { variant: `lru-v-${index}` },
          fieldOverrides: [{ fieldId: "basics.title", required: false, hidden: false }],
        })),
      ],
    },
  };
}

type ScopeSnapshot = {
  readonly cellId: string;
  readonly title: { readonly required: boolean; readonly hidden: boolean };
  readonly summary: { readonly required: boolean; readonly hidden: boolean };
};

function snapshotScope(scope: RuleEngineScope): ScopeSnapshot {
  const title = scope.resolveEffectiveField("basics.title");
  const summary = scope.resolveEffectiveField("details.summary");
  return {
    cellId: scope.resolveCellId(),
    title: { required: title.required, hidden: title.hidden },
    summary: { required: summary.required, hidden: summary.hidden },
  };
}

function makeRuntime(lruFillerCells = 32) {
  const plugin = buildThroughputPlugin(lruFillerCells);
  const fieldEngine = FieldRegistryEngine.create(plugin.fieldRegistry);
  const ruleEngine = RuleEngine.create(plugin.ruleSet, fieldEngine);
  return { plugin, fieldEngine, ruleEngine };
}

type TenantABurstRow = {
  readonly tenant: "A";
  readonly validationOk: boolean;
  readonly scope: ScopeSnapshot;
};

type TenantBBurstRow = {
  readonly tenant: "B";
  readonly kind: string;
};

type BurstRow = TenantABurstRow | TenantBBurstRow;

describe("1-functional — rule engine throughput + tenant isolation", () => {
  it("isolates scope cache keys per tenant before burst", () => {
    const { plugin } = makeRuntime();
    const dimensions = { variant: "default" };
    const keyA = buildRuleContextScopeKey(
      testRuleContext(dimensions, { tenantId: TENANT_A }),
      plugin.ruleSet.matrixDimensions
    );
    const keyB = buildRuleContextScopeKey(
      testRuleContext(dimensions, { tenantId: TENANT_B }),
      plugin.ruleSet.matrixDimensions
    );
    assert.match(keyA, new RegExp(`^t:${TENANT_A}\\0`));
    assert.match(keyB, new RegExp(`^t:${TENANT_B}\\0`));
    assert.notEqual(keyA, keyB);
  });

  it(
    "preserves Tenant A validation golden and scope state under concurrent A/B burst",
    { timeout: BURST_TIMEOUT_MS },
    async () => {
      const { plugin, fieldEngine, ruleEngine } = makeRuntime();
      const ctxA = testRuleContext({ variant: "default" }, { tenantId: TENANT_A });

      const baselineValidation = validateCanonicalDocument({
        plugin,
        fieldEngine,
        ruleEngine,
        document: VALID_TOUR,
        context: ctxA,
      });
      assert.equal(baselineValidation.ok, true, "Tenant A baseline validation must pass");
      assert.equal(baselineValidation.violations.length, 0);

      const scopeARef = ruleEngine.createScope(ctxA);
      const goldenScope = snapshotScope(scopeARef);
      assert.equal(goldenScope.cellId, "default");
      assert.equal(goldenScope.title.required, true);
      assert.equal(goldenScope.title.hidden, false);

      const tasks = Array.from({ length: BURST_TASK_COUNT }, (_, index) => {
        const isTenantA = index % 2 === 0;
        return Promise.resolve().then((): BurstRow => {
          if (isTenantA) {
            const validation = validateCanonicalDocument({
              plugin,
              fieldEngine,
              ruleEngine,
              document: VALID_TOUR,
              context: ctxA,
            });
            const scope = ruleEngine.createScope(ctxA);
            return {
              tenant: "A",
              validationOk: validation.ok,
              scope: snapshotScope(scope),
            };
          }

          const stressKind = index % 8;
          switch (stressKind) {
            case 0: {
              const ctxBAlt = testRuleContext({ variant: "alt" }, { tenantId: TENANT_B });
              const validation = validateCanonicalDocument({
                plugin,
                fieldEngine,
                ruleEngine,
                document: INCOMPLETE_TOUR,
                context: ctxBAlt,
              });
              assert.equal(validation.ok, true, "alt variant should not require basics.title");
              return { tenant: "B", kind: "alt-validation" };
            }
            case 1: {
              const scope = ruleEngine.createScope(
                testRuleContext({ variant: "stress" }, { tenantId: TENANT_B })
              );
              assert.equal(scope.resolveCellId(), "stress");
              assert.equal(scope.resolveEffectiveField("basics.title").hidden, true);
              return { tenant: "B", kind: "stress-scope" };
            }
            case 2: {
              const unmatched = ruleEngine.createScope(
                testRuleContext({ variant: `missing-${index}` }, { tenantId: TENANT_B })
              );
              assert.throws(
                () => unmatched.resolveCellId(),
                (error: unknown) => {
                  assert.ok(error instanceof PlatformCoreError);
                  assert.equal(error.code, "RULE_CONTEXT_UNMATCHED");
                  return true;
                }
              );
              return { tenant: "B", kind: "unmatched-scope" };
            }
            case 3: {
              const fillerIndex = index % 32;
              ruleEngine.createScope(
                testRuleContext({ variant: `lru-v-${fillerIndex}` }, { tenantId: TENANT_B })
              );
              return { tenant: "B", kind: "lru-filler" };
            }
            case 4: {
              assert.throws(
                () =>
                  ruleEngine.createScope({
                    tenantId: TENANT_B,
                    dimensions: { variant: 42 as unknown as string },
                  }),
                (error: unknown) => {
                  assert.ok(error instanceof PlatformCoreError);
                  assert.equal(error.code, "INVALID_RULE_CONTEXT");
                  return true;
                }
              );
              return { tenant: "B", kind: "invalid-dimension-type" };
            }
            case 5: {
              const validation = validateCanonicalDocument({
                plugin,
                fieldEngine,
                ruleEngine,
                document: INCOMPLETE_TOUR,
                context: testRuleContext({ variant: "default" }, { tenantId: TENANT_B }),
              });
              assert.equal(validation.ok, false);
              assert.ok(validation.violations.some((v) => v.fieldId === "basics.title"));
              return { tenant: "B", kind: "default-validation-fail" };
            }
            case 6: {
              assert.throws(
                () =>
                  ruleEngine.createScope(
                    testRuleContext({ variant: "default" }, { tenantId: "bad tenant!" })
                  ),
                (error: unknown) => {
                  assert.ok(error instanceof PlatformCoreError);
                  assert.equal(error.code, "TENANT_ISOLATION_VIOLATION");
                  return true;
                }
              );
              return { tenant: "B", kind: "invalid-tenant-id" };
            }
            default: {
              const scope = ruleEngine.createScope(
                testRuleContext({ variant: "default" }, { tenantId: TENANT_B })
              );
              assert.equal(scope.resolveCellId(), "default");
              assert.notEqual(
                scope,
                scopeARef,
                "Tenant B scope must not alias Tenant A cache entry"
              );
              return { tenant: "B", kind: "default-scope" };
            }
          }
        });
      });

      const results = await Promise.all(tasks);
      assert.equal(results.length, BURST_TASK_COUNT);

      const tenantARows = results.filter((row): row is TenantABurstRow => row.tenant === "A");
      assert.equal(tenantARows.length, BURST_TASK_COUNT / 2);
      for (const [index, row] of tenantARows.entries()) {
        assert.equal(row.validationOk, true, `burst task A#${index}: validation must stay valid`);
        assert.deepEqual(
          row.scope,
          goldenScope,
          `burst task A#${index}: scope state leaked or mutated`
        );
      }

      const postValidation = validateCanonicalDocument({
        plugin,
        fieldEngine,
        ruleEngine,
        document: VALID_TOUR,
        context: ctxA,
      });
      assert.equal(
        postValidation.ok,
        true,
        "Tenant A post-burst validation must match baseline golden"
      );
      assert.equal(postValidation.violations.length, 0);

      const postScope = ruleEngine.createScope(ctxA);
      assert.deepEqual(
        snapshotScope(postScope),
        goldenScope,
        "Tenant A post-burst scope must match golden"
      );
      assert.equal(
        postScope,
        scopeARef,
        "Tenant A post-burst cache hit must not repoint to Tenant B scope instance"
      );
    }
  );
});
