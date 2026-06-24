import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGregorianMonthGrid,
  buildPersianMonthGrid,
  canShiftViewMonthBackward,
  compareIsoDates,
  formatCalendarMonthName,
  isCalendarMonthBeforeMinIso,
  isCalendarYearBeforeMinIso,
  lastIsoDateInCalendarMonth,
} from "../src/ui/adapters/calendar-format";

describe("calendar-format.spec.ts", () => {
  it("DN-CAL-01 compareIsoDates orders YYYY-MM-DD lexically", () => {
    assert.equal(compareIsoDates("2026-06-22", "2026-06-23"), -1);
    assert.equal(compareIsoDates("2026-06-23", "2026-06-23"), 0);
    assert.equal(compareIsoDates("2026-06-24", "2026-06-23"), 1);
  });

  it("DN-CAL-02 gregorian month grid marks days before min as disabled", () => {
    const cells = buildGregorianMonthGrid(2026, 6, "", "2026-06-23", "2026-06-23");
    const june22 = cells.find((cell) => cell.iso === "2026-06-22");
    const june23 = cells.find((cell) => cell.iso === "2026-06-23");
    assert.equal(june22?.isDisabled, true);
    assert.equal(june23?.isDisabled, false);
  });

  it("DN-CAL-03 persian month grid marks days before min as disabled", () => {
    const cells = buildPersianMonthGrid(1405, 4, "", "2026-06-23", "2026-06-23");
    const beforeMin = cells.find((cell) => cell.iso === "2026-06-22");
    const onMin = cells.find((cell) => cell.iso === "2026-06-23");
    assert.equal(beforeMin?.isDisabled, true);
    assert.equal(onMin?.isDisabled, false);
  });

  it("DN-CAL-04 month and year before-min helpers respect locale calendar", () => {
    assert.equal(isCalendarMonthBeforeMinIso(2026, 5, "en", "2026-06-23"), true);
    assert.equal(isCalendarMonthBeforeMinIso(2026, 6, "en", "2026-06-23"), false);
    assert.equal(isCalendarYearBeforeMinIso(2025, "en", "2026-06-23"), true);
    assert.equal(isCalendarYearBeforeMinIso(2026, "en", "2026-06-23"), false);
    assert.equal(lastIsoDateInCalendarMonth(1405, 4, "fa").length, 10);
    assert.equal(formatCalendarMonthName(4, "fa"), "تیر");
  });

  it("DN-CAL-05 cannot shift to previous month when entirely before min", () => {
    assert.equal(canShiftViewMonthBackward(2026, 6, "en", "2026-06-23"), false);
    assert.equal(canShiftViewMonthBackward(2026, 7, "en", "2026-06-23"), true);
  });
});
