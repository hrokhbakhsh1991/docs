import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import { testRuleContext } from "../src/__fixtures__/rule-context.fixture";
import { PlatformCoreError } from "../src/errors/platform-core.error";
import { FieldRegistryEngine } from "../src/engine/field-registry.engine";
import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine";
import { RuleEngine } from "../src/engine/rule.engine";
import {
  starterFieldRegistry,
  starterRuleSet,
} from "../src/__fixtures__/starter.fixture";
import {
  createCanonicalDocument,
  starterWorkspacePlugin,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const TENANT_COUNT = 16;
const ROUNDS_PER_TENANT = 50;
const CONCURRENT_TASKS = TENANT_COUNT * ROUNDS_PER_TENANT;

function makeEngine(
  registry: WorkspaceFieldRegistry,
  ruleSet: WorkspaceRuleSet,
): RuleEngine {
  return new RuleEngine(ruleSet, new FieldRegistryEngine(registry));
}

describe("RuleEngine high-concurrency scope cache", () => {
  it("isolates tenant scopes under sustained parallel resolveCellId load", async () => {
    const ruleSet: WorkspaceRuleSet = {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "alt",
          dimensions: { variant: "alt" },
          fieldOverrides: [{ fieldId: "field.a", required: false, hidden: false }],
        },
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [{ fieldId: "field.a", required: true, hidden: false }],
        },
      ],
    };
    const registry: WorkspaceFieldRegistry = {
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
    const engine = makeEngine(registry, ruleSet);

    const tasks = Array.from({ length: CONCURRENT_TASKS }, (_, index) => {
      const tenantIndex = index % TENANT_COUNT;
      const tenantId = `tenant_${tenantIndex}`;
      const variant = index % 3 === 0 ? "alt" : "default";
      return Promise.resolve().then(() => {
        const context = testRuleContext({ variant }, { tenantId });
        const cellId = engine.resolveCellId(context);
        const scope = engine.createScope(context);
        assert.equal(scope.resolveCellId(), cellId);
        scope.resolveEffectiveField("field.a");
        return { tenantId, variant, cellId, scope };
      });
    });

    const results = await Promise.all(tasks);

    for (let tenantIndex = 0; tenantIndex < TENANT_COUNT; tenantIndex += 1) {
      const tenantId = `tenant_${tenantIndex}`;
      const defaultScope = engine.createScope(
        testRuleContext({ variant: "default" }, { tenantId }),
      );
      const altScope = engine.createScope(testRuleContext({ variant: "alt" }, { tenantId }));

      const tenantResults = results.filter((r) => r.tenantId === tenantId);
      for (const row of tenantResults) {
        const expectedScope = row.variant === "alt" ? altScope : defaultScope;
        assert.equal(row.scope, expectedScope);
        assert.equal(row.cellId, row.variant === "alt" ? "alt" : "default");
      }
    }
  });

  it("does not cross-contaminate scope caches when tenants share dimension signatures", async () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    const sharedDimensions = { variant: "default" as const };

    const tasks = Array.from({ length: CONCURRENT_TASKS }, (_, index) => {
      const tenantId = `iso_tenant_${index % TENANT_COUNT}`;
      return Promise.resolve().then(() => {
        const scope = engine.createScope(testRuleContext(sharedDimensions, { tenantId }));
        return { tenantId, scope, cellId: scope.resolveCellId() };
      });
    });

    const results = await Promise.all(tasks);
    const referenceByTenant = new Map<string, ReturnType<RuleEngine["createScope"]>>();

    for (const row of results) {
      let reference = referenceByTenant.get(row.tenantId);
      if (!reference) {
        reference = engine.createScope(testRuleContext(sharedDimensions, { tenantId: row.tenantId }));
        referenceByTenant.set(row.tenantId, reference);
      }
      assert.equal(row.scope, reference);
      assert.equal(row.cellId, "default");
    }

    const tenantIds = [...referenceByTenant.keys()];
    assert.equal(tenantIds.length, TENANT_COUNT);
    for (let i = 0; i < tenantIds.length; i += 1) {
      for (let j = i + 1; j < tenantIds.length; j += 1) {
        assert.notEqual(
          referenceByTenant.get(tenantIds[i]!),
          referenceByTenant.get(tenantIds[j]!),
        );
      }
    }
  });

  it("parallel validateCanonical on shared PlatformWizardEngine does not leak rule scopes", async () => {
    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
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
        ],
      },
    };
    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const validDoc = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "Tour" },
        details: { summary: "Summary" },
      },
    });

    const tasks = Array.from({ length: CONCURRENT_TASKS }, (_, index) => {
      const tenantId = `wizard_tenant_${index % TENANT_COUNT}`;
      const variant = index % 2 === 0 ? "default" : "alt";
      const context = testRuleContext({ variant }, { tenantId });
      return Promise.resolve().then(() => engine.validateCanonical(validDoc, context));
    });

    const results = await Promise.all(tasks);
    assert.equal(results.length, CONCURRENT_TASKS);
    for (const result of results) {
      assert.equal(result.ok, true);
      assert.equal(result.violations.length, 0);
    }

    const ruleEngine = engine["ruleEngine"] as RuleEngine;
    for (let i = 0; i < TENANT_COUNT; i += 1) {
      const tenantId = `wizard_tenant_${i}`;
      const defaultScope = ruleEngine.createScope(
        testRuleContext({ variant: "default" }, { tenantId }),
      );
      const altScope = ruleEngine.createScope(testRuleContext({ variant: "alt" }, { tenantId }));
      assert.notEqual(defaultScope, altScope);
      assert.equal(defaultScope.resolveCellId(), "default");
      assert.equal(altScope.resolveCellId(), "alt");
    }
  });

  it("rejects invalid tenant context even under concurrent calls", async () => {
    const engine = makeEngine(starterFieldRegistry, starterRuleSet);
    const badContexts = Array.from({ length: 32 }, (_, index) => ({
      dimensions: { variant: "default" },
      tenantId: index % 2 === 0 ? "" : `   `,
    }));

    const tasks = badContexts.map((ctx) =>
      Promise.resolve().then(() => {
        try {
          engine.resolveCellId(ctx as Parameters<RuleEngine["resolveCellId"]>[0]);
          return { ok: true as const };
        } catch (error: unknown) {
          assert.ok(error instanceof PlatformCoreError);
          assert.equal(error.code, "TENANT_ISOLATION_VIOLATION");
          return { ok: false as const };
        }
      }),
    );

    const results = await Promise.all(tasks);
    assert.equal(results.every((r) => !r.ok), true);
  });
});
