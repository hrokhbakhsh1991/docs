import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DATETIME_LOCAL_INVENTED_MIDNIGHT,
  isUnsetOrInventedMidnightClock,
  joinDatetimeLocal,
  repairInventedMidnightDatetimeLocal,
  resolveDatetimePickerTimeForDateCommit,
} from "../src/ui/adapters/datetime-format.ts";

describe("datetime-format end-date inherit (ED-DT-END-01)", () => {
  it("uses own non-midnight clock when present", () => {
    assert.equal(resolveDatetimePickerTimeForDateCommit("18:30", "06:00"), "18:30");
  });

  it("inherits fallback when own clock empty", () => {
    assert.equal(resolveDatetimePickerTimeForDateCommit("", "06:00"), "06:00");
    assert.equal(resolveDatetimePickerTimeForDateCommit("  ", "06:00"), "06:00");
  });

  it("treats invented midnight as unset when fallback is non-midnight", () => {
    assert.equal(isUnsetOrInventedMidnightClock(DATETIME_LOCAL_INVENTED_MIDNIGHT, "06:00"), true);
    assert.equal(resolveDatetimePickerTimeForDateCommit("00:00", "06:00"), "06:00");
  });

  it("keeps midnight when fallback is also midnight or missing", () => {
    assert.equal(resolveDatetimePickerTimeForDateCommit("00:00", "00:00"), "00:00");
    assert.equal(resolveDatetimePickerTimeForDateCommit("00:00", undefined), "00:00");
  });

  it("date commit with fallback avoids midnight invent", () => {
    const time = resolveDatetimePickerTimeForDateCommit("", "06:00");
    assert.equal(joinDatetimeLocal("2026-08-13", time), "2026-08-13T06:00");
  });

  it("empty own+fallback still allows join to default invented midnight", () => {
    const time = resolveDatetimePickerTimeForDateCommit("", undefined);
    assert.equal(joinDatetimeLocal("2026-08-13", time), "2026-08-13T00:00");
  });

  it("repairs stored invented midnight end wall against start clock", () => {
    assert.equal(
      repairInventedMidnightDatetimeLocal("2026-08-18T00:00", "2026-08-15T06:00"),
      "2026-08-18T06:00"
    );
    assert.equal(repairInventedMidnightDatetimeLocal("2026-08-18T18:30", "2026-08-15T06:00"), null);
  });
});
