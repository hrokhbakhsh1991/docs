import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveDenaliRegistrationContactPhone,
  validateDenaliRegistrationPayload,
} from "../src/http/registration.validation";

describe("denali registration other phone", () => {
  it("DN-OTHER-PHONE-01 other requires valid mobile", () => {
    assert.throws(
      () =>
        validateDenaliRegistrationPayload(
          {
            registrantTarget: "other",
            contact: { fullName: "Guest Other" },
            partySize: 1,
          },
          { capacity: 10 }
        ),
      /DENALI_REGISTRATION_INVALID/
    );
  });

  it("DN-OTHER-PHONE-02 other normalizes IR mobile", () => {
    assert.equal(
      resolveDenaliRegistrationContactPhone("other", "09123456789"),
      "09123456789"
    );
  });

  it("DN-OTHER-PHONE-03 self may omit phone", () => {
    assert.equal(resolveDenaliRegistrationContactPhone("self", undefined), undefined);
    validateDenaliRegistrationPayload(
      {
        registrantTarget: "self",
        contact: { fullName: "Self Member" },
        partySize: 1,
      },
      { capacity: 10 }
    );
  });
});
