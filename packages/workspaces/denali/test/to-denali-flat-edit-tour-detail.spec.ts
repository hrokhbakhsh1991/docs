import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDenaliFlatEditTourDetail } from "../src/ui/chrome/to-denali-flat-edit-tour-detail.ts";

describe("toDenaliFlatEditTourDetail", () => {
  it("maps acceptedCount/totalCapacity onto flat-edit projection fields", () => {
    const detail = toDenaliFlatEditTourDetail({
      projection: {
        title: "Alborz trek",
        uiStatus: "active",
        priceAmount: 1_500_000,
        priceCurrency: "IRR",
        departureAt: "2026-08-01T06:00:00.000Z",
        acceptedCount: 4,
        totalCapacity: 12,
      },
    });

    assert.equal(detail.projection.title, "Alborz trek");
    assert.equal(detail.projection.uiStatus, "active");
    assert.equal(detail.projection.acceptedSeats, 4);
    assert.equal(detail.projection.capacity, 12);
    assert.equal(detail.projection.priceAmount, 1_500_000);
  });
});
