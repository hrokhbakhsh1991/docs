import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  gregorianToJalaali,
  isJalaaliLeapYear,
  jalaaliMonthLength,
  jalaaliToGregorian,
} from "../src/jalaali-calendar";
import { isoToJalaali, jalaaliToIso } from "../src/calendar-format";

describe("jalaali-calendar (LC-CAL)", () => {
  it("LC-CAL-07 Nowruz 1405 round-trips to Gregorian ISO", () => {
    const { jy, jm, jd } = gregorianToJalaali(2026, 3, 21);
    assert.deepEqual({ jy, jm, jd }, { jy: 1405, jm: 1, jd: 1 });
    assert.deepEqual(jalaaliToGregorian(1405, 1, 1), { gy: 2026, gm: 3, gd: 21 });
    assert.equal(jalaaliToIso(1405, 1, 1), "2026-03-21");
    assert.deepEqual(isoToJalaali("2026-03-21"), { jy: 1405, jm: 1, jd: 1 });
  });

  it("LC-CAL-08 mid-year civil day round-trips", () => {
    const iso = "2026-08-16";
    const jalali = isoToJalaali(iso);
    assert.ok(jalali);
    assert.equal(jalaaliToIso(jalali.jy, jalali.jm, jalali.jd), iso);
  });

  it("LC-CAL-09 rejects dates that do not exist in Jalali", () => {
    assert.throws(() => jalaaliToGregorian(1405, 13, 1), RangeError);
    assert.throws(() => jalaaliToGregorian(1405, 1, 32), RangeError);
    if (!isJalaaliLeapYear(1404)) {
      assert.equal(jalaaliMonthLength(1404, 12), 29);
      assert.throws(() => jalaaliToGregorian(1404, 12, 30), RangeError);
    }
  });

  it("LC-CAL-10 empty value helpers stay safe", () => {
    assert.equal(isoToJalaali(""), null);
    assert.equal(isoToJalaali("   "), null);
  });
});
