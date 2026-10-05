import assert from "node:assert/strict";
import test from "node:test";

import { formatMembershipCode, membershipCodePrefix } from "./membership-code";

test("membership codes use a normalized workspace prefix and fixed-width sequence", () => {
  assert.equal(membershipCodePrefix("denali"), "DENALI");
  assert.equal(membershipCodePrefix("north ridge"), "NORTH-RIDGE");
  assert.equal(formatMembershipCode("denali", 1), "DENALI-000001");
  assert.equal(formatMembershipCode("denali", 42), "DENALI-000042");
});

test("membership code sequences reject invalid values", () => {
  assert.throws(() => formatMembershipCode("denali", 0), /MEMBERSHIP_CODE_SEQUENCE_INVALID/);
  assert.throws(() => formatMembershipCode("denali", Number.NaN), /MEMBERSHIP_CODE_SEQUENCE_INVALID/);
});
