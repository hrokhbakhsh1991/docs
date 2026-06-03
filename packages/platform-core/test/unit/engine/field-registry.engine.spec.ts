import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { testStarterFieldRegistry } from "../../fixtures/starter.fixture.js";
import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { FieldRegistryEngine } from "../../../src/engine/field-registry.engine.js";

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
    assert.equal(basics.length, 1);
    assert.equal(basics[0]?.id, "basics.title");

    const details = engine.listByStep("details");
    assert.equal(details.length, 1);
    assert.equal(details[0]?.id, "details.summary");
  });

  it("getById returns entry for registry field id", () => {
    const engine = FieldRegistryEngine.create(testStarterFieldRegistry());
    const field = engine.getById("details.summary");
    assert.ok(field);
    assert.equal(field.canonicalPath, "details.summary");
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
