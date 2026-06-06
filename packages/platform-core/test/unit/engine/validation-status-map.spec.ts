import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createViolationCollector } from "../../../src/engine/validation-status-map.js";

describe("createViolationCollector", () => {
  it("finalize returns frozen empty success when no violations were recorded", () => {
    const collector = createViolationCollector();
    const result = collector.finalize();
    assert.equal(result.ok, true);
    assert.deepEqual(result.violations, []);
    assert.throws(
      () => {
        (result.violations as { push: (v: unknown) => number }).push({
          code: "MUTATION",
          message: "must not stick",
        });
      },
      (error: unknown) => {
        assert.ok(error instanceof TypeError);
        return true;
      }
    );
  });

  it("returns a fresh frozen success object on each finalize with no violations", () => {
    const first = createViolationCollector().finalize();
    const second = createViolationCollector().finalize();
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    assert.throws(
      () => {
        (first.violations as { push: (v: unknown) => number }).push({
          code: "MUTATION",
          message: "must not stick",
        });
      },
      (error: unknown) => {
        assert.ok(error instanceof TypeError);
        return true;
      }
    );
    assert.deepEqual(second.violations, []);
  });

  it("dedupes violations by fieldId on record", () => {
    const collector = createViolationCollector();
    collector.record("REQUIRED_FIELD_EMPTY", "basics.title", "first");
    collector.record("CANONICAL_TYPE_MISMATCH", "basics.title", "second");
    const result = collector.finalize();
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.code, "REQUIRED_FIELD_EMPTY");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });
});
