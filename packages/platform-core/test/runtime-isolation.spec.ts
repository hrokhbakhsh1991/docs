import assert from "node:assert/strict";

import { loadPlatformWizard } from "./load-platform-wizard.js";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import {
  parseCanonicalDocumentFromStorage,
  parseWorkspacePluginFromStorage,
} from "@app-tour/workspace-sdk/ingress";
import type {
  WorkspaceFieldRegistry,
  WorkspaceRuleSet,
  WorkspaceWizardSurface,
} from "@app-tour/workspace-sdk/plugin-types";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import type { RenderStepPlan } from "../src/types/render-plan.js";
import { createTestStarterPlugin, pluginPayloadForStorageIngress } from "./fixtures/starter.fixture.js";
import { testRuleContext } from "./fixtures/rule-context.fixture.js";
import { buildRuleContextScopeKey } from "../src/utils/rule-context-scope-key.js";

/** Minimal plugin: single field id `A`; rule override controls hidden vs visible. */
function createPluginWithFieldAVisibility(hidden: boolean): WorkspacePlugin {
  const base = createTestStarterPlugin();
  const fieldRegistry: WorkspaceFieldRegistry = {
    version: 1,
    fields: [
      {
        id: "A",
        canonicalPath: "step.A",
        stepId: "step",
        kind: "text",
        required: true,
      },
    ],
  };
  const wizard: WorkspaceWizardSurface = {
    wizardMode: "classic",
    railId: "iso-field-a",
    roots: ["step"],
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
        fieldOverrides: [{ fieldId: "A", hidden, required: true }],
      },
    ],
  };
  return {
    ...base,
    id: hidden ? "iso-engine-hidden-a" : "iso-engine-visible-a",
    fieldRegistry,
    ruleSet,
    wizard,
  };
}

function fieldIdsInPlan(plan: readonly RenderStepPlan[]): string[] {
  return plan.flatMap((step) => step.fields.map((row) => row.fieldId));
}
describe("runtime isolation — cross-tenant scope signatures", () => {
  it("buildRuleContextScopeKey prefixes tenant boundary with t: and isolates tenants", () => {
    const dimensions = { variant: "default" };
    const keyA = buildRuleContextScopeKey(
      testRuleContext(dimensions, { tenantId: "tenant_a" }),
      ["variant"],
    );
    const keyB = buildRuleContextScopeKey(
      testRuleContext(dimensions, { tenantId: "tenant_b" }),
      ["variant"],
    );
    assert.match(keyA, /^t:tenant_a\0/);
    assert.match(keyB, /^t:tenant_b\0/);
    assert.notEqual(keyA, keyB);

    const engine = loadPlatformWizard(createTestStarterPlugin());
    const planA = engine.buildRenderPlan(testRuleContext(dimensions, { tenantId: "tenant_a" }));
    const planB = engine.buildRenderPlan(testRuleContext(dimensions, { tenantId: "tenant_b" }));
    assert.equal(planA.length, planB.length);
    assert.deepEqual(planA[0]?.fields, planB[0]?.fields);
  });
});

describe("runtime isolation — unicode NFC dimension equality", () => {
  it("NFC and NFD dimension variants share the same scope cache key", () => {
    const nfc = "\u00e9";
    const nfd = "e\u0301";
    const keyNfc = buildRuleContextScopeKey(
      testRuleContext({ variant: nfc }, { tenantId: "tenant_nfc" }),
      ["variant"],
    );
    const keyNfd = buildRuleContextScopeKey(
      testRuleContext({ variant: nfd }, { tenantId: "tenant_nfc" }),
      ["variant"],
    );
    assert.equal(keyNfc, keyNfd);
  });
});

describe("runtime isolation — storage ingress immutability", () => {
  it("parseCanonicalDocumentFromStorage returns a deep-frozen clone", () => {
    const source = {
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        basics: { title: "Tour" },
      },
    };
    const parsed = parseCanonicalDocumentFromStorage(source);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.data), true);
    assert.equal(Object.isFrozen(parsed.data.basics), true);
    assert.notEqual(parsed.data, source.data);
  });

  it("parseWorkspacePluginFromStorage returns a deep-frozen clone", () => {
    const parsed = parseWorkspacePluginFromStorage(
      pluginPayloadForStorageIngress(createTestStarterPlugin())
    );
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.fieldRegistry), true);
    assert.throws(() => {
      Object.defineProperty(parsed, "id", { value: "mutated" });
    });
    assert.equal(parsed.id, createTestStarterPlugin().id);
  });
});

describe("runtime isolation — concurrent engine instances", () => {
  it("parallel buildRenderPlan on two engines does not bleed hidden state for field A", async () => {
    const engineHidden = loadPlatformWizard(createPluginWithFieldAVisibility(true));
    const engineVisible = loadPlatformWizard(createPluginWithFieldAVisibility(false));
    const context = testRuleContext({ variant: "default" }, { tenantId: "iso_concurrent_a" });

    const runBurst = () =>
      Promise.all([
        Promise.resolve().then(() => engineHidden.buildRenderPlan(context)),
        Promise.resolve().then(() => engineVisible.buildRenderPlan(context)),
      ]);

    const referenceHidden = engineHidden.buildRenderPlan(context);
    const referenceVisible = engineVisible.buildRenderPlan(context);

    assert.deepEqual(fieldIdsInPlan(referenceHidden), [], "hidden engine must omit field A from plan");
    assert.deepEqual(fieldIdsInPlan(referenceVisible), ["A"], "visible engine must include field A");

    for (let round = 0; round < 50; round += 1) {
      const [planHidden, planVisible] = await runBurst();
      assert.deepEqual(
        fieldIdsInPlan(planHidden),
        [],
        `round ${round}: hidden engine leaked visible row or picked up foreign effective state`,
      );
      assert.deepEqual(
        fieldIdsInPlan(planVisible),
        ["A"],
        `round ${round}: visible engine lost field A — possible cross-engine hidden bleed`,
      );
    }
  });
});

describe("runtime isolation — concurrent facade resilience", () => {
  it("parallel buildRenderPlan preserves per-tenant outcomes under load", async () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const tasks = Array.from({ length: 400 }, (_, index) => {
      const tenantId = `iso_${index % 8}`;
      return Promise.resolve().then(() =>
        engine.buildRenderPlan(testRuleContext({ variant: "default" }, { tenantId })),
      );
    });
    const plans = await Promise.all(tasks);
    const reference = engine.buildRenderPlan(
      testRuleContext({ variant: "default" }, { tenantId: "iso_0" }),
    );
    for (let i = 0; i < plans.length; i += 8) {
      assert.equal(JSON.stringify(plans[i]), JSON.stringify(reference));
    }
    const otherTenant = engine.buildRenderPlan(
      testRuleContext({ variant: "default" }, { tenantId: "iso_1" }),
    );
    assert.equal(JSON.stringify(otherTenant), JSON.stringify(reference));
  });

  it("parallel validateCanonical with variant matrix yields different ok outcomes", async () => {
    const plugin = {
      ...createTestStarterPlugin(),
      ruleSet: {
        ...createTestStarterPlugin().ruleSet,
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
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "Summary" },
      },
    });
    const tasks = Array.from({ length: 200 }, (_, index) =>
      Promise.resolve().then(() =>
        engine.validateCanonical(
          document,
          testRuleContext(
            { variant: index % 2 === 0 ? "default" : "alt" },
            { tenantId: `t_${index % 10}` },
          ),
        ),
      ),
    );
    const results = await Promise.all(tasks);
    const defaultResults = results.filter((_, index) => index % 2 === 0);
    const altResults = results.filter((_, index) => index % 2 === 1);
    assert.ok(defaultResults.every((result) => result.ok === false));
    assert.ok(altResults.every((result) => result.ok === true));
  });
});
