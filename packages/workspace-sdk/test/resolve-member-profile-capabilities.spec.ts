import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateMemberProfileBirthDate,
  validateMemberProfileDisplayName,
  validateMemberProfileNationalId,
} from "../src/profile/member-profile-validators";
import {
  MemberProfileNotConfiguredError,
  resolveMemberProfileCapabilities,
} from "../src/profile/resolve-member-profile-capabilities";

describe("resolve-member-profile-capabilities", () => {
  it("SDK-MP-CAP-01 denali editable identity + participant fields", () => {
    const caps = resolveMemberProfileCapabilities("denali");
    assert.deepEqual(caps.editableFields, [
      "displayName",
      "email",
      "nationalId",
      "fatherName",
      "birthDate",
    ]);
    assert.deepEqual(caps.readOnlyFields, ["mobile"]);
    assert.equal(caps.mobileChangeViaOtp, true);
    assert.equal(caps.sections?.[0]?.id, "identity");
    assert.equal(caps.sections?.[1]?.id, "participant");
  });

  it("SDK-MP-CAP-02 denali exposes field validators (references only)", () => {
    const caps = resolveMemberProfileCapabilities("denali");
    assert.equal(typeof caps.validators.nationalId, "function");
    assert.equal(typeof caps.validators.fatherName, "function");
    assert.equal(typeof caps.validators.birthDate, "function");
    assert.equal(typeof caps.validators.displayName, "function");
    assert.equal(typeof caps.validators.email, "function");
    assert.equal(caps.validators.nationalId!("1234567890"), null);
    assert.equal(caps.validators.nationalId!("bad"), "PROFILE_NATIONAL_ID_INVALID");
  });

  it("SDK-MP-CAP-03 urban manifest row exposes displayName + email", () => {
    const caps = resolveMemberProfileCapabilities("urban");
    assert.deepEqual(caps.editableFields, ["displayName"]);
    assert.deepEqual(caps.readOnlyFields, ["email"]);
    assert.equal(caps.sections?.[0]?.id, "identity");
    assert.equal(typeof caps.validators.displayName, "function");
  });

  it("SDK-MP-CAP-04 unknown plugin fails closed", () => {
    assert.throws(
      () => resolveMemberProfileCapabilities("unknown-workspace"),
      MemberProfileNotConfiguredError
    );
  });

  it("SDK-MP-CAP-05 starter without manifest row fails closed", () => {
    assert.throws(() => resolveMemberProfileCapabilities("starter"), MemberProfileNotConfiguredError);
  });
});

describe("member-profile-validators", () => {
  it("SDK-MP-VAL-01 nationalId accepts empty or 10 digits", () => {
    assert.equal(validateMemberProfileNationalId(""), null);
    assert.equal(validateMemberProfileNationalId("1234567890"), null);
    assert.equal(validateMemberProfileNationalId("123"), "PROFILE_NATIONAL_ID_INVALID");
  });

  it("SDK-MP-VAL-02 birthDate accepts empty or ISO date", () => {
    assert.equal(validateMemberProfileBirthDate(""), null);
    assert.equal(validateMemberProfileBirthDate("1990-05-15"), null);
    assert.equal(validateMemberProfileBirthDate("15-05-1990"), "PROFILE_BIRTH_DATE_INVALID");
  });

  it("SDK-MP-VAL-03 displayName requires non-empty within max length", () => {
    assert.equal(validateMemberProfileDisplayName(""), "PROFILE_DISPLAY_NAME_INVALID");
    assert.equal(validateMemberProfileDisplayName("Member"), null);
  });
});
