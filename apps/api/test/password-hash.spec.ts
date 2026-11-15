import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword, verifyPassword } from "../src/identity/password-hash";

test("password hashes are salted and verify only the correct password", async () => {
  const password = "correct horse battery staple";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("correct horse battery stapler", first), false);
});

test("password verification preserves spaces and normalizes Unicode consistently", async () => {
  const hash = await hashPassword(" café مثال password ");
  assert.equal(await verifyPassword(" cafe\u0301 مثال password ", hash), true);
  assert.equal(await verifyPassword("café مثال password", hash), false);
});

test("malformed and unsupported password hashes fail closed", async () => {
  for (const malformed of ["", "scrypt$broken", "unknown$1$2$3", "scrypt$v1$16384$8$5$00$00"]) {
    assert.equal(await verifyPassword("any password", malformed), false);
  }
});
