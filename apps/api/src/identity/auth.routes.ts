import type { IncomingMessage, ServerResponse } from "node:http";

import { buildTenantAuthz } from "@app-tour/workspace-sdk";

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
  AUTH_TENANT_SUSPENDED,
  AuthPhoneNotAuthorizedError,
  MobileInvalidError,
  MobileRequiredError,
  TenantSuspendedForLoginError,
} from "./phone-preflight.errors";
import { assertTenantActiveForOperatorLogin, type TenantLoginStatusResolver } from "./assert-tenant-active-for-login";
import {
  isLoginMobileFormatValid,
  isPhoneAuthorizedForTenantLogin,
  normalizeLoginMobile,
} from "./phone-login-authorization";
import { hydrateMembershipFromDb } from "./hydrate-membership";
import { OtpRateLimitedError } from "./otp-rate-limit";
import { findPendingInviteByPhone } from "./resolve-pending-invite-auth";
import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";
import { createMobileOtpChallenge, verifyMobileOtp } from "./otp.service";
import { readIdentityRequestBody } from "./read-identity-request-body";
import { requireOperatorSession } from "./require-operator-session";
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

type OperatorAuthRouteDeps = {
  readonly resolveTenantStatus?: TenantLoginStatusResolver;
};

async function assertOperatorLoginTenantActive(
  tenantId: string,
  deps: OperatorAuthRouteDeps
): Promise<void> {
  await assertTenantActiveForOperatorLogin(tenantId, {
    resolveStatus: deps.resolveTenantStatus,
  });
}

export async function handlePhonePreflight(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository(),
  routeDeps: OperatorAuthRouteDeps = {}
): Promise<void> {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const mobile = await readMobileFromBody(req);
    assertLoginMobilePresent(mobile);
    assertLoginMobileFormat(mobile);

    await assertOperatorLoginTenantActive(tenantId, routeDeps);

    const authorized = await isPhoneAuthorizedForTenantLogin(tenantId, mobile, repo);
    sendJson(res, 200, { authorized });
  } catch (error) {
    if (error instanceof MobileRequiredError || error instanceof MobileInvalidError) {
      sendJson(res, 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof TenantSuspendedForLoginError) {
      sendJson(res, 403, { error: AUTH_TENANT_SUSPENDED, code: AUTH_TENANT_SUSPENDED });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleRequestOtp(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository(),
  routeDeps: OperatorAuthRouteDeps = {}
): Promise<void> {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const mobile = await readMobileFromBody(req);
    assertLoginMobilePresent(mobile);
    assertLoginMobileFormat(mobile);

    await assertOperatorLoginTenantActive(tenantId, routeDeps);

    const authorized = await isPhoneAuthorizedForTenantLogin(tenantId, mobile, repo);
    if (!authorized) {
      throw new AuthPhoneNotAuthorizedError();
    }

    const { challengeId } = await createMobileOtpChallenge(mobile, repo);
    sendJson(res, 200, { challengeId });
  } catch (error) {
    if (error instanceof MobileRequiredError || error instanceof MobileInvalidError) {
      sendJson(res, 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof TenantSuspendedForLoginError) {
      sendJson(res, 403, { error: AUTH_TENANT_SUSPENDED, code: AUTH_TENANT_SUSPENDED });
      return;
    }
    if (error instanceof AuthPhoneNotAuthorizedError) {
      sendJson(res, 403, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof OtpRateLimitedError) {
      sendJson(res, 429, { error: error.message, code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleVerifyOtp(
  req: IncomingMessage,
  res: ServerResponse,
  repo: IdentityRepository = getIdentityRepository(),
  routeDeps: OperatorAuthRouteDeps = {}
): Promise<void> {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    await assertOperatorLoginTenantActive(tenantId, routeDeps);

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
    if (user === null) {
      sendJson(res, 200, { requiresRegistration: true, onboardingToken: "onboarding-stub" });
      return;
    }

    const membership = await repo.findMembership(user.id, tenantId);
    if (membership === null || membership.status !== "ACTIVE") {
      const pendingInvite = await findPendingInviteByPhone(tenantId, mobile, repo);
      if (pendingInvite === null) {
        sendJson(res, 200, { requiresRegistration: true, onboardingToken: "onboarding-stub" });
        return;
      }

      const sessionToken = await signSessionToken({
        userId: user.id,
        tenantId,
        role: pendingInvite.role,
        sessionVersion: 1,
        workspaceId:
          process.env.TOUR_OPS_DEV_WORKSPACE_ID?.trim() ??
          process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID?.trim() ??
          "ws-operator-smoke",
      });
      sendJson(res, 200, {
        sessionToken,
        userId: user.id,
        tenantId,
        role: pendingInvite.role,
        pendingInvite: true,
      });
      return;
    }

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
    if (error instanceof TenantSuspendedForLoginError) {
      sendJson(res, 403, { error: AUTH_TENANT_SUSPENDED, code: AUTH_TENANT_SUSPENDED });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetAuthSession(
  req: IncomingMessage,
  res: ServerResponse,
  _repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    sendJson(res, 200, {
      userId: auth.userId,
      tenantId: auth.tenantId,
      role: auth.role,
      status: auth.status,
      workspaceId: auth.workspaceId ?? null,
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetAuthAbilityContext(
  req: IncomingMessage,
  res: ServerResponse,
  _repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const authz = buildTenantAuthz(auth);
    sendJson(res, 200, {
      userId: auth.userId,
      tenantId: auth.tenantId,
      role: auth.role,
      workspaceId: auth.workspaceId ?? null,
      capabilities: {
        canManageTenant: authz.canManageTenant(auth.tenantId),
      },
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}
