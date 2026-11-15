import assert from "node:assert/strict";
import { test } from "node:test";

import { validateNewPassword } from "../src/identity/password-policy";

test("password policy accepts long passphrases and Unicode without trimming", () => {
  assert.equal(validateNewPassword(" correct horse battery staple "), null);
  assert.equal(validateNewPassword("عبارت امن من برای ورود به حساب"), null);
  assert.equal(validateNewPassword("a".repeat(129)), "PASSWORD_TOO_LONG");
  assert.equal(validateNewPassword("a".repeat(14)), "PASSWORD_TOO_SHORT");
});

test("password policy rejects common and repeated long passwords", () => {
  assert.equal(validateNewPassword("qwertyuiop12345"), "PASSWORD_TOO_COMMON");
  assert.equal(validateNewPassword("passwordpassword"), "PASSWORD_TOO_COMMON");
  assert.equal(validateNewPassword("123456789012345"), "PASSWORD_TOO_COMMON");
  assert.equal(validateNewPassword("aaaaaaaaaaaaaaa"), "PASSWORD_TOO_COMMON");
});
