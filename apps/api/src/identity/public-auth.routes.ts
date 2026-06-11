import type { IncomingMessage, ServerResponse } from "node:http";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { parseRequestAuth } from "../auth/request-context";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { assertRequiredAuthHeaders } from "../tenant-kernel/assert-required-headers";
import {
  OtpChallengeInvalidError,
  OtpExpiredError,
  OtpInvalidError,
} from "./identity.errors";
import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";
import { hydrateMembershipFromDb } from "./hydrate-membership";
import {
  OnboardingTokenInvalidError,
  signOnboardingToken,
  verifyOnboardingToken,
} from "./onboarding-token";
import { OtpRateLimitedError } from "./otp-rate-limit";
import { createMobileOtpChallenge, verifyMobileOtp } from "./otp.service";
import { DisplayNameRequiredError } from "./public-auth.errors";
import {
  isLoginMobileFormatValid,
  normalizeLoginMobile,
} from "./phone-login-authorization";
import { MobileInvalidError, MobileRequiredError } from "./phone-preflight.errors";
import { readIdentityRequestBody } from "./read-identity-request-body";
import { signSessionToken } from "./sign-session-token";

function readStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function resolveTenantIdFromRequest(req: IncomingMessage): string {
  const headers = readRequestAuthHeaders(req);
  assertRequiredAuthHeaders(headers);
  return parseRequestAuth(headers).tenantId;
}

async function readMobileFromBody(req: IncomingMessage): Promise<string> {
  const body = await readIdentityRequestBody(req);
  return normalizeLoginMobile(readStringField(body, "mobile"));
}

function assertLoginMobilePresent(mobile: string): void {
  if (mobile.length === 0) {
    throw new MobileRequiredError();
  }
}

function assertLoginMobileFormat(mobile: string): void {
  if (!isLoginMobileFormatValid(mobile)) {
    throw new MobileInvalidError();
  }
}

function handleMobileValidationError(
  res: ServerResponse,
  error: MobileRequiredError | MobileInvalidError
): void {
  sendJson(res, 400, { error: error.message, code: error.code });
}

export async function handlePublicPhonePreflight(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  try {
    await resolveTenantIdFromRequest(req);
    const mobile = await readMobileFromBody(req);
    assertLoginMobilePresent(mobile);
    assertLoginMobileFormat(mobile);

    const user = await repo.findUserByMobile(mobile);
    sendJson(res, 200, { exists: user !== null });
  } catch (error) {
    if (error instanceof MobileRequiredError || error instanceof MobileInvalidError) {
      handleMobileValidationError(res, error);
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePublicRequestOtp(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  try {
    await resolveTenantIdFromRequest(req);
    const mobile = await readMobileFromBody(req);
    assertLoginMobilePresent(mobile);
    assertLoginMobileFormat(mobile);

    const { challengeId } = await createMobileOtpChallenge(mobile, repo);
    sendJson(res, 200, { challengeId });
  } catch (error) {
    if (error instanceof MobileRequiredError || error instanceof MobileInvalidError) {
      handleMobileValidationError(res, error);
      return;
    }
    if (error instanceof OtpRateLimitedError) {
      sendJson(res, 429, { error: error.message, code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePublicVerifyOtp(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const body = await readIdentityRequestBody(req);
    const challengeId =
      readStringField(body, "challengeId") || readStringField(body, "challenge_id");
    const code = readStringField(body, "code") || readStringField(body, "otp");

    if (challengeId.length === 0 || code.length === 0) {
      sendJson(res, 400, { error: "invalid_payload", code: "OTP_PAYLOAD_INVALID" });
      return;
    }

    const { mobile } = await verifyMobileOtp(challengeId, code, repo);
    const user = await repo.findUserByMobile(mobile);
    if (user !== null) {
      const membership = await repo.findMembership(user.id, tenantId);
      if (membership !== null && membership.status === "ACTIVE") {
        const auth = await hydrateMembershipFromDb(user.id, tenantId, undefined, repo);
        const sessionToken = await signSessionToken({
          userId: user.id,
          tenantId,
          role: auth.role,
          sessionVersion: membership.sessionVersion,
          ...(auth.workspaceId !== undefined ? { workspaceId: auth.workspaceId } : {}),
        });
        sendJson(res, 200, {
          sessionToken,
          userId: user.id,
          tenantId,
          role: auth.role,
        });
        return;
      }
    }

    const onboardingToken = await signOnboardingToken({
      mobile,
      tenantId,
      ...(user !== null ? { userId: user.id } : {}),
    });
    sendJson(res, 200, { requiresRegistration: true, onboardingToken });
  } catch (error) {
    if (
      error instanceof OtpInvalidError ||
      error instanceof OtpExpiredError ||
      error instanceof OtpChallengeInvalidError
    ) {
      const status = error instanceof OtpChallengeInvalidError ? 400 : 401;
      sendJson(res, status, { error: error.message, code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePublicRegisterComplete(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const body = await readIdentityRequestBody(req);
    const onboardingToken =
      readStringField(body, "onboardingToken") || readStringField(body, "onboarding_token");
    const displayName =
      readStringField(body, "displayName") || readStringField(body, "display_name");
    const email = readStringField(body, "email");

    if (onboardingToken.length === 0) {
      sendJson(res, 400, { error: "invalid_payload", code: "ONBOARDING_TOKEN_REQUIRED" });
      return;
    }
    if (displayName.length === 0) {
      throw new DisplayNameRequiredError();
    }

    const claims = await verifyOnboardingToken(onboardingToken);
    if (claims.tenantId !== tenantId) {
      throw new OnboardingTokenInvalidError();
    }

    const { user, membership } = await repo.registerPublicGuest({
      tenantId,
      mobile: claims.mobile,
      displayName,
      ...(email.length > 0 ? { email } : {}),
    });

    const sessionToken = await signSessionToken({
      userId: user.id,
      tenantId,
      role: membership.role,
      sessionVersion: membership.sessionVersion,
      ...(membership.workspaceId !== undefined ? { workspaceId: membership.workspaceId } : {}),
    });

    sendJson(res, 200, {
      sessionToken,
      userId: user.id,
      tenantId,
      role: membership.role,
    });
  } catch (error) {
    if (error instanceof DisplayNameRequiredError) {
      sendJson(res, 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof OnboardingTokenInvalidError) {
      sendJson(res, 401, { error: error.message, code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}
