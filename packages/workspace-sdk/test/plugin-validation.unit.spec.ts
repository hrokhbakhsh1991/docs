import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWorkspacePlugin,
  isWorkspaceSdkValidationError,
} from "../src/index.js";
import { createFreshStarterPlugin } from "./lib/immutable-harness.js";

describe("assertWorkspacePlugin", () => {
  it("accepts createFreshStarterPlugin()", () => {
    assert.doesNotThrow(() => assertWorkspacePlugin(createFreshStarterPlugin()));
  });

  it("rejects hollow fieldRegistry without fields array", () => {
    const bad = {
      ...createFreshStarterPlugin(),

      fieldRegistry: { version: 1 },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });

  it("rejects orphan stepId not listed in wizard.roots", () => {
    const bad = {
      ...createFreshStarterPlugin(),

      fieldRegistry: {
        version: 1,
        fields: [
          ...createFreshStarterPlugin().fieldRegistry.fields,
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
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_WIZARD_SURFACE");
        return true;
      },
    );
  });

  it("allows publishStatus to initialStatus unpublish edge", () => {
    const plugin = {
      ...createFreshStarterPlugin(),

      lifecycle: {
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [
          { from: "DRAFT", to: "OPEN" },
          { from: "OPEN", to: "DRAFT" },
        ],
      },
    };
    assert.doesNotThrow(() => assertWorkspacePlugin(plugin));
  });

  it("rejects lifecycle transition cycles", () => {
    const bad = {
      ...createFreshStarterPlugin(),

      lifecycle: {
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [
          { from: "DRAFT", to: "OPEN" },
          { from: "OPEN", to: "REVIEW" },
          { from: "REVIEW", to: "OPEN" },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "CYCLE_DETECTED");
        return true;
      },
    );
  });

  it("rejects lifecycle when publishStatus is unreachable from initialStatus", () => {
    const bad = {
      ...createFreshStarterPlugin(),

      lifecycle: {
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [{ from: "DRAFT", to: "REVIEW" }],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "UNREACHABLE_PUBLISH");
        return true;
      },
    );
  });

  it("rejects enum fields without enumOptions", () => {
    const bad = {
      ...createFreshStarterPlugin(),

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
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });

  it("rejects ambiguous catch-all cells without distinct priorities", () => {
    const bad = {
      ...createFreshStarterPlugin(),

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
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      },
    );
  });
});
