import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { testStarterFieldRegistry } from "../../fixtures/starter.fixture.js";
import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { FieldRegistryEngine } from "../../../src/engine/field-registry.engine.js";
import { MAX_ALLOWED_REGISTRY_FIELDS } from "../../../src/engine/rule-cell-limits.js";

describe("FieldRegistryEngine", () => {
  it("getById returns entry when found", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    const field = engine.getById("basics.title");
    assert.ok(field);
    assert.equal(field.id, "basics.title");
    assert.equal(field.stepId, "basics");
  });

  it("getById returns undefined when not found", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    assert.equal(engine.getById("missing"), undefined);
  });

  it("listByStep filters by stepId preserving registry order", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    const basics = engine.listByStep("basics");
    assert.equal(basics.length, 2);
    assert.equal(basics[0]?.id, "basics.title");
    assert.equal(basics[1]?.id, "basics.featured");

    const details = engine.listByStep("details");
    assert.equal(details.length, 2);
    assert.equal(details[0]?.id, "details.summary");
    assert.equal(details[1]?.id, "details.status");
  });

  it("getById returns entry for registry field id", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    const field = engine.getById("details.summary");
    assert.ok(field);
    assert.equal(field.canonicalPath, "details.summary");
  });

  it("tryAssertKnownFieldIds returns UNKNOWN_FIELD_ID for orphan ids", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    const result = engine.tryAssertKnownFieldIds(["orphan.id"]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "UNKNOWN_FIELD_ID");
    }
  });

  it("assertKnownFieldIds throws UNKNOWN_FIELD_ID for orphan ids", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    assert.throws(
      () => engine.assertKnownFieldIds(["orphan.id"]),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "UNKNOWN_FIELD_ID");
        return true;
      },
    );
  });

  it("tryCreate fails REGISTRY_CARDINALITY_VIOLATION when fields exceed limit", () => {
    const fields = Array.from({ length: MAX_ALLOWED_REGISTRY_FIELDS + 1 }, (_, i) => ({
      id: `field-${i}`,
      canonicalPath: `field-${i}`,
      stepId: "step",
      kind: "text" as const,
      required: false,
    }));
    const result = FieldRegistryEngine.tryCreate({ version: 1, fields });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "REGISTRY_CARDINALITY_VIOLATION");
    }
  });

  it("constructor throws DUPLICATE_FIELD_ID when ids repeat", () => {
    assert.throws(
      () =>
        FieldRegistryEngine.create({
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
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "DUPLICATE_FIELD_ID");
        return true;
      },
    );
  });

  it("listAll returns empty array for empty registry", () => {
    const engine = FieldRegistryEngine.create({ version: 1, fields: [] });
    assert.deepEqual(engine.listAll(), []);
    assert.equal(engine.listByStep("any").length, 0);
  });
});
