import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { starterWorkspacePlugin } from "../reference/starter-workspace.plugin";
import {
  assertWorkspacePlugin,
  WorkspacePluginValidationError,
} from "./workspace-plugin-validation";

describe("assertWorkspacePlugin", () => {
  it("accepts starterWorkspacePlugin", () => {
    assert.doesNotThrow(() => assertWorkspacePlugin(starterWorkspacePlugin));
  });

  it("rejects hollow fieldRegistry without fields array", () => {
    const bad = {
      ...starterWorkspacePlugin,
      fieldRegistry: { version: 1 },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });

  it("rejects orphan stepId not listed in wizard.roots", () => {
    const bad = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          ...starterWorkspacePlugin.fieldRegistry.fields,
          {
            id: "orphan.field",
            canonicalPath: "basics.orphan",
            stepId: "orphan-step",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_WIZARD_SURFACE");
        return true;
      },
    );
  });

  it("rejects lifecycle transition cycles", () => {
    const bad = {
      ...starterWorkspacePlugin,
      lifecycle: {
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [
          { from: "DRAFT", to: "OPEN" },
          { from: "OPEN", to: "DRAFT" },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_LIFECYCLE");
        return true;
      },
    );
  });

  it("rejects lifecycle when publishStatus is unreachable from initialStatus", () => {
    const bad = {
      ...starterWorkspacePlugin,
      lifecycle: {
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [{ from: "DRAFT", to: "REVIEW" }],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_LIFECYCLE");
        return true;
      },
    );
  });

  it("rejects enum fields without enumOptions", () => {
    const bad = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "basics.status",
            canonicalPath: "basics.status",
            stepId: "basics",
            kind: "enum" as const,
            required: false,
          },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });

  it("rejects ambiguous catch-all cells without distinct priorities", () => {
    const bad = {
      ...starterWorkspacePlugin,
      ruleSet: {
        version: 1,
        matrixDimensions: ["variant"],
        defaultCellId: "default",
        cells: [
          { cellId: "a", dimensions: {}, fieldOverrides: [] },
          { cellId: "b", dimensions: {}, fieldOverrides: [] },
          {
            cellId: "default",
            dimensions: { variant: "default" },
            fieldOverrides: [],
          },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      },
    );
  });
});
