import assert from "node:assert/strict";
import { test } from "node:test";

import { consumePasswordAttemptBudget } from "../src/identity/password-rate-limit";

test("password rate-limit keys do not disclose phone or IP and a rejected attempt fails closed", async () => {
  let keys: readonly string[] = [];
  const deps = {
    secret: Buffer.alloc(32, 7),
    namespace: "test",
    evaluate: async (candidate: readonly string[]) => {
      keys = candidate;
      return 0;
    },
  };
  await assert.rejects(
    consumePasswordAttemptBudget({ mobile: "09120000000", clientIp: "127.0.0.1" }, deps),
    { code: "PASSWORD_RATE_LIMITED" }
  );
  assert.equal(keys.length, 3);
  assert.equal(
    keys.some((key) => key.includes("09120000000") || key.includes("127.0.0.1")),
    false
  );
});

test("password login budget fails closed when the store or client address is unavailable", async () => {
  const deps = {
    secret: Buffer.alloc(32, 7),
    namespace: "test",
    evaluate: async () => {
      throw new Error("offline");
    },
  };
  await assert.rejects(
    consumePasswordAttemptBudget({ mobile: "09120000000", clientIp: "127.0.0.1" }, deps),
    { code: "PASSWORD_RATE_LIMIT_UNAVAILABLE" }
  );
  await assert.rejects(
    consumePasswordAttemptBudget({ mobile: "09120000000", clientIp: "unknown" }, deps),
    { code: "PASSWORD_RATE_LIMIT_UNAVAILABLE" }
  );
});
