import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { readRequestJwtSessionVersion } from "../tenant-kernel/jwt-session-claim";
import { getIdentityRepository } from "./create-identity-repository";
import { OtpChallengeInvalidError, OtpExpiredError, OtpInvalidError } from "./identity.errors";
import { OtpRateLimitedError } from "./otp-rate-limit";
import { PasswordKdfBusyError } from "./password-kdf-gate";
import {
  PasswordManagementError,
  changeOwnPassword,
  requestOwnPasswordChangeOtp,
} from "./password-management.service";
import { readIdentityRequestBody } from "./read-identity-request-body";
import { requireOperatorSession } from "./require-operator-session";

function enabled(res: ServerResponse): boolean {
  if (process.env.PASSWORD_AUTH_ENABLED?.trim() === "true") return true;
  sendHttpError(res, 404, { error: "not_found", code: "PASSWORD_AUTH_DISABLED" });
  return false;
}

function field(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function versionOrThrow(req: IncomingMessage): number {
  const version = readRequestJwtSessionVersion(req);
  if (version === undefined) throw new PasswordManagementError("PASSWORD_SESSION_INVALID");
  return version;
}

function handlePasswordError(res: ServerResponse, error: unknown): void {
  if (error instanceof PasswordKdfBusyError) {
    sendHttpError(res, 503, { error: "service_unavailable", code: error.code });
  } else if (error instanceof OtpRateLimitedError) {
    sendHttpError(res, 429, { error: "rate_limited", code: error.code });
  } else if (
    error instanceof OtpInvalidError ||
    error instanceof OtpExpiredError ||
    error instanceof OtpChallengeInvalidError
  ) {
    sendHttpError(res, 401, { error: "unauthorized", code: error.code });
  } else if (error instanceof PasswordManagementError) {
    const status =
      error.code === "PASSWORD_SESSION_INVALID" || error.code === "PASSWORD_CHALLENGE_INVALID"
        ? 401
        : 400;
    sendHttpError(res, status, {
      error: status === 401 ? "unauthorized" : "validation_error",
      code: error.code,
    });
  } else {
    handleHttpError(res, error);
  }
}

export async function handleGetOwnPasswordStatus(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!enabled(res)) return;
  try {
    const auth = await requireOperatorSession(req);
    versionOrThrow(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const hash = await getIdentityRepository().findPasswordHash(auth.userId);
        sendJson(res, 200, { hasPassword: hash !== null });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handlePasswordError(res, error);
  }
}

export async function handleRequestOwnPasswordOtp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!enabled(res)) return;
  try {
    const auth = await requireOperatorSession(req);
    const version = versionOrThrow(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await requestOwnPasswordChangeOtp(auth, version);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handlePasswordError(res, error);
  }
}

export async function handleSetOwnPassword(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!enabled(res)) return;
  try {
    const auth = await requireOperatorSession(req);
    const version = versionOrThrow(req);
    const body = await readIdentityRequestBody(req);
    const challengeId = field(body, "challengeId").trim();
    const code = field(body, "code").trim();
    const password = field(body, "password");
    if (!challengeId || !code || !password) {
      sendHttpError(res, 400, { error: "validation_error", code: "PASSWORD_PAYLOAD_INVALID" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await changeOwnPassword(auth, version, { challengeId, code, password });
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handlePasswordError(res, error);
  }
}
