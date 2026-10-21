import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readPersonalCarOccupantsFromIntake,
  readTransportKindFromIntake,
  toBookingCapacityTransportFact,
} from "./read-transport-kind-from-intake.js";

describe("read-transport-kind-from-intake", () => {
  it("reads known transport kinds", () => {
    assert.equal(readTransportKindFromIntake({ transport: { kind: "primary" } }), "primary");
    assert.equal(
      readTransportKindFromIntake({ transport: { kind: "personal_car", personalCarOccupants: 2 } }),
      "personal_car"
    );
    assert.equal(
      readTransportKindFromIntake({ transport: { kind: "no_car_dong" } }),
      "no_car_dong"
    );
    assert.equal(
      readTransportKindFromIntake({ transport: { kind: "no_car_acquaintance" } }),
      "no_car_acquaintance"
    );
  });

  it("returns null for missing / unknown", () => {
    assert.equal(readTransportKindFromIntake(undefined), null);
    assert.equal(readTransportKindFromIntake({}), null);
    assert.equal(readTransportKindFromIntake({ transport: { kind: "van" } }), null);
  });

  it("reads personalCarOccupants 0|1|2|3 and rejects other values", () => {
    assert.equal(
      readPersonalCarOccupantsFromIntake({
        transport: { kind: "personal_car", personalCarOccupants: 0 },
      }),
      0
    );
    assert.equal(
      readPersonalCarOccupantsFromIntake({
        transport: { kind: "personal_car", personalCarOccupants: 3 },
      }),
      3
    );
    assert.equal(
      readPersonalCarOccupantsFromIntake({
        transport: { kind: "personal_car", personalCarOccupants: 4 },
      }),
      null
    );
    assert.equal(readPersonalCarOccupantsFromIntake({ transport: { kind: "primary" } }), null);
  });

  it("projects only the approved capacity facts, never the full intake", () => {
    assert.deepEqual(
      toBookingCapacityTransportFact({
        partySize: 2,
        registrationIntake: {
          registrantTarget: "other",
          nationalId: "sensitive",
          transport: { kind: "personal_car", personalCarOccupants: 3 },
        },
      }),
      {
        partySize: 2,
        transportKind: "personal_car",
        offeredPassengerSeats: 3,
      }
    );
    assert.deepEqual(toBookingCapacityTransportFact({ partySize: 1, registrationIntake: null }), {
      partySize: 1,
      transportKind: null,
      offeredPassengerSeats: null,
    });
  });
});
