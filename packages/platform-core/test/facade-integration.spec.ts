import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine.js";
import { PlatformCoreError } from "../src/errors/platform-core.error.js";
import { createTestStarterPlugin } from "./fixtures/starter.fixture.js";
import { STARTER_PLAN_SNAPSHOT } from "./fixtures/starter-plan-golden.js";
import { testRuleContext } from "./fixtures/rule-context.fixture.js";

describe("facade integration — public PlatformWizardEngine API", () => {
  it("tryFromPlugin → buildRenderPlan matches starter golden snapshot", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(createTestStarterPlugin());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const plan = loaded.value.buildRenderPlan(
      testRuleContext({ variant: "default" }, { tenantId: "facade-golden" }),
    );
    assert.equal(JSON.stringify(plan), STARTER_PLAN_SNAPSHOT);
  });

  it("validateCanonical reports REQUIRED_FIELD_EMPTY for missing visible required field", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(createTestStarterPlugin());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const result = loaded.value.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: {}, details: { summary: "ok" } },
      }),
      testRuleContext({ variant: "default" }, { tenantId: "facade-required" }),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (v) => v.code === "REQUIRED_FIELD_EMPTY" || v.code === "UNKNOWN_CANONICAL_PATH",
      ),
    );
    assert.ok(result.violations.some((v) => v.fieldId === "basics.title"));
  });

  it("variant dimensions change required flags on render plan (production rule path)", () => {
    const plugin: WorkspacePlugin = {
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
    const loaded = PlatformWizardEngine.tryFromPlugin(plugin);
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const engine = loaded.value;
    const defaultPlan = engine.buildRenderPlan(
      testRuleContext({ variant: "default" }, { tenantId: "facade-variant" }),
    );
    const altPlan = engine.buildRenderPlan(
      testRuleContext({ variant: "alt" }, { tenantId: "facade-variant" }),
    );
    const defaultTitle = defaultPlan[0]?.fields.find((f) => f.fieldId === "basics.title");
    const altTitle = altPlan[0]?.fields.find((f) => f.fieldId === "basics.title");
    assert.equal(defaultTitle?.required, true);
    assert.equal(altTitle?.required, false);
  });

  function pluginWithDateAndBooleanFields(): WorkspacePlugin {
    return {
      ...createTestStarterPlugin(),
      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.startDate",
            canonicalPath: "details.startDate",
            stepId: "details",
            kind: "date",
            required: true,
          },
          {
            id: "details.active",
            canonicalPath: "details.active",
            stepId: "details",
            kind: "boolean",
            required: true,
          },
        ],
      },
      ruleSet: {
        ...createTestStarterPlugin().ruleSet,
        cells: [
          {
            cellId: "default",
            dimensions: { variant: "default" },
            fieldOverrides: [
              { fieldId: "basics.title", required: true, hidden: false },
              { fieldId: "details.summary", hidden: false },
              { fieldId: "details.startDate", hidden: false },
              { fieldId: "details.active", hidden: false },
            ],
          },
        ],
      },
    };
  }

  it("validateCanonical reports CANONICAL_TYPE_MISMATCH for invalid date through facade", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(pluginWithDateAndBooleanFields());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const result = loaded.value.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: { title: "My tour" },
          details: { summary: "ok", startDate: "not-a-date", active: true },
        },
      }),
      testRuleContext({ variant: "default" }, { tenantId: "facade-date" }),
    );
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "CANONICAL_TYPE_MISMATCH"));
    assert.equal(result.violations.find((v) => v.fieldId === "details.startDate")?.fieldId, "details.startDate");
  });

  it("validateCanonical reports CANONICAL_TYPE_MISMATCH for invalid boolean through facade", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(pluginWithDateAndBooleanFields());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const result = loaded.value.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: { title: "My tour" },
          details: { summary: "ok", startDate: "2026-06-03", active: "yes" },
        },
      }),
      testRuleContext({ variant: "default" }, { tenantId: "facade-boolean" }),
    );
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "CANONICAL_TYPE_MISMATCH"));
    assert.equal(result.violations.find((v) => v.fieldId === "details.active")?.fieldId, "details.active");
  });

  it("validateCanonical accepts boolean false as non-empty through facade", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(pluginWithDateAndBooleanFields());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const result = loaded.value.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: { title: "My tour" },
          details: { summary: "ok", startDate: "2026-06-03", active: false },
        },
      }),
      testRuleContext({ variant: "default" }, { tenantId: "facade-boolean-false" }),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.violations, []);
  });

  it("validateCanonical reports CANONICAL_TYPE_MISMATCH through facade for wrong primitive kind", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(createTestStarterPlugin());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    const result = loaded.value.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: 42 }, details: { summary: "ok" } },
      }),
      testRuleContext({ variant: "default" }, { tenantId: "facade-type" }),
    );
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "CANONICAL_TYPE_MISMATCH"));
    assert.equal(result.violations.find((v) => v.fieldId === "basics.title")?.fieldId, "basics.title");
  });

  it("rejects missing tenantId via facade buildRenderPlan with TENANT_ISOLATION_VIOLATION", () => {
    const loaded = PlatformWizardEngine.tryFromPlugin(createTestStarterPlugin());
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    assert.throws(
      () =>
        loaded.value.buildRenderPlan({
          dimensions: { variant: "default" },
        } as { tenantId: string; dimensions: Record<string, string> }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "TENANT_ISOLATION_VIOLATION");
        return true;
      },
    );
  });
});
