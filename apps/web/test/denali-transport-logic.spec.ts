import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliDongAmountVisible,
  isDenaliPersonalCarOptionVisible,
  isDenaliTransportCostVisible,
} from "@app-tour/workspace-denali/host/ui/logic/denali-transport-logic";

describe("denali-transport-logic.spec.ts", () => {
  it("WEB-DENALI-TR-01 shows transport cost for organized modes", () => {
    assert.equal(isDenaliTransportCostVisible("bus"), true);
    assert.equal(isDenaliTransportCostVisible("none"), false);
    assert.equal(isDenaliTransportCostVisible("shared_cars"), false);
  });

  it("WEB-DENALI-TR-02 shows personal car for bus/minibus/train", () => {
    assert.equal(isDenaliPersonalCarOptionVisible("train"), true);
    assert.equal(isDenaliPersonalCarOptionVisible("organizer_vehicle"), false);
  });

  it("WEB-DENALI-TR-03 shows dong for shared cars and organized modes with personal car", () => {
    assert.equal(isDenaliDongAmountVisible("shared_cars"), true);
    assert.equal(isDenaliDongAmountVisible("bus"), false);
    assert.equal(isDenaliDongAmountVisible("bus", true), true);
    assert.equal(isDenaliDongAmountVisible("train", true), true);
    assert.equal(isDenaliDongAmountVisible("organizer_vehicle", true), false);
  });
});
