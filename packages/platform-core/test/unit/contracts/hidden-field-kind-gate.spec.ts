import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { passesHiddenFieldKindGate } from "../../../src/contracts/canonical-field-validation-contract.js";

describe("passesHiddenFieldKindGate", () => {
  it("returns false for undefined and null", () => {
    assert.equal(passesHiddenFieldKindGate(undefined, "text"), false);
    assert.equal(passesHiddenFieldKindGate(null, "text"), false);
  });

  it("text: false for whitespace-only, true for non-empty trim", () => {
    assert.equal(passesHiddenFieldKindGate("  ", "text"), false);
    assert.equal(passesHiddenFieldKindGate("ok", "text"), true);
  });

  it("number: non-null primitives pass gate (finiteness enforced later)", () => {
    assert.equal(passesHiddenFieldKindGate(0, "number"), true);
    assert.equal(passesHiddenFieldKindGate(Number.NaN, "number"), true);
    assert.equal(passesHiddenFieldKindGate("1", "number"), true);
  });

  it("boolean: true for true and false", () => {
    assert.equal(passesHiddenFieldKindGate(true, "boolean"), true);
    assert.equal(passesHiddenFieldKindGate(false, "boolean"), true);
  });

  it("date: non-null string passes gate (ISO validity enforced later)", () => {
    assert.equal(passesHiddenFieldKindGate("2026-01-01", "date"), true);
    assert.equal(passesHiddenFieldKindGate("short", "date"), true);
    assert.equal(passesHiddenFieldKindGate("", "date"), true);
  });

  it("enum: non-empty token shape (validity enforced later by assertCanonicalValueMatchesKind)", () => {
    const options = ["draft", "open"] as const;
    assert.equal(passesHiddenFieldKindGate("draft", "enum", options), true);
    assert.equal(passesHiddenFieldKindGate("  ", "enum", options), false);
    assert.equal(passesHiddenFieldKindGate("missing", "enum", options), true);
  });

  it("composite: true when object has keys", () => {
    assert.equal(passesHiddenFieldKindGate({}, "composite"), false);
    assert.equal(passesHiddenFieldKindGate({ a: 1 }, "composite"), true);
  });
});
