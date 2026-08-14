import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveDenaliRegistrationDueBreakdown,
  resolveDenaliRegistrationObligationMinor,
} from "../src/finance/resolve-denali-registration-obligation";

function tourCanonical(data: Record<string, unknown>): unknown {
  return { schemaVersion: 1, data };
}

describe("resolveDenaliRegistrationDueBreakdown", () => {
  it("DN-DUE-01 trip only for personal_car", () => {
    const due = resolveDenaliRegistrationDueBreakdown({
      tourCanonical: tourCanonical({
        pricing: { basePricePerPerson: 2_500_000, paymentMode: "offline_receipt" },
        transport: { mode: "shared_cars", dongAmount: 80_000 },
      }),
      partySize: 1,
      registrationIntake: { transport: { kind: "personal_car", personalCarOccupants: 2 } },
    });
    assert.ok(due !== null);
    assert.equal(due!.obligationMinor, "2500000");
    assert.deepEqual(due!.lines, [{ code: "trip", amountMinor: "2500000" }]);
  });

  it("DN-DUE-02 no_car_dong adds dong line", () => {
    const due = resolveDenaliRegistrationDueBreakdown({
      tourCanonical: tourCanonical({
        pricing: { basePricePerPerson: 2_500_000, paymentMode: "offline_receipt" },
        transport: { mode: "shared_cars", dongAmount: 80_000 },
      }),
      partySize: 2,
      registrationIntake: { transport: { kind: "no_car_dong" } },
    });
    assert.ok(due !== null);
    assert.equal(due!.obligationMinor, "5160000");
    assert.deepEqual(due!.lines, [
      { code: "trip", amountMinor: "5000000" },
      { code: "dong", amountMinor: "160000" },
    ]);
  });

  it("DN-DUE-03 organized primary adds transport line", () => {
    const due = resolveDenaliRegistrationObligationMinor({
      tourCanonical: tourCanonical({
        pricing: { basePricePerPerson: 2_500_000, paymentMode: "offline_receipt" },
        transport: { mode: "bus", transportCost: 150_000 },
      }),
      partySize: 1,
      registrationIntake: { transport: { kind: "primary" } },
    });
    assert.ok(due !== null);
    assert.equal(due!.obligationMinor, "2650000");
    assert.deepEqual(due!.lines, [
      { code: "trip", amountMinor: "2500000" },
      { code: "transport", amountMinor: "150000" },
    ]);
  });
});
