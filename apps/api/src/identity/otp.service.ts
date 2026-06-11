import {
  OtpChallengeInvalidError,
  OtpExpiredError,
  OtpInvalidError,
} from "./identity.errors";
import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";
import { deliverOtpCode } from "./otp-delivery";
import {
  hashOtpCode,
  resolveOtpCodeForChallenge,
  verifyOtpCodeHash,
} from "./otp-code";
import { assertOtpRequestRateLimit } from "./otp-rate-limit";

const DEV_STATIC_OTP = "1234";

function isDevStaticOtpEnabled(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim();
  return (
    (nodeEnv === "development" || nodeEnv === "test") &&
    process.env.AUTH_ALLOW_DEV_STATIC_OTP?.trim() !== "false"
  );
}

export async function createMobileOtpChallenge(
  mobile: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<{ challengeId: string }> {
  assertOtpRequestRateLimit(mobile);
  const code = resolveOtpCodeForChallenge();
  const codeHash = await hashOtpCode(code);
  const { challengeId } = await repo.createOtpChallenge(mobile, codeHash);
  deliverOtpCode(mobile, code);
  return { challengeId };
}

export async function verifyMobileOtp(
  challengeId: string,
  code: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<{ mobile: string }> {
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (trimmedCode.length === 0) {
    throw new OtpInvalidError();
  }

  const row = await repo.findOtpChallenge(challengeId);
  if (row === null) {
    throw new OtpChallengeInvalidError();
  }
  if (row.used || row.expiresAt.getTime() < Date.now()) {
    throw new OtpExpiredError();
  }

  const devBypass = isDevStaticOtpEnabled() && trimmedCode === DEV_STATIC_OTP;
  const hashValid = await verifyOtpCodeHash(trimmedCode, row.codeHash);
  if (!devBypass && !hashValid) {
    throw new OtpInvalidError();
  }

  await repo.markOtpChallengeUsed(challengeId);
  return { mobile: row.mobile };
}
