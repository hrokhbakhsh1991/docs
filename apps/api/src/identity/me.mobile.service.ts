import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getIdentityRepository } from "./create-identity-repository";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import { MobileAlreadyRegisteredError } from "./identity.errors";
import { MobileInvalidError } from "./phone-preflight.errors";
import {
  isLoginMobileFormatValid,
  normalizeLoginMobile,
} from "./phone-login-authorization";
import { createMobileOtpChallenge, verifyMobileOtp } from "./otp.service";
import { getOperatorProfile, type OperatorProfileResponse } from "./me.service";
import { signSessionToken } from "./sign-session-token";

export class MobileUnchangedError extends Error {
  readonly code = "MOBILE_UNCHANGED" as const;

  constructor() {
    super("MOBILE_UNCHANGED");
    this.name = "MobileUnchangedError";
  }
}

export class MobileChallengeMismatchError extends Error {
  readonly code = "MOBILE_CHALLENGE_MISMATCH" as const;

  constructor() {
    super("MOBILE_CHALLENGE_MISMATCH");
    this.name = "MobileChallengeMismatchError";
  }
}

export async function requestIdentityMobileChangeOtp(
  auth: TenantAuthContext,
  rawMobile: string
): Promise<{ readonly challengeId: string }> {
  const mobile = normalizeLoginMobile(rawMobile);
  if (!isLoginMobileFormatValid(mobile)) {
    throw new MobileInvalidError();
  }

  const repo = getIdentityRepository();
  const user = await repo.findUserById(auth.userId);
  if (user === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  if (normalizeLoginMobile(user.mobile) === mobile) {
    throw new MobileUnchangedError();
  }

  const existing = await repo.findUserByMobile(mobile);
  if (existing !== null && existing.id !== auth.userId) {
    throw new MobileAlreadyRegisteredError();
  }

  return createMobileOtpChallenge(mobile, repo);
}

export async function verifyIdentityMobileChangeAndCommit(
  auth: TenantAuthContext,
  rawMobile: string,
  challengeId: string,
  code: string
): Promise<{ readonly profile: OperatorProfileResponse; readonly sessionToken: string }> {
  const mobile = normalizeLoginMobile(rawMobile);
  if (!isLoginMobileFormatValid(mobile)) {
    throw new MobileInvalidError();
  }

  const { mobile: challengeMobile } = await verifyMobileOtp(challengeId, code);
  if (normalizeLoginMobile(challengeMobile) !== mobile) {
    throw new MobileChallengeMismatchError();
  }

  const repo = getIdentityRepository();
  const user = await repo.findUserById(auth.userId);
  if (user === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  if (normalizeLoginMobile(user.mobile) === mobile) {
    throw new MobileUnchangedError();
  }

  const existing = await repo.findUserByMobile(mobile);
  if (existing !== null && existing.id !== auth.userId) {
    throw new MobileAlreadyRegisteredError();
  }

  await repo.updateUserMobile(auth.userId, mobile);

  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  const profile = await getOperatorProfile(auth);
  const sessionToken = await signSessionToken({
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: membership.role,
    sessionVersion: membership.sessionVersion,
    ...(membership.workspaceId !== undefined ? { workspaceId: membership.workspaceId } : {}),
  });

  return { profile, sessionToken };
}
