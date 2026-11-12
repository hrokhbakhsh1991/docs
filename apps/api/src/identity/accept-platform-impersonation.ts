import type { IncomingMessage, ServerResponse } from "node:http";
import { jwtVerify } from "jose";

import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { isJwtVerifyConfigured, readJwtVerifyConfig } from "../tenant-kernel/jwt-env";
import { loadPublicKey } from "../tenant-kernel/jwt-key.util";
import { IdentityRequiredError } from "./identity.errors";
import { readIdentityRequestBody } from "./read-identity-request-body";
import {
  consumePlatformImpersonationExchange,
  PlatformImpersonationStateUnavailableError,
  PlatformImpersonationTokenConsumedError,
  revokePlatformImpersonationSession,
} from "../platform/platform-impersonation-session-state";

async function verifyPlatformImpersonationToken(sessionToken: string, allowRegularSession = false) {
  if (!isJwtVerifyConfigured()) {
    throw new IdentityRequiredError();
  }

  const config = readJwtVerifyConfig()!;
  const key = await loadPublicKey(config.publicKeyPem);

  try {
    const verified = await jwtVerify(sessionToken, key, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: "5s",
    });
    if (verified.payload.platform_impersonation_readonly !== true && !allowRegularSession) {
      const err = new Error("IMPERSONATION_ACCEPT_FORBIDDEN");
      (err as Error & { status?: number }).status = 403;
      throw err;
    }
    if (
      verified.payload.platform_impersonation_readonly === true &&
      (typeof verified.payload.jti !== "string" || typeof verified.payload.exp !== "number")
    ) {
      throw new IdentityRequiredError();
    }
    return verified.payload;
  } catch (error) {
    if (error instanceof Error && error.message === "IMPERSONATION_ACCEPT_FORBIDDEN") {
      throw error;
    }
    if (error instanceof IdentityRequiredError) {
      throw error;
    }
    throw new IdentityRequiredError();
  }
}

export async function acceptPlatformImpersonationSession(
  sessionToken: string
): Promise<{ sessionToken: string }> {
  const claims = await verifyPlatformImpersonationToken(sessionToken);
  await consumePlatformImpersonationExchange(claims.jti!, claims.exp!);
  return { sessionToken };
}

export async function endPlatformImpersonationSession(sessionToken: string): Promise<void> {
  const claims = await verifyPlatformImpersonationToken(sessionToken, true);
  if (claims.platform_impersonation_readonly !== true) {
    return;
  }
  await revokePlatformImpersonationSession(claims.jti!, claims.exp!);
}

function readSessionTokenField(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    return "";
  }
  const value = (body as Record<string, unknown>).sessionToken;
  return typeof value === "string" ? value.trim() : "";
}

export async function handleAcceptPlatformImpersonation(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readIdentityRequestBody(req);
    const sessionToken = readSessionTokenField(body);
    if (sessionToken.length === 0) {
      throw new IdentityRequiredError();
    }
    const accepted = await acceptPlatformImpersonationSession(sessionToken);
    sendJson(res, 200, accepted);
  } catch (error) {
    if (error instanceof Error && error.message === "IMPERSONATION_ACCEPT_FORBIDDEN") {
      sendJson(res, 403, { error: "forbidden", code: "IMPERSONATION_ACCEPT_FORBIDDEN" });
      return;
    }
    if (
      error instanceof PlatformImpersonationTokenConsumedError ||
      error instanceof PlatformImpersonationStateUnavailableError
    ) {
      sendJson(res, error.statusCode, {
        error: error.statusCode === 503 ? "service_unavailable" : "unauthorized",
        code: error.code,
      });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleEndPlatformImpersonation(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readIdentityRequestBody(req);
    const sessionToken = readSessionTokenField(body);
    if (!sessionToken) {
      throw new IdentityRequiredError();
    }
    await endPlatformImpersonationSession(sessionToken);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    if (
      error instanceof PlatformImpersonationTokenConsumedError ||
      error instanceof PlatformImpersonationStateUnavailableError
    ) {
      sendJson(res, error.statusCode, {
        error: error.statusCode === 503 ? "service_unavailable" : "unauthorized",
        code: error.code,
      });
      return;
    }
    handleHttpError(res, error);
  }
}
