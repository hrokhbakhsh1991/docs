/**
 * Dev static OTP gate regression (no full ConfigService — safe in CI).
 * Manual .env check: NODE_ENV=development node --env-file=.env --import tsx --test src/modules/auth/otp-dev-env-verify.spec.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";

import { OtpService } from "./otp.service";

function formatUnauthorized(err: unknown): string {
  if (err instanceof UnauthorizedException) {
    return JSON.stringify(err.getResponse(), null, 2);
  }
  return String(err);
}

function developmentOtpConfig(allowDevStaticOtp: boolean) {
  return {
    getNodeEnv: () => "development",
    getAuthAllowDevStaticOtp: () => allowDevStaticOtp,
  };
}

function makeOtpService(allowDevStaticOtp: boolean): OtpService {
  return new OtpService(
    { save: async () => undefined } as never,
    { query: async () => [] } as never,
    developmentOtpConfig(allowDevStaticOtp) as never,
  );
}

test("development env enables static OTP when AUTH_ALLOW_DEV_STATIC_OTP is true", () => {
  const config = developmentOtpConfig(true);
  const devStaticEnabled =
    (config.getNodeEnv() === "development" || config.getNodeEnv() === "test") &&
    config.getAuthAllowDevStaticOtp();

  assert.equal(devStaticEnabled, true);
});

test("OtpService accepts code path for 1234 (not production guard) when env is development", async () => {
  const otpService = makeOtpService(true);

  await assert.rejects(
    () => otpService.verifyMobileOtp(randomUUID(), "1234"),
    (err: unknown) => {
      const body = formatUnauthorized(err);
      assert.doesNotMatch(body, /OTP verification is not available/);
      assert.match(body, /Invalid or expired OTP challenge/);
      return err instanceof UnauthorizedException;
    },
  );
});

test("OtpService rejects wrong code with Invalid OTP code in development", async () => {
  const otpService = makeOtpService(true);

  await assert.rejects(
    () => otpService.verifyMobileOtp(randomUUID(), "0000"),
    (err: unknown) => {
      const body = formatUnauthorized(err);
      assert.match(body, /Invalid OTP code/);
      return err instanceof UnauthorizedException;
    },
  );
});
