import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWorkspacePlugin,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  getWorkspaceRuleCell,
  isWorkspacePlugin,
  isWorkspaceTypeId,
  parseCanonicalDocumentFromStorage,
  parseWorkspacePluginFromStorage,
  workspaceTypesFromPlugin,
  noopWorkspaceValidationHooks,
  resolveWorkspacePluginIdForType,
  STARTER_WORKSPACE_PLUGIN_ID,
  STARTER_WORKSPACE_TYPE,
  starterWorkspacePlugin,
  WorkspacePluginValidationError,
} from "./index";

describe("starterWorkspacePlugin", () => {
  it("exposes id and version", () => {
    assert.equal(starterWorkspacePlugin.id, STARTER_WORKSPACE_PLUGIN_ID);
    assert.equal(starterWorkspacePlugin.version, 1);
  });

  it("satisfies WorkspacePlugin structural guard", () => {
    assert.equal(isWorkspacePlugin(starterWorkspacePlugin), true);
  });

  it("serves starter workspace type only", () => {
    assert.deepEqual(starterWorkspacePlugin.supportedWorkspaceTypes, [STARTER_WORKSPACE_TYPE]);
    const allowed = workspaceTypesFromPlugin(starterWorkspacePlugin);
    assert.equal(isWorkspaceTypeId("starter", allowed), true);
    assert.equal(isWorkspaceTypeId("denali", allowed), false);
    assert.equal(resolveWorkspacePluginIdForType("starter"), STARTER_WORKSPACE_PLUGIN_ID);
    assert.equal(resolveWorkspacePluginIdForType("unknown"), null);
  });

  it("applies default rule cell overrides", () => {
    const cell = getWorkspaceRuleCell(starterWorkspacePlugin.ruleSet, "default");
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

  it("rejects duplicate roots", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics", "basics"],
          data: { basics: {} },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_DUPLICATE_ROOT");
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
    assert.equal(Object.isFrozen(doc.data), true);
    assert.equal(Object.isFrozen(doc.data.basics), true);
  });

  it("rejects BigInt in document data", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: { count: BigInt(1) } },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects non-plain object prototypes at ingress", () => {
    const exotic = Object.create(null);
    exotic.title = "ok";
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: exotic },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects accessor properties on document data", () => {
    const poisoned = {};
    Object.defineProperty(poisoned, "title", {
      get() {
        return "leak";
      },
      enumerable: true,
    });
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: poisoned },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects forbidden root keys", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["__proto__"],
          data: { __proto__: {} },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_ROOTS");
        return true;
      },
    );
  });

  it("rejects missing data bucket for declared root", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics", "details"],
          data: { basics: {} },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_ROOT_UNKNOWN");
        return true;
      },
    );
  });

  it("parseCanonicalDocumentFromStorage validates stored payloads", () => {
    const doc = parseCanonicalDocumentFromStorage({
      schemaVersion: 1,
      roots: ["basics"],
      data: { basics: { title: "ok" } },
    });
    assert.equal(doc.roots[0], "basics");
  });

  it("parseWorkspacePluginFromStorage validates plugins", () => {
    const plugin = parseWorkspacePluginFromStorage(starterWorkspacePlugin);
    assert.equal(plugin.id, STARTER_WORKSPACE_PLUGIN_ID);
  });
});

describe("assertWorkspacePlugin path segments", () => {
  it("rejects forbidden canonical path segments in field registry", () => {
    const badPlugin = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "evil",
            canonicalPath: "basics.__proto__.title",
            stepId: "basics",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(badPlugin),
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginValidationError);
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });
});
