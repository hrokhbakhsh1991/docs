import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyIranianNationalId,
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
      "gender",
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
    assert.equal(typeof caps.validators.gender, "function");
    assert.equal(caps.validators.nationalId!("0013542419"), null);
    assert.equal(caps.validators.nationalId!("bad"), "PROFILE_NATIONAL_ID_INVALID");
    assert.equal(caps.validators.nationalId!("1234567890"), "PROFILE_NATIONAL_ID_CHECKSUM");
    assert.equal(caps.validators.birthDate!("1991-02-31"), "PROFILE_BIRTH_DATE_INVALID");
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
  const VALID_IR_NATIONAL_ID = "0013542419";

  it("SDK-MP-VAL-01 nationalId accepts empty or valid IR checksum id", () => {
    assert.equal(validateMemberProfileNationalId(""), null);
    assert.equal(validateMemberProfileNationalId(VALID_IR_NATIONAL_ID), null);
    assert.equal(validateMemberProfileNationalId("123"), "PROFILE_NATIONAL_ID_INVALID");
    assert.equal(validateMemberProfileNationalId("0000000000"), "PROFILE_NATIONAL_ID_CHECKSUM");
    assert.equal(validateMemberProfileNationalId("1111111111"), "PROFILE_NATIONAL_ID_CHECKSUM");
    assert.equal(validateMemberProfileNationalId("1234567890"), "PROFILE_NATIONAL_ID_CHECKSUM");
    assert.equal(classifyIranianNationalId("123"), "format");
    assert.equal(classifyIranianNationalId("1234567890"), "checksum");
    assert.equal(classifyIranianNationalId(VALID_IR_NATIONAL_ID), "ok");
    assert.equal(classifyIranianNationalId("2234567890"), "ok");
  });

  it("SDK-MP-VAL-02 birthDate accepts empty or real calendar date not after today", () => {
    assert.equal(validateMemberProfileBirthDate(""), null);
    assert.equal(validateMemberProfileBirthDate("1990-05-15"), null);
    assert.equal(validateMemberProfileBirthDate("15-05-1990"), "PROFILE_BIRTH_DATE_INVALID");
    assert.equal(validateMemberProfileBirthDate("1991-02-31"), "PROFILE_BIRTH_DATE_INVALID");
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const future = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
    assert.equal(validateMemberProfileBirthDate(future), "PROFILE_BIRTH_DATE_INVALID");
  });

  it("SDK-MP-VAL-03 displayName requires non-empty within max length", () => {
    assert.equal(validateMemberProfileDisplayName(""), "PROFILE_DISPLAY_NAME_INVALID");
    assert.equal(validateMemberProfileDisplayName("Member"), null);
  });

  it("SDK-MP-VAL-04 gender accepts empty or enum values", async () => {
    const { validateMemberProfileGender } = await import("../src/profile/member-profile-validators");
    assert.equal(validateMemberProfileGender(""), null);
    assert.equal(validateMemberProfileGender("male"), null);
    assert.equal(validateMemberProfileGender("female"), null);
    assert.equal(validateMemberProfileGender("other"), null);
    assert.equal(validateMemberProfileGender("invalid"), "PROFILE_GENDER_INVALID");
  });
});
