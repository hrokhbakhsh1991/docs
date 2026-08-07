import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseBookingsSummaryQuery } from "../src/booking-request.parsers.ts";

describe("booking-summary-query.spec.ts — P4c", () => {
  it("defaults tourChipScope to ops", () => {
    assert.deepEqual(parseBookingsSummaryQuery(new URL("http://x/bookings/summary")), {
      tourChipScope: "ops",
    });
    assert.deepEqual(
      parseBookingsSummaryQuery(new URL("http://x/bookings/summary?tourChipScope=ops")),
      { tourChipScope: "ops" }
    );
  });

  it("accepts tourChipScope=all", () => {
    assert.deepEqual(
      parseBookingsSummaryQuery(new URL("http://x/bookings/summary?tourChipScope=all")),
      { tourChipScope: "all" }
    );
    assert.deepEqual(
      parseBookingsSummaryQuery(new URL("http://x/bookings/summary?tourChipScope=ALL")),
      { tourChipScope: "all" }
    );
  });
});
