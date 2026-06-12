/**
 * Denali time picker helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  joinClockParts,
  listTimePickerMinutes,
  snapMinuteToPickerStep,
  splitClockValue,
  TIME_PICKER_MINUTE_STEP,
} from "../src/components/i18n/time-picker-logic";

describe("denali-time-input-logic.spec.ts", () => {
  it("WEB-DENALI-TIME-01 splits and joins HH:mm", () => {
    assert.deepEqual(splitClockValue("14:30"), { hours: "14", minutes: "30" });
    assert.equal(joinClockParts("9", "5"), "09:05");
    assert.equal(joinClockParts("", ""), "");
  });

  it("WEB-DENALI-TIME-02 snaps minutes to picker step", () => {
    assert.equal(TIME_PICKER_MINUTE_STEP, 5);
    assert.equal(snapMinuteToPickerStep("7"), "05");
    assert.equal(snapMinuteToPickerStep("58"), "55");
    assert.deepEqual(splitClockValue("14:07"), { hours: "14", minutes: "05" });
  });

  it("WEB-DENALI-TIME-03 lists five-minute minute options", () => {
    const minutes = listTimePickerMinutes();
    assert.equal(minutes.length, 12);
    assert.equal(minutes[0], "00");
    assert.equal(minutes.at(-1), "55");
  });
});
