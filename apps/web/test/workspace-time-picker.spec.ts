/**
 * Workspace time picker segment helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClockTime,
  clampClockSegment,
  normalizeClockSegmentsOnBlur,
  parseClockSegments,
} from "../src/components/i18n/workspace-time-picker-utils";

describe("workspace-time-picker.spec.ts", () => {
  it("WEB-WTP-01 parses and builds clock segments", () => {
    assert.deepEqual(parseClockSegments("14:30"), { hours: "14", minutes: "30" });
    assert.equal(buildClockTime("9", "5"), "09:05");
    assert.equal(buildClockTime("", ""), "");
  });

  it("WEB-WTP-02 clamps segments on blur", () => {
    assert.equal(clampClockSegment("hours", "25"), "23");
    assert.equal(clampClockSegment("minutes", "99"), "59");
    assert.deepEqual(normalizeClockSegmentsOnBlur({ hours: "9", minutes: "5" }), {
      hours: "09",
      minutes: "05",
    });
  });
});
