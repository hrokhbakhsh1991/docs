import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_TRANSPORT_MODE_VALUES,
  isDenaliDongAmountVisible,
  isDenaliPersonalCarOptionVisible,
  isDenaliTransportCostVisible,
  parseDenaliTransportMode,
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

  it("WEB-DENALI-TR-04 accepts airplane as organized transport without carpool options", () => {
    assert.ok(DENALI_TRANSPORT_MODE_VALUES.includes("airplane"));
    assert.equal(parseDenaliTransportMode("airplane"), "airplane");
    assert.equal(isDenaliTransportCostVisible("airplane"), true);
    assert.equal(isDenaliPersonalCarOptionVisible("airplane"), false);
    assert.equal(isDenaliDongAmountVisible("airplane"), false);
  });
});
