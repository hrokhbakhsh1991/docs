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
import { isStaticOtpEnabled, STAGING_STATIC_OTP_CODE } from "./static-otp-policy";

const DEV_STATIC_OTP = STAGING_STATIC_OTP_CODE;

function isDevStaticOtpEnabled(): boolean {
  return isStaticOtpEnabled();
}

export async function createMobileOtpChallenge(
  mobile: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<{ challengeId: string }> {
  assertOtpRequestRateLimit(mobile);
  // DL-44: when static DEV OTP is enabled, issue the same code the UI hints (1234)
  // so otp-dev logs match PUBLIC_REGISTRATION_DEV_OTP / otp.devHint.
  const code = isDevStaticOtpEnabled() ? DEV_STATIC_OTP : resolveOtpCodeForChallenge();
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
