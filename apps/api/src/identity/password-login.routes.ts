import type { IncomingMessage, ServerResponse } from "node:http";
import {
  readPasswordIngressSecret,
  verifyPasswordIngress,
} from "@app-tour/tenant-kernel/password-ingress-server";

import { parseRequestAuth } from "../auth/request-context";
import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { assertRequiredAuthHeaders } from "../tenant-kernel/assert-required-headers";
import { assertTenantActiveForOperatorLogin } from "./assert-tenant-active-for-login";
import { canonicalizeLoginMobile } from "./canonicalize-login-mobile";
import { getIdentityRepository } from "./create-identity-repository";
import { PasswordLoginError, loginWithPassword } from "./password-login.service";
import { PasswordRateLimitError, assertPasswordAttemptLimit } from "./password-rate-limit";
import { PasswordKdfBusyError } from "./password-kdf-gate";
import { readIdentityRequestBody } from "./read-identity-request-body";
import { TenantSuspendedForLoginError } from "./phone-preflight.errors";

function field(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function header(req: IncomingMessage, name: string): string {
  const raw = req.headers[name];
  return typeof raw === "string" ? raw : "";
}

export async function handlePasswordLogin(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (process.env.PASSWORD_AUTH_ENABLED?.trim() !== "true") {
    sendHttpError(res, 404, { error: "not_found", code: "PASSWORD_AUTH_DISABLED" });
    return;
  }
  try {
    const headers = readRequestAuthHeaders(req);
    assertRequiredAuthHeaders(headers);
    const tenantId = parseRequestAuth(headers).tenantId;
    const body = await readIdentityRequestBody(req);
    const mobile = canonicalizeLoginMobile(field(body, "mobile"));
    const password = field(body, "password");
    const ip = header(req, "x-password-client-ip");
    const timestamp = Number(header(req, "x-password-client-time"));
    const proof = header(req, "x-password-client-proof");
    const secret = readPasswordIngressSecret();
    if (
      secret === null ||
      !verifyPasswordIngress({ tenantId, mobile, ip, timestamp }, proof, secret)
    ) {
      sendHttpError(res, 403, { error: "forbidden", code: "PASSWORD_INGRESS_INVALID" });
      return;
    }
    const result = await loginWithPassword(
      { tenantId, mobile, password, clientIp: ip },
      {
        repo: getIdentityRepository(),
        assertTenant: async (id) => assertTenantActiveForOperatorLogin(id),
        assertAttempt: assertPasswordAttemptLimit,
      }
    );
    sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof TenantSuspendedForLoginError) {
      sendJson(res, 403, { error: error.code, code: error.code });
    } else if (error instanceof PasswordLoginError) {
      sendHttpError(res, 401, { error: "unauthorized", code: error.code });
    } else if (error instanceof PasswordKdfBusyError) {
      sendHttpError(res, 503, { error: "service_unavailable", code: error.code });
    } else if (error instanceof PasswordRateLimitError) {
      const status = error.code === "PASSWORD_RATE_LIMITED" ? 429 : 503;
      sendHttpError(res, status, {
        error: status === 429 ? "rate_limited" : "service_unavailable",
        code: error.code,
      });
    } else {
      handleHttpError(res, error);
    }
  }
}
