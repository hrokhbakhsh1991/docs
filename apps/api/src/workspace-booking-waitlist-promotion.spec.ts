import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWorkspaceBookingWaitlistPromotion } from "./workspace-booking-waitlist-promotion.ts";

describe("workspace Booking waitlist promotion composition", () => {
  it("binds Denali's reconciliation only to Denali runtimes", () => {
    assert.equal(
      typeof resolveWorkspaceBookingWaitlistPromotion(" DENALI ")?.afterCapacityChange,
      "function"
    );
    assert.equal(resolveWorkspaceBookingWaitlistPromotion("booking-ws2"), undefined);
    assert.equal(resolveWorkspaceBookingWaitlistPromotion(""), undefined);
  });
});
