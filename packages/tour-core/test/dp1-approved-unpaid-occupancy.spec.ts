/**
 * DP1-G — approved-unpaid occupancy invariant (DEN-PROD-02).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  registrationOccupiesSeat,
  BOOKING_REGISTRATION_MODEL,
} from "../src/registration/registration-model.contract.ts";

describe("DP1-G approved-unpaid occupancy", () => {
  it("S5 DEN-PROD-02: only approved status occupies seats for booking model", () => {
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "approved"), true);
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "pending"), false);
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "waitlisted"), false);
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "cancelled"), false);
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "rejected"), false);
  });

  it("S5: cancelled after expiry does not occupy", () => {
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "cancelled"), false);
  });
});
