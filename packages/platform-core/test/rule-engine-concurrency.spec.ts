import assert from "node:assert/strict";

import { loadPlatformWizard } from "./load-platform-wizard.js";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { testRuleContext } from "./fixtures/rule-context.fixture.js";
import { PlatformCoreError } from "../src/errors/platform-core.error.js";
import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine.js";
import { createTestStarterPlugin } from "./fixtures/starter.fixture.js";

const TENANT_COUNT = 16;
const ROUNDS_PER_TENANT = 50;
const CONCURRENT_TASKS = TENANT_COUNT * ROUNDS_PER_TENANT;

function variantPlugin(): WorkspacePlugin {
  return {
    ...createTestStarterPlugin(),
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
}

describe("PlatformWizardEngine concurrency under load", () => {
  it("parallel buildRenderPlan preserves variant-specific required flags per tenant", async () => {
    const engine = loadPlatformWizard(variantPlugin());

    const tasks = Array.from({ length: CONCURRENT_TASKS }, (_, index) => {
      const tenantId = `tenant_${index % TENANT_COUNT}`;
      const variant = index % 3 === 0 ? "alt" : "default";
      return Promise.resolve().then(() => {
        const plan = engine.buildRenderPlan(testRuleContext({ variant }, { tenantId }));
        const title = plan[0]?.fields.find((f) => f.fieldId === "basics.title");
        return { tenantId, variant, required: title?.required };
      });
    });

    const results = await Promise.all(tasks);
    for (const row of results) {
      assert.equal(row.required, row.variant === "alt" ? false : true);
    }
  });

  it("parallel buildRenderPlan keeps tenant plans independent with shared dimensions", async () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const sharedDimensions = { variant: "default" as const };

    const tasks = Array.from({ length: CONCURRENT_TASKS }, (_, index) => {
      const tenantId = `iso_tenant_${index % TENANT_COUNT}`;
      return Promise.resolve().then(() => {
        const plan = engine.buildRenderPlan(testRuleContext(sharedDimensions, { tenantId }));
        return {
          tenantId,
          stepCount: plan.length,
          titleRequired: plan[0]?.fields.find((f) => f.fieldId === "basics.title")?.required,
        };
      });
    });

    const results = await Promise.all(tasks);
    for (const row of results) {
      assert.equal(row.stepCount, 2);
      assert.equal(row.titleRequired, true);
    }
    const tenantIds = new Set(results.map((r) => r.tenantId));
    assert.equal(tenantIds.size, TENANT_COUNT);
  });

  it("parallel validateCanonical distinguishes variant outcomes under mixed tenants", async () => {
    const engine = loadPlatformWizard(variantPlugin());
    const incompleteDoc = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "Summary" },
      },
    });

    const tasks = Array.from({ length: CONCURRENT_TASKS }, (_, index) => {
      const tenantId = `wizard_tenant_${index % TENANT_COUNT}`;
      const variant = index % 2 === 0 ? "default" : "alt";
      const context = testRuleContext({ variant }, { tenantId });
      return Promise.resolve().then(() => engine.validateCanonical(incompleteDoc, context));
    });

    const results = await Promise.all(tasks);
    assert.equal(results.length, CONCURRENT_TASKS);

    for (let i = 0; i < results.length; i += 1) {
      const variant = i % 2 === 0 ? "default" : "alt";
      if (variant === "default") {
        assert.equal(results[i]?.ok, false);
        assert.ok(results[i]?.violations.some((v) => v.fieldId === "basics.title"));
      } else {
        assert.equal(results[i]?.ok, true);
        assert.equal(results[i]?.violations.length, 0);
      }
    }

    const defaultPlan = engine.buildRenderPlan(
      testRuleContext({ variant: "default" }, { tenantId: "wizard_tenant_0" }),
    );
    const altPlan = engine.buildRenderPlan(
      testRuleContext({ variant: "alt" }, { tenantId: "wizard_tenant_0" }),
    );
    assert.equal(
      defaultPlan[0]?.fields.find((f) => f.fieldId === "basics.title")?.required,
      true,
    );
    assert.equal(altPlan[0]?.fields.find((f) => f.fieldId === "basics.title")?.required, false);
  });

  it("rejects invalid tenant context via facade even under concurrent calls", async () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const badContexts = Array.from({ length: 32 }, (_, index) => ({
      dimensions: { variant: "default" },
      tenantId: index % 2 === 0 ? "" : `   `,
    }));

    const tasks = badContexts.map((ctx) =>
      Promise.resolve().then(() => {
        try {
          engine.buildRenderPlan(ctx as { tenantId: string; dimensions: Record<string, string> });
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
