import assert from "node:assert/strict";

import { loadPlatformWizard } from "../../load-platform-wizard.js";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { createTestStarterPlugin } from "../../fixtures/starter.fixture.js";
import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { testRuleContext } from "../../fixtures/rule-context.fixture.js";
import { PlatformWizardEngine } from "../../../src/engine/platform-wizard.engine.js";

function pluginWithDuplicateFieldId(): WorkspacePlugin {
  return {
    ...createTestStarterPlugin(),

    fieldRegistry: {
      version: 1,
      fields: [
        {
          id: "dup",
          canonicalPath: "a.one",
          stepId: "a",
          kind: "text",
          required: true,
        },
        {
          id: "dup",
          canonicalPath: "a.two",
          stepId: "a",
          kind: "text",
          required: false,
        },
      ],
    },
  };
}

function pluginWithInvalidDefaultCell(): WorkspacePlugin {
  return {
    ...createTestStarterPlugin(),

    ruleSet: {
      ...createTestStarterPlugin().ruleSet,
      defaultCellId: "missing",
    },
  };
}

function pluginWithOrphanOverride(): WorkspacePlugin {
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
          fieldOverrides: [{ fieldId: "orphan.field", hidden: false }],
        },
      ],
    },
  };
}

function pluginWithDuplicateCellId(): WorkspacePlugin {
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
          fieldOverrides: [],
        },
        {
          cellId: "default",
          dimensions: { variant: "premium" },
          fieldOverrides: [],
        },
      ],
    },
  };
}

function pluginWithDuplicateCanonicalPath(): WorkspacePlugin {
  return {
    ...createTestStarterPlugin(),

    fieldRegistry: {
      version: 1,
      fields: [
        {
          id: "field.one",
          canonicalPath: "shared.path",
          stepId: "basics",
          kind: "text",
          required: true,
        },
        {
          id: "field.two",
          canonicalPath: "shared.path",
          stepId: "details",
          kind: "text",
          required: false,
        },
      ],
    },
  };
}

function pluginWithAmbiguousCatchAllCells(): WorkspacePlugin {
  return {
    ...createTestStarterPlugin(),

    ruleSet: {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "default",
      cells: [
        {
          cellId: "catch-a",
          dimensions: {},
          fieldOverrides: [],
        },
        {
          cellId: "catch-b",
          dimensions: {},
          fieldOverrides: [],
        },
        {
          cellId: "default",
          dimensions: { variant: "default" },
          fieldOverrides: [],
        },
      ],
    },
  };
}

describe("PlatformWizardEngine", () => {
  it("tryFromPlugin builds render plan end-to-end for starter", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const plan = engine.buildRenderPlan(testRuleContext({ variant: "default" }));
    assert.equal(plan.length, 2);
    assert.equal(plan[0]?.stepId, "basics");
    assert.equal(plan[1]?.stepId, "details");
  });

  it("tryFromPlugin throws DUPLICATE_FIELD_ID for duplicate registry ids", () => {
    assert.throws(
      () => loadPlatformWizard(pluginWithDuplicateFieldId()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_FIELD_ID");
        return true;
      }
    );
  });

  it("tryFromPlugin throws INVALID_RULE_SET for invalid defaultCellId", () => {
    assert.throws(
      () => loadPlatformWizard(pluginWithInvalidDefaultCell()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      }
    );
  });

  it("tryFromPlugin throws UNKNOWN_FIELD_ID for orphan override fieldId", () => {
    assert.throws(
      () => loadPlatformWizard(pluginWithOrphanOverride()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "UNKNOWN_FIELD_ID");
        return true;
      }
    );
  });

  it("tryFromPlugin throws DUPLICATE_CELL_ID for duplicate rule cell ids", () => {
    assert.throws(
      () => loadPlatformWizard(pluginWithDuplicateCellId()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_CELL_ID");
        return true;
      }
    );
  });

  it("tryFromPlugin throws DUPLICATE_CANONICAL_PATH for duplicate paths", () => {
    assert.throws(
      () => loadPlatformWizard(pluginWithDuplicateCanonicalPath()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_CANONICAL_PATH");
        return true;
      }
    );
  });

  it("tryFromPlugin throws INVALID_RULE_SET for ambiguous catch-all cells", () => {
    assert.throws(
      () => loadPlatformWizard(pluginWithAmbiguousCatchAllCells()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      }
    );
  });

  it("validateCanonical reports UNKNOWN_CANONICAL_PATH when required path is absent", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.code, "UNKNOWN_CANONICAL_PATH");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("validateCanonical reports REQUIRED_FIELD_EMPTY for missing visible required field", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "" },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.code, "REQUIRED_FIELD_EMPTY");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("validateCanonical accepts required number 0 as non-empty", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),

      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "basics.count",
            canonicalPath: "basics.count",
            stepId: "basics",
            kind: "number",
            required: true,
          },
        ],
      },
    };
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "T", count: 0 },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, true);
  });

  it("validateCanonical reports CANONICAL_TYPE_MISMATCH for wrong primitive on required text", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: 12345 },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "CANONICAL_TYPE_MISMATCH");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("validateCanonical passes for valid starter document", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.violations, []);
  });

  it("validateCanonical rejects HIDDEN_FIELD_POISON when hidden field has enum value", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),

      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields.filter(
            (f) => f.id !== "details.status"
          ),
          {
            id: "details.status",
            canonicalPath: "details.status",
            stepId: "details",
            kind: "enum",
            required: false,
            enumOptions: ["draft", "open"],
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
              { fieldId: "details.status", hidden: true },
            ],
          },
        ],
      },
    };
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", status: "@@INVALID@@" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "HIDDEN_FIELD_POISON");
    assert.equal(result.violations[0]?.fieldId, "details.status");
  });

  it("validateCanonical skips fields in inactiveFieldGroups even when data is invalid (ST-WEAK-05 hardened)", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),
      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.pricingAmount",
            canonicalPath: "details.pricingAmount",
            stepId: "details",
            kind: "text",
            required: true,
            groupSlug: "pricing",
          },
        ],
      },
      wizard: {
        ...createTestStarterPlugin().wizard,
        inactiveFieldGroups: ["pricing"],
      },
    };
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "Summary text", pricingAmount: 99999 },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => v.fieldId === "basics.title"),
      "active required field must still fail when validation runs"
    );
    assert.ok(
      !result.violations.some((v) => v.fieldId === "details.pricingAmount"),
      "inactive group field must be skipped"
    );
  });

  it("validateCanonical reports violation for inactive group field when group is active", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),
      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.pricingAmount",
            canonicalPath: "details.pricingAmount",
            stepId: "details",
            kind: "text",
            required: true,
            groupSlug: "pricing",
          },
        ],
      },
      wizard: {
        ...createTestStarterPlugin().wizard,
        inactiveFieldGroups: [],
      },
    };
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", pricingAmount: 99999 },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (v) => v.fieldId === "details.pricingAmount" && v.code === "CANONICAL_TYPE_MISMATCH"
      )
    );
  });

  it("validateCanonical allows hidden composite with benign object (no HIDDEN_FIELD_POISON, ST-WEAK-06 hardened)", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),
      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.meta",
            canonicalPath: "details.meta",
            stepId: "details",
            kind: "composite",
            required: false,
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
              { fieldId: "details.meta", hidden: true },
            ],
          },
        ],
      },
    };
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "" },
        details: { meta: { note: "internal" } },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => v.fieldId === "basics.title"),
      "active required field must fail when validation runs"
    );
    assert.ok(!result.violations.some((v) => v.code === "HIDDEN_FIELD_POISON"));
  });

  it("validateCanonical maps tryInit failure via validationResultFromPlatformError", () => {
    const engine = PlatformWizardEngine.create(createTestStarterPlugin());
    engine.init();
    const broken = pluginWithOrphanOverride();
    const internal = engine as { runtime: null; pluginInput: WorkspacePlugin };
    internal.runtime = null;
    internal.pluginInput = broken;
    const result = engine.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: "My tour" }, details: { summary: "ok" } },
      }),
      testRuleContext({ variant: "default" })
    );
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.code, "UNKNOWN_FIELD_ID");
    assert.match(result.violations[0]?.message ?? "", /orphan\.field/);
  });

  it("tryBuildRenderPlan returns PlatformResult failure when tryInit fails (no throw)", () => {
    const engine = PlatformWizardEngine.create(createTestStarterPlugin());
    engine.init();
    const internal = engine as {
      runtime: null;
      pluginInput: WorkspacePlugin;
    };
    internal.runtime = null;
    internal.pluginInput = pluginWithOrphanOverride();
    const plan = engine.tryBuildRenderPlan(testRuleContext({ variant: "default" }));
    assert.equal(plan.ok, false);
    if (plan.ok) {
      return;
    }
    assert.equal(plan.error.code, "UNKNOWN_FIELD_ID");
  });

  it("validateCanonical reports HIDDEN_FIELD_POISON when hidden field has any value", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),

      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.secret",
            canonicalPath: "details.secret",
            stepId: "details",
            kind: "text",
            required: false,
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
              { fieldId: "details.secret", hidden: true },
            ],
          },
        ],
      },
    };
    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", secret: 12345 },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "HIDDEN_FIELD_POISON");
    assert.equal(result.violations[0]?.fieldId, "details.secret");
  });
});

describe("validateCanonical high-cardinality", () => {
  it("validates 1,000 hidden fields across 40 steps when document omits hidden paths", () => {
    const stepCount = 40;
    const fieldsPerStep = 25;
    const roots = Array.from({ length: stepCount }, (_, index) => `step-${index}`);
    const fields = roots.flatMap((stepId) =>
      Array.from({ length: fieldsPerStep }, (_, index) => ({
        id: `${stepId}.field-${index}`,
        canonicalPath: `${stepId}.field-${index}`,
        stepId,
        kind: "text" as const,
        required: false,
      }))
    );

    const data: Record<string, Record<string, string>> = {};
    for (const root of roots) {
      data[root] = {};
    }
    data["step-0"] = { "field-0": "visible-probe" };

    const visibleProbeId = "step-0.field-0";
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),

      fieldRegistry: { version: 1, fields },
      wizard: {
        ...createTestStarterPlugin().wizard,
        roots,
      },
      ruleSet: {
        ...createTestStarterPlugin().ruleSet,
        cells: [
          {
            cellId: "default",
            dimensions: { variant: "default" },
            fieldOverrides: fields.map((field) => ({
              fieldId: field.id,
              hidden: field.id === visibleProbeId ? false : true,
              required: field.id === visibleProbeId,
            })),
          },
        ],
      },
    };

    const engine = loadPlatformWizard(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots,
      data,
    });
    const context = testRuleContext({ variant: "default" });

    const hiddenOnly = engine.validateCanonical(document, context);
    assert.equal(hiddenOnly.ok, true);
    assert.deepEqual(hiddenOnly.violations, []);

    const missingVisible = engine.validateCanonical(
      createCanonicalDocument({
        schemaVersion: 1,
        roots,
        data: {
          ...data,
          "step-0": {},
        },
      }),
      context
    );
    assert.equal(missingVisible.ok, false);
    assert.ok(
      missingVisible.violations.some(
        (v) =>
          v.fieldId === visibleProbeId &&
          (v.code === "REQUIRED_FIELD_EMPTY" || v.code === "UNKNOWN_CANONICAL_PATH")
      )
    );
  });
});
