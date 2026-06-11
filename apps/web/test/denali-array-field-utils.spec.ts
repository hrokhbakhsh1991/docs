import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseStringArray } from "../src/wizard/denali/denali-array-field-utils";
import { normalizeApproximateReturnTime } from "../src/wizard/denali/denali-datetime-utils";

describe("denali-array-field-utils.spec.ts", () => {
  it("WEB-DENALI-ARR-01 parses string arrays from draft values", () => {
    assert.deepEqual(parseStringArray(["a", " b ", "", 1]), ["a", "b"]);
    assert.deepEqual(parseStringArray(undefined), []);
  });

  it("WEB-DENALI-ARR-02 normalizes approximate return time to HH:mm", () => {
    assert.equal(normalizeApproximateReturnTime("9:5"), "09:05");
    assert.equal(normalizeApproximateReturnTime("18:30"), "18:30");
    assert.equal(normalizeApproximateReturnTime(""), "");
  });
});
