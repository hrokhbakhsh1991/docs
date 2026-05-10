import assert from "node:assert/strict";
import test from "node:test";
import { isSyntheticIdentityPlaceholderEmail } from "./synthetic-identity-email";

test("isSyntheticIdentityPlaceholderEmail detects @local.invalid suffix", () => {
  assert.equal(isSyntheticIdentityPlaceholderEmail("phone_9891@local.invalid"), true);
  assert.equal(isSyntheticIdentityPlaceholderEmail("Phone_1@LOCAL.INVALID"), true);
  assert.equal(isSyntheticIdentityPlaceholderEmail("user@example.com"), false);
  assert.equal(isSyntheticIdentityPlaceholderEmail(""), false);
  assert.equal(isSyntheticIdentityPlaceholderEmail(null), false);
  assert.equal(isSyntheticIdentityPlaceholderEmail(undefined), false);
});
