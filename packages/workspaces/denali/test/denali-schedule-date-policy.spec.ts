import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliIsoDateSelectable,
  isDenaliTourStartDatetimeBeforeMin,
  isDenaliTourStartGrandfatheredPastBaseline,
  resolveDenaliDatetimeFieldMinIsoDate,
  resolveDenaliTourStartMinIsoDate,
} from "../src/ui/logic/denali-schedule-date-policy";

describe("denali-schedule-date-policy.spec.ts", () => {
  const referenceDate = new Date(2026, 5, 23, 12, 0, 0);

  it("DN-SCHED-DATE-01 tour start min date resolves to reference local today", () => {
    assert.equal(resolveDenaliTourStartMinIsoDate(referenceDate), "2026-06-23");
  });

  it("DN-SCHED-DATE-02 only startDateTime canonical path gets min date", () => {
    assert.equal(resolveDenaliDatetimeFieldMinIsoDate("startDateTime", referenceDate), "2026-06-23");
    assert.equal(resolveDenaliDatetimeFieldMinIsoDate("endDateTime", referenceDate), undefined);
  });

  it("DN-SCHED-DATE-03 past iso dates are not selectable when min is today", () => {
    assert.equal(isDenaliIsoDateSelectable("2026-06-22", "2026-06-23"), false);
    assert.equal(isDenaliIsoDateSelectable("2026-06-23", "2026-06-23"), true);
    assert.equal(isDenaliIsoDateSelectable("2026-06-24", "2026-06-23"), true);
  });

  it("DN-SCHED-DATE-04 tour start datetime before local today is rejected", () => {
    const yesterdayLocal = new Date(2026, 5, 22, 23, 0, 0).toISOString();
    const todayMorningLocal = new Date(2026, 5, 23, 8, 0, 0).toISOString();
    assert.equal(
      isDenaliTourStartDatetimeBeforeMin(yesterdayLocal, "2026-06-23"),
      true
    );
    assert.equal(
      isDenaliTourStartDatetimeBeforeMin(todayMorningLocal, "2026-06-23"),
      false
    );
  });

  it("DN-SCHED-DATE-05 grandfather unchanged past start on edit (ED-DT-01)", () => {
    const pastStart = new Date(2026, 5, 1, 8, 0, 0).toISOString();
    const sameDayLater = new Date(2026, 5, 1, 18, 0, 0).toISOString();
    const differentPast = new Date(2026, 5, 2, 8, 0, 0).toISOString();
    assert.equal(
      isDenaliTourStartGrandfatheredPastBaseline(pastStart, pastStart, "2026-06-23"),
      true
    );
    assert.equal(
      isDenaliTourStartGrandfatheredPastBaseline(sameDayLater, pastStart, "2026-06-23"),
      true
    );
    assert.equal(
      isDenaliTourStartGrandfatheredPastBaseline(differentPast, pastStart, "2026-06-23"),
      false
    );
    assert.equal(
      isDenaliTourStartGrandfatheredPastBaseline(pastStart, undefined, "2026-06-23"),
      false
    );
  });
});
