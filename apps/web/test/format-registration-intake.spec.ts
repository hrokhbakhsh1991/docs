import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatRegistrationIntakeTransportLabel,
  parseRegistrationIntakeRecord,
} from "@app-tour/workspace-sdk";

describe("registration-intake.contract (SDK)", () => {
  it("WEB-INT-01 parses transport kind and occupants", () => {
    const summary = parseRegistrationIntakeRecord({
      registrantTarget: "self",
      transport: { kind: "personal_car", personalCarOccupants: 2 },
      nationalId: "1234567890",
    });
    assert.equal(summary.registrantTarget, "self");
    assert.equal(summary.transportKind, "personal_car");
    assert.equal(summary.personalCarOccupants, 2);
    assert.equal(summary.nationalId, "1234567890");
  });

  it("WEB-INT-02 formats transport label with occupants", () => {
    const label = formatRegistrationIntakeTransportLabel(
      parseRegistrationIntakeRecord({
        transport: { kind: "personal_car", personalCarOccupants: 3 },
      }),
      {
        primary: "Organized",
        personalCar: "Personal car",
        noCarDong: "Dong",
        noCarAcquaintance: "Acquaintance",
        occupants: (count) => `${count} ppl`,
      }
    );
    assert.equal(label, "Personal car · 3 ppl");
  });
});
