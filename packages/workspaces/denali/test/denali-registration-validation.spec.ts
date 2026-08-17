import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateDenaliRegistrationPayload } from "../src/http/registration.validation";

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
          profileNationalId: "0013542419",
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
          profileNationalId: "0013542419",
        }
      )
    );
  });

  it("DN-REG-V03 other accepts intake national id", () => {
    assert.doesNotThrow(() =>
      validateDenaliRegistrationPayload(
        {
          registrantTarget: "other",
          contact: {
            fullName: "Guest Child",
            phone: "09121234567",
            nationalId: "2234567890",
          },
          partySize: 1,
        },
        {
          capacity: null,
          nationalIdRequired: true,
          profileNationalId: "0013542419",
        }
      )
    );
  });

  it("DN-REG-V04 checksum-invalid 10-digit national id is rejected", () => {
    assert.throws(() =>
      validateDenaliRegistrationPayload(
        {
          registrantTarget: "self",
          contact: { fullName: "Ali Rezaei", nationalId: "1234567890" },
          partySize: 1,
        },
        {
          capacity: null,
          nationalIdRequired: true,
        }
      )
    );
  });
});
