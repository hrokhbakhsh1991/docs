import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  joinClockParts,
  resolveTimePickerDraft,
  snapMinuteToPickerStep,
  splitClockValue,
} from "../src/ui/components/time/time-picker-logic";

describe("time-picker-logic.spec.ts", () => {
  it("DN-TIME-01 snaps minutes to five-minute picker step", () => {
    assert.equal(snapMinuteToPickerStep("07"), "05");
    assert.equal(snapMinuteToPickerStep("58"), "55");
  });

  it("DN-TIME-02 resolveTimePickerDraft seeds empty value with fallback", () => {
    assert.equal(resolveTimePickerDraft(""), "09:00");
    assert.equal(resolveTimePickerDraft("  "), "09:00");
  });

  it("DN-TIME-03 resolveTimePickerDraft normalizes stored clock", () => {
    assert.equal(resolveTimePickerDraft("14:07"), "14:05");
    assert.equal(joinClockParts("8", "3"), "08:05");
    assert.deepEqual(splitClockValue("14:07"), { hours: "14", minutes: "05" });
  });
});
