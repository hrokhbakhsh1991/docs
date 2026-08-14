import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readPersonalCarOccupantsFromIntake,
  readTransportKindFromIntake,
} from "./read-transport-kind-from-intake.js";

describe("read-transport-kind-from-intake", () => {
  it("reads known transport kinds", () => {
    assert.equal(readTransportKindFromIntake({ transport: { kind: "primary" } }), "primary");
    assert.equal(
      readTransportKindFromIntake({ transport: { kind: "personal_car", personalCarOccupants: 2 } }),
      "personal_car"
    );
    assert.equal(readTransportKindFromIntake({ transport: { kind: "no_car_dong" } }), "no_car_dong");
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

  it("reads personalCarOccupants only for 1|2|3", () => {
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
});
