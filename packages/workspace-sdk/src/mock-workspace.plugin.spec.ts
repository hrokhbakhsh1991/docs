import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCanonicalDocument,
  CanonicalDocumentValidationError,
  getWorkspaceRuleCell,
  isWorkspacePlugin,
  mockWorkspacePlugin,
  MOCK_WORKSPACE_PLUGIN_ID,
  noopWorkspaceValidationHooks,
  resolveWorkspacePluginIdForProfile,
} from "./index";

describe("mockWorkspacePlugin", () => {
  it("exposes id and version", () => {
    assert.equal(mockWorkspacePlugin.id, MOCK_WORKSPACE_PLUGIN_ID);
    assert.equal(mockWorkspacePlugin.version, 1);
  });

  it("satisfies WorkspacePlugin structural guard", () => {
    assert.equal(isWorkspacePlugin(mockWorkspacePlugin), true);
  });

  it("serves general profile only", () => {
    assert.deepEqual(mockWorkspacePlugin.supportedProfiles, ["general"]);
    assert.equal(resolveWorkspacePluginIdForProfile("general"), MOCK_WORKSPACE_PLUGIN_ID);
    assert.equal(resolveWorkspacePluginIdForProfile("urban_event"), null);
  });

  it("applies default rule cell overrides", () => {
    const cell = getWorkspaceRuleCell(mockWorkspacePlugin.ruleSet, "default");
    assert.ok(cell);
    assert.equal(cell.fieldOverrides.length, 2);
  });

  it("validation hooks are no-op", () => {
    assert.equal(noopWorkspaceValidationHooks.checkCapacity(10), null);
    assert.equal(noopWorkspaceValidationHooks.checkTripDetails({}), null);
  });
});

describe("CanonicalDocument", () => {
  it("rejects data keys outside roots", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: {}, extra: {} },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_ROOT_UNKNOWN");
        return true;
      },
    );
  });

  it("accepts document when all data keys are rooted", () => {
    const doc = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "A" }, details: {} },
    });
    assert.equal(doc.schemaVersion, 1);
    assert.equal(Object.keys(doc.data).length, 2);
  });
});
