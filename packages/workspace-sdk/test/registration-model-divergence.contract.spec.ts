import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_REGISTRATION_MODEL,
  registrationAwaitingOperatorDecision,
  registrationOccupiesSeat,
  registrationQueuedWithoutSeat,
  registrationTerminalNegative,
  registrationVoided,
  URBAN_REGISTRATION_MODEL,
} from "../src/registration/registration-model-divergence.contract.ts";

describe("registration-model-divergence.contract (CW4-05 / DEC-CW-01 Option B)", () => {
  it("CW4-05-01 booking model preserves operator_registrations vocabulary", () => {
    assert.equal(BOOKING_REGISTRATION_MODEL.persistenceTable, "operator_registrations");
    assert.equal(BOOKING_REGISTRATION_MODEL.capacityConsumingStatus, "approved");
    assert.deepEqual(BOOKING_REGISTRATION_MODEL.vocabulary, [
      "pending",
      "approved",
      "waitlisted",
      "rejected",
      "cancelled",
    ]);
    assert.equal(BOOKING_REGISTRATION_MODEL.strategy, "operatorApproval");
    assert.equal(BOOKING_REGISTRATION_MODEL.lifecycleProfile, "bookingPipeline");
  });

  it("CW4-05-02 urban model preserves urban_registrations vocabulary", () => {
    assert.equal(URBAN_REGISTRATION_MODEL.persistenceTable, "urban_registrations");
    assert.equal(URBAN_REGISTRATION_MODEL.capacityConsumingStatus, "confirmed");
    assert.deepEqual(URBAN_REGISTRATION_MODEL.vocabulary, ["confirmed", "waitlist", "cancelled"]);
    assert.equal(URBAN_REGISTRATION_MODEL.strategy, "atCreate");
    assert.equal(URBAN_REGISTRATION_MODEL.lifecycleProfile, "atCreateTerminal");
  });

  it("CW4-05-03 neutral predicates use native strings without normalization", () => {
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "approved"), true);
    assert.equal(registrationOccupiesSeat(BOOKING_REGISTRATION_MODEL, "confirmed"), false);
    assert.equal(registrationOccupiesSeat(URBAN_REGISTRATION_MODEL, "confirmed"), true);
    assert.equal(registrationOccupiesSeat(URBAN_REGISTRATION_MODEL, "approved"), false);

    assert.equal(registrationQueuedWithoutSeat(BOOKING_REGISTRATION_MODEL, "waitlisted"), true);
    assert.equal(registrationQueuedWithoutSeat(BOOKING_REGISTRATION_MODEL, "waitlist"), false);
    assert.equal(registrationQueuedWithoutSeat(URBAN_REGISTRATION_MODEL, "waitlist"), true);
    assert.equal(registrationQueuedWithoutSeat(URBAN_REGISTRATION_MODEL, "waitlisted"), false);

    assert.equal(registrationAwaitingOperatorDecision(BOOKING_REGISTRATION_MODEL, "pending"), true);
    assert.equal(registrationAwaitingOperatorDecision(URBAN_REGISTRATION_MODEL, "pending"), false);

    assert.equal(registrationTerminalNegative(BOOKING_REGISTRATION_MODEL, "rejected"), true);
    assert.equal(registrationTerminalNegative(URBAN_REGISTRATION_MODEL, "rejected"), false);

    assert.equal(registrationVoided(BOOKING_REGISTRATION_MODEL, "cancelled"), true);
    assert.equal(registrationVoided(URBAN_REGISTRATION_MODEL, "cancelled"), true);
  });

  it("CW4-05-04 negative: approved and confirmed remain distinct wire strings", () => {
    assert.notEqual(
      BOOKING_REGISTRATION_MODEL.capacityConsumingStatus,
      URBAN_REGISTRATION_MODEL.capacityConsumingStatus,
    );
    assert.ok(!BOOKING_REGISTRATION_MODEL.vocabulary.includes("confirmed"));
    assert.ok(!URBAN_REGISTRATION_MODEL.vocabulary.includes("approved"));
  });
});
