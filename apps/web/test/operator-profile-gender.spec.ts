import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatOperatorProfileGenderLabel,
  parseOperatorProfileGender,
} from "../src/features/operator-profile/gender";

describe("operator-profile-gender.spec.ts — web contract", () => {
  it("WEB-OP-GENDER-01 parse and label helpers stay aligned with workspace-sdk", () => {
    assert.equal(parseOperatorProfileGender("female"), "female");
    assert.equal(parseOperatorProfileGender("bad"), null);
    assert.equal(
      formatOperatorProfileGenderLabel("male", (key) => key),
      "gender.male"
    );
    assert.equal(
      formatOperatorProfileGenderLabel(null, (key) => key),
      null
    );
  });
});
