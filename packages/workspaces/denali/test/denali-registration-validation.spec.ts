import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateDenaliRegistrationPayload } from "../src/denali.plugin";

describe("denali-registration-validation", () => {
  it("DN-REG-V01 self may satisfy national id from profile", () => {
    assert.doesNotThrow(() =>
      validateDenaliRegistrationPayload(
        {
          registrantTarget: "self",
          contact: { fullName: "Ali Rezaei" },
          partySize: 1,
        },
        {
          capacity: null,
          nationalIdRequired: true,
          profileNationalId: "1234567890",
        }
      )
    );
  });

  it("DN-REG-V02 other must supply national id at intake even when booker profile has one", () => {
    assert.throws(() =>
      validateDenaliRegistrationPayload(
        {
          registrantTarget: "other",
          contact: { fullName: "Guest Child" },
          partySize: 1,
        },
        {
          capacity: null,
          nationalIdRequired: true,
          profileNationalId: "1234567890",
        }
      )
    );
  });

  it("DN-REG-V03 other accepts intake national id", () => {
    assert.doesNotThrow(() =>
      validateDenaliRegistrationPayload(
        {
          registrantTarget: "other",
          contact: { fullName: "Guest Child", nationalId: "2234567890" },
          partySize: 1,
        },
        {
          capacity: null,
          nationalIdRequired: true,
          profileNationalId: "1234567890",
        }
      )
    );
  });
});
