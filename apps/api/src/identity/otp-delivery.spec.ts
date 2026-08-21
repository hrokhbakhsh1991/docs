import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { logger } from "../observability/logger";
import { deliverOtpCode } from "./otp-delivery";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};
const originalInfo = logger.info;

function restoreEnv(name: keyof typeof ENV_SNAPSHOT): void {
  const value = ENV_SNAPSHOT[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

afterEach(() => {
  restoreEnv("NODE_ENV");
  restoreEnv("RESEND_API_KEY");
  logger.info = originalInfo;
});

function captureInfoCalls(): Array<{ payload: unknown; message: unknown }> {
  const calls: Array<{ payload: unknown; message: unknown }> = [];
  logger.info = ((payload: unknown, message: unknown) => {
    calls.push({ payload, message });
  }) as typeof logger.info;
  return calls;
}

describe("OTP delivery logging", () => {
  for (const nodeEnv of ["development", "test"]) {
    it(`${nodeEnv} emits only a PII-free fallback event`, () => {
      process.env.NODE_ENV = nodeEnv;
      delete process.env.RESEND_API_KEY;
      const calls = captureInfoCalls();

      deliverOtpCode("+989121234567", "246810");

      assert.deepEqual(calls, [
        {
          payload: { event: "otp.delivery.dev_fallback" },
          message: "otp.delivery.dev_fallback",
        },
      ]);
    });
  }

  for (const nodeEnv of ["production", "staging"]) {
    it(`${nodeEnv} does not emit a fallback delivery log`, () => {
      process.env.NODE_ENV = nodeEnv;
      delete process.env.RESEND_API_KEY;
      const calls = captureInfoCalls();

      deliverOtpCode("+989121234567", "246810");

      assert.deepEqual(calls, []);
    });
  }
});
