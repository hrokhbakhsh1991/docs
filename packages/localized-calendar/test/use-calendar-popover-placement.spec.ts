import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type CalendarPopoverPlacement,
  useCalendarPopoverPlacement,
} from "../src/use-calendar-popover-placement";

describe("useCalendarPopoverPlacement (LC-PLACEMENT)", () => {
  it("LC-PLACEMENT-01 exports top and bottom placement types", () => {
    const placements: CalendarPopoverPlacement[] = ["top", "bottom"];
    assert.equal(placements.length, 2);
    assert.equal(typeof useCalendarPopoverPlacement, "function");
  });
});
