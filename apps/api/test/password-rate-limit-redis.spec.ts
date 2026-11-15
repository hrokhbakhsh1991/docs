import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test(
  "real Redis enforces the shared account budget without affecting another account",
  { skip: !process.env.PASSWORD_TEST_REDIS_URL },
  () => {
    const script = `
    const assert = require('node:assert/strict');
    const { assertPasswordAttemptLimit } = require('./src/identity/password-rate-limit');
    (async () => {
      for (let i = 0; i < 5; i++) await assertPasswordAttemptLimit({ mobile: '09120000000', clientIp: '127.0.0.1' });
      await assert.rejects(assertPasswordAttemptLimit({ mobile: '09120000000', clientIp: '127.0.0.2' }), { code: 'PASSWORD_RATE_LIMITED' });
      await assertPasswordAttemptLimit({ mobile: '09120000001', clientIp: '127.0.0.1' });
    })().then(() => process.exit(0), () => process.exit(1));
  `;
    const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        REDIS_URL: process.env.PASSWORD_TEST_REDIS_URL,
        PASSWORD_AUTH_RATE_LIMIT_SECRET: "a".repeat(64),
        APP_INFRA_PROFILE: "isolated-test",
      },
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  }
);
