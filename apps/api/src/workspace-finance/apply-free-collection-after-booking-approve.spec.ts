import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyFreeCollectionAfterBookingApprove } from "./apply-free-collection-after-booking-approve.ts";

const BOOKING_WS2_TENANT_ID = "00000000-0000-4000-8000-000000000015";

describe("applyFreeCollectionAfterBookingApprove", () => {
  it("skips unsupported finance workspaces without breaking booking approval", async () => {
    await assert.doesNotReject(() =>
      applyFreeCollectionAfterBookingApprove({
        tenantId: BOOKING_WS2_TENANT_ID,
        bookingId: "00000000-0000-4000-8000-000000009999",
      })
    );
  });
});
