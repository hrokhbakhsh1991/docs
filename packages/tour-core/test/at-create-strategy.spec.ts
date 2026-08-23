import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  atCreateCapacityStrategy,
  resolveRegistrationCapacityDecision,
  sumAcceptedRegistrationSeats,
} from "../src/capacity/at-create-strategy";

describe("at-create capacity strategy (tour-core)", () => {
  it("REG-01 confirms when seats remain", () => {
    const decision = atCreateCapacityStrategy({
      tourCapacity: 10,
      acceptedSeats: 4,
      requestedPartySize: 2,
      policy: "open",
    });
    assert.equal(decision.kind, "accept");
    assert.equal(decision.status, "confirmed");
  });

  it("REG-01b unlimited capacity confirms", () => {
    const decision = atCreateCapacityStrategy({
      tourCapacity: null,
      acceptedSeats: 999,
      requestedPartySize: 5,
      policy: "open",
    });
    assert.equal(decision.kind, "accept");
  });

  it("REG-02 waitlists when full under waitlist policy", () => {
    const decision = atCreateCapacityStrategy({
      tourCapacity: 4,
      acceptedSeats: 4,
      requestedPartySize: 1,
      policy: "waitlist",
    });
    assert.equal(decision.kind, "waitlist");
    assert.equal(decision.status, "waitlist");
  });

  it("REG-02b open policy rejects when full", () => {
    const decision = atCreateCapacityStrategy({
      tourCapacity: 2,
      acceptedSeats: 2,
      requestedPartySize: 1,
      policy: "open",
    });
    assert.equal(decision.kind, "reject");
    assert.equal(decision.code, "REGISTRATION_CAPACITY_EXCEEDED");
  });

  it("policy closed rejects before capacity math", () => {
    const decision = atCreateCapacityStrategy({
      tourCapacity: 100,
      acceptedSeats: 0,
      requestedPartySize: 1,
      policy: "closed",
    });
    assert.equal(decision.kind, "reject");
    assert.equal(decision.code, "REGISTRATION_CLOSED");
  });

  it("sumAcceptedRegistrationSeats counts only confirmed rows", () => {
    assert.equal(
      sumAcceptedRegistrationSeats([
        { status: "confirmed", partySize: 2 },
        { status: "waitlist", partySize: 5 },
      ]),
      2
    );
  });

  it("resolveRegistrationCapacityDecision compat alias matches atCreateCapacityStrategy", () => {
    const input = {
      tourCapacity: 10,
      acceptedSeats: 4,
      requestedPartySize: 2,
      policy: "open" as const,
    };
    assert.deepEqual(resolveRegistrationCapacityDecision(input), atCreateCapacityStrategy(input));
  });
});
