import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isOperatorProfileGender,
  OPERATOR_PROFILE_GENDERS,
} from "../src/operator/identity/operator-profile-gender";

describe("operator-profile-gender.spec.ts", () => {
  it("accepts known gender tokens", () => {
    assert.deepEqual(OPERATOR_PROFILE_GENDERS, ["male", "female", "other"]);
    assert.equal(isOperatorProfileGender("male"), true);
    assert.equal(isOperatorProfileGender("invalid"), false);
  });
});
