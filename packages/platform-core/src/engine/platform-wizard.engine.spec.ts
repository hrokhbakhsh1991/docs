import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCanonicalDocument,
  starterWorkspacePlugin,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import { PlatformWizardEngine } from "./platform-wizard.engine";

function pluginWithDuplicateFieldId(): WorkspacePlugin {
  return {
    ...starterWorkspacePlugin,
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
    ...starterWorkspacePlugin,
    ruleSet: {
      ...starterWorkspacePlugin.ruleSet,
      defaultCellId: "missing",
    },
  };
}

function pluginWithOrphanOverride(): WorkspacePlugin {
  return {
    ...starterWorkspacePlugin,
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
    ...starterWorkspacePlugin,
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
    ...starterWorkspacePlugin,
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
    ...starterWorkspacePlugin,
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
  it("fromPlugin builds render plan end-to-end for starter", () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const plan = engine.buildRenderPlan({ dimensions: { variant: "default" } });
    assert.equal(plan.length, 2);
    assert.equal(plan[0]?.stepId, "basics");
    assert.equal(plan[1]?.stepId, "details");
  });

  it("fromPlugin throws DUPLICATE_FIELD_ID for duplicate registry ids", () => {
    assert.throws(
      () => PlatformWizardEngine.fromPlugin(pluginWithDuplicateFieldId()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_FIELD_ID");
        return true;
      },
    );
  });

  it("fromPlugin throws INVALID_RULE_SET for invalid defaultCellId", () => {
    assert.throws(
      () => PlatformWizardEngine.fromPlugin(pluginWithInvalidDefaultCell()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      },
    );
  });

  it("fromPlugin throws UNKNOWN_FIELD_ID for orphan override fieldId", () => {
    assert.throws(
      () => PlatformWizardEngine.fromPlugin(pluginWithOrphanOverride()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "UNKNOWN_FIELD_ID");
        return true;
      },
    );
  });

  it("fromPlugin throws DUPLICATE_CELL_ID for duplicate rule cell ids", () => {
    assert.throws(
      () => PlatformWizardEngine.fromPlugin(pluginWithDuplicateCellId()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_CELL_ID");
        return true;
      },
    );
  });

  it("fromPlugin throws DUPLICATE_CANONICAL_PATH for duplicate paths", () => {
    assert.throws(
      () => PlatformWizardEngine.fromPlugin(pluginWithDuplicateCanonicalPath()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_CANONICAL_PATH");
        return true;
      },
    );
  });

  it("fromPlugin throws INVALID_RULE_SET for ambiguous catch-all cells", () => {
    assert.throws(
      () => PlatformWizardEngine.fromPlugin(pluginWithAmbiguousCatchAllCells()),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      },
    );
  });

  it("validateCanonical reports UNKNOWN_CANONICAL_PATH when required path is absent", () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.code, "UNKNOWN_CANONICAL_PATH");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("validateCanonical reports REQUIRED_FIELD_EMPTY for missing visible required field", () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "" },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.code, "REQUIRED_FIELD_EMPTY");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("validateCanonical accepts required number 0 as non-empty", () => {
    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          ...starterWorkspacePlugin.fieldRegistry.fields,
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
    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "T", count: 0 },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, true);
  });

  it("validateCanonical reports CANONICAL_TYPE_MISMATCH for wrong primitive on required text", () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: 12345 },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "CANONICAL_TYPE_MISMATCH");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("validateCanonical passes for valid starter document", () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text" },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.violations, []);
  });

  it("validateCanonical rejects invalid enum token on hidden field", () => {
    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          ...starterWorkspacePlugin.fieldRegistry.fields,
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
        ...starterWorkspacePlugin.ruleSet,
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
    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", status: "@@INVALID@@" },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "CANONICAL_TYPE_MISMATCH");
    assert.equal(result.violations[0]?.fieldId, "details.status");
  });

  it("validateCanonical reports CANONICAL_TYPE_MISMATCH for wrong type on hidden field", () => {
    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          ...starterWorkspacePlugin.fieldRegistry.fields,
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
        ...starterWorkspacePlugin.ruleSet,
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
    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", secret: 12345 },
      },
    });
    const result = engine.validateCanonical(document, {
      dimensions: { variant: "default" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "CANONICAL_TYPE_MISMATCH");
    assert.equal(result.violations[0]?.fieldId, "details.secret");
  });
});
