import test from "node:test";
import fc from "fast-check";

import {
  isTourAtEffectiveCapacity,
  type EffectiveCapacityTourInput,
} from "../floating-capacity-engine";

/** Minimal tour shell — effective limit supplied via injected `resolve`. */
const STUB_TOUR: EffectiveCapacityTourInput = {
  totalCapacity: 0,
  capacityStrategy: "FIXED",
};

test("isTourAtEffectiveCapacity(accepted, capacity) === (accepted >= capacity)", () => {
  fc.assert(
    fc.property(fc.nat(), fc.nat(), (accepted, capacity) => {
      const atCapacity = isTourAtEffectiveCapacity(
        accepted,
        STUB_TOUR,
        {},
        () => capacity,
      );
      return atCapacity === (accepted >= capacity);
    }),
    { numRuns: 200 },
  );
});
