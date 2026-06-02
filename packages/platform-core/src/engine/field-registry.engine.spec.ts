import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { starterFieldRegistry } from "../__fixtures__/starter.fixture";
import { PlatformCoreError } from "../errors/platform-core.error";
import { FieldRegistryEngine } from "./field-registry.engine";

describe("FieldRegistryEngine", () => {
  it("getById returns entry when found", () => {
    const engine = new FieldRegistryEngine(starterFieldRegistry);
    const field = engine.getById("basics.title");
    assert.ok(field);
    assert.equal(field.id, "basics.title");
    assert.equal(field.stepId, "basics");
  });

  it("getById returns undefined when not found", () => {
    const engine = new FieldRegistryEngine(starterFieldRegistry);
    assert.equal(engine.getById("missing"), undefined);
  });

  it("listByStep filters by stepId preserving registry order", () => {
    const engine = new FieldRegistryEngine(starterFieldRegistry);
    const basics = engine.listByStep("basics");
    assert.equal(basics.length, 1);
    assert.equal(basics[0]?.id, "basics.title");

    const details = engine.listByStep("details");
    assert.equal(details.length, 1);
    assert.equal(details[0]?.id, "details.summary");
  });

  it("getByCanonicalPath returns entry on exact path match", () => {
    const engine = new FieldRegistryEngine(starterFieldRegistry);
    const field = engine.getByCanonicalPath("details.summary");
    assert.ok(field);
    assert.equal(field.canonicalPath, "details.summary");
  });

  it("assertKnownFieldIds throws UNKNOWN_FIELD_ID for orphan ids", () => {
    const engine = new FieldRegistryEngine(starterFieldRegistry);
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
        new FieldRegistryEngine({
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
    const engine = new FieldRegistryEngine({ version: 1, fields: [] });
    assert.deepEqual(engine.listAll(), []);
    assert.equal(engine.listByStep("any").length, 0);
  });
});
