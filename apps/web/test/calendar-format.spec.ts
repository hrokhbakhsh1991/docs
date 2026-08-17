/**
 * Persian calendar formatting and Jalali conversion
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatIsoDateLabel,
  isoToJalaali,
  jalaaliToIso,
  parseIsoDate,
  toIsoDate,
} from "../src/i18n/calendar-format";
import { gregorianToJalaali, jalaaliToGregorian } from "../src/i18n/jalaali-calendar";

describe("calendar-format.spec.ts", () => {
  it("WEB-CAL-01 round-trips Gregorian ISO through Jalali", () => {
    const iso = "2026-03-21";
    const jalali = isoToJalaali(iso);
    assert.ok(jalali);
    assert.equal(jalaaliToIso(jalali.jy, jalali.jm, jalali.jd), iso);
  });

  it("WEB-CAL-02 formats Persian date label with localized digits", () => {
    const label = formatIsoDateLabel("2026-03-21", "fa");
    assert.match(label, /۱۴۰۵/);
    assert.match(label, /فروردین/);
  });

  it("WEB-CAL-03 converts Nowruz anchor date", () => {
    const { jy, jm, jd } = gregorianToJalaali(2026, 3, 21);
    assert.equal(jy, 1405);
    assert.equal(jm, 1);
    assert.equal(jd, 1);
    const back = jalaaliToGregorian(jy, jm, jd);
    assert.deepEqual(back, { gy: 2026, gm: 3, gd: 21 });
  });

  it("WEB-CAL-05 persian-year view still serializes Gregorian ISO (INV-DENALI-CAL-01)", () => {
    assert.equal(jalaaliToIso(1405, 5, 25), "2026-08-16");
    assert.doesNotMatch(jalaaliToIso(1405, 5, 25), /^1405-/);
  });

  it("WEB-CAL-04 parses and serializes ISO dates", () => {
    assert.deepEqual(parseIsoDate("2026-06-10"), { year: 2026, month: 6, day: 10 });
    assert.equal(toIsoDate({ year: 2026, month: 6, day: 10 }), "2026-06-10");
  });
});
