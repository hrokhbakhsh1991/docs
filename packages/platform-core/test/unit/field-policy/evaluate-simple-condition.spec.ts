import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateSimpleCondition } from "../../../src/field-policy/evaluate-simple-condition.js";

describe("evaluateSimpleCondition", () => {
  it("treats missing and always conditions as matched", () => {
    assert.equal(evaluateSimpleCondition(undefined, {}), true);
    assert.equal(evaluateSimpleCondition({ kind: "always" }, {}), true);
  });

  it("evaluates equals against nested entity state paths", () => {
    const state = { tour: { status: "published", capacity: 12 } };

    assert.equal(
      evaluateSimpleCondition(
        { kind: "equals", path: "tour.status", value: "published" },
        state,
      ),
      true,
    );
    assert.equal(
      evaluateSimpleCondition({ kind: "equals", path: "tour.capacity", value: 10 }, state),
      false,
    );
  });

  it("evaluates exists without treating falsy values as missing", () => {
    const state = { payment: { completed: false, reference: null } };

    assert.equal(
      evaluateSimpleCondition({ kind: "exists", path: "payment.completed" }, state),
      true,
    );
    assert.equal(
      evaluateSimpleCondition({ kind: "exists", path: "payment.reference" }, state),
      true,
    );
    assert.equal(
      evaluateSimpleCondition({ kind: "exists", path: "payment.missing" }, state),
      false,
    );
  });
});
