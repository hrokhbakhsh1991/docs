/**
 * Localized datetime picker value helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDatetimeLocalLabel,
  isoToDatetimeLocalInput,
  joinDatetimeLocal,
  normalizeClockTime,
  splitDatetimeLocal,
} from "../src/i18n/datetime-format";

describe("datetime-format.spec.ts", () => {
  it("WEB-DT-01 splits and joins datetime-local values", () => {
    assert.deepEqual(splitDatetimeLocal("2026-06-10T14:30"), {
      date: "2026-06-10",
      time: "14:30",
    });
    assert.equal(joinDatetimeLocal("2026-06-10", "14:30"), "2026-06-10T14:30");
  });

  it("WEB-DT-02 normalizes clock time to HH:mm", () => {
    assert.equal(normalizeClockTime("9:5"), "09:05");
  });

  it("WEB-DT-03 formats Persian datetime label", () => {
    const label = formatDatetimeLocalLabel("2026-03-21T09:15", "fa");
    assert.match(label, /فروردین/);
    assert.match(label, /۰۹:۱۵/);
  });

  it("WEB-DT-04 isoToDatetimeLocalInput is stable across server/browser timezones", () => {
    const iso = "2026-08-15T02:30:00.000Z";
    const local = isoToDatetimeLocalInput(iso);
    assert.equal(local, "2026-08-15T06:00");
  });
});
