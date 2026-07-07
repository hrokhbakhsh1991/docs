import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeDenaliRegistrationTransportIntake } from "../src/http/resolve-denali-registration-transport";

describe("resolve-denali-registration-transport", () => {
  it("DN-TR-01 defaults to primary for bus without opt-in", () => {
    const result = normalizeDenaliRegistrationTransportIntake(undefined, {
      transport: { mode: "bus", transportCostAmount: 100000 },
    });
    assert.deepEqual(result, { kind: "primary" });
  });

  it("DN-TR-02 shared_cars requires explicit transport choice", () => {
    assert.throws(() =>
      normalizeDenaliRegistrationTransportIntake(undefined, {
        transport: { mode: "shared_cars", dongAmount: 50000 },
      })
    );
  });

  it("DN-TR-03 no_car_dong adds dong validation", () => {
    const result = normalizeDenaliRegistrationTransportIntake(
      { kind: "no_car_dong" },
      { transport: { mode: "shared_cars", dongAmount: 50000 } }
    );
    assert.deepEqual(result, { kind: "no_car_dong" });
  });
});
