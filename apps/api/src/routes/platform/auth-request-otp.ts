import type { IncomingMessage, ServerResponse } from "node:http";

import { normalizeLoginMobile } from "../../identity/phone-login-authorization.ts";
import { PlatformForbidden, PlatformValidation } from "../../platform/platform.errors.ts";
import { resolvePlatformOpsPhoneAccess } from "../../platform/resolve-platform-ops-phone-access.ts";
import { sendJson } from "../../http/json.ts";

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
}

export async function handlePlatformAuthRequestOtp(
  req: IncomingMessage,
  res: ServerResponse,
  deps: {
    readonly resolveAccess?: typeof resolvePlatformOpsPhoneAccess;
    readonly createChallenge?: (
      mobile: string,
      context: { tenantId: null; workspaceType: "platform"; purpose: "platform_ops_login" }
    ) => Promise<{ challengeId: string; otpLength: number }>;
  } = {}
): Promise<void> {
  try {
    const body = await readJsonBody(req);
    const mobileRaw =
      typeof body.mobile === "string"
        ? body.mobile
        : typeof body.phone === "string"
          ? body.phone
          : "";
    const mobile = normalizeLoginMobile(mobileRaw.trim());
    if (mobile.length === 0) {
      throw new PlatformValidation("mobile required");
    }

    const access = await (deps.resolveAccess ?? resolvePlatformOpsPhoneAccess)(mobile);
    if (access === null) {
      throw new PlatformForbidden();
    }

    const createChallenge =
      deps.createChallenge ??
      (async (
        phone: string,
        context: { tenantId: null; workspaceType: "platform"; purpose: "platform_ops_login" }
      ) => {
        const { createMobileOtpChallenge } = await import("../../identity/otp.service.ts");
        return createMobileOtpChallenge(phone, undefined, context);
      });
    const { challengeId } = await createChallenge(mobile, {
      tenantId: null,
      workspaceType: "platform",
      purpose: "platform_ops_login",
    });
    sendJson(res, 200, { challengeId });
  } catch (err: unknown) {
    if (
      err instanceof PlatformValidation ||
      (err as { code?: string })?.code === "PLATFORM_VALIDATION"
    ) {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
      return;
    }
    if (
      err instanceof PlatformForbidden ||
      (err as { code?: string })?.code === "PLATFORM_FORBIDDEN"
    ) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
      return;
    }
    const candidate =
      (err as { code?: string })?.code ?? (err instanceof Error ? err.message : undefined);
    const code =
      typeof candidate === "string" && PLATFORM_SMS_SERVICE_ERRORS.has(candidate)
        ? candidate
        : undefined;
    if (code !== undefined) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "service_unavailable", code }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}

const PLATFORM_SMS_SERVICE_ERRORS = new Set([
  "PLATFORM_SMS_CONFIG_INVALID",
  "PLATFORM_SMS_ENCRYPTION_KEY_INVALID",
  "PLATFORM_SMS_RATE_LIMIT_INVALID",
  "PLATFORM_SMS_RATE_LIMIT_UNAVAILABLE",
  "PLATFORM_SMS_TEMPLATE_SCOPE_MISMATCH",
  "PLATFORM_SMS_DELIVERY_DISABLED",
  "PLATFORM_SMS_STATIC_OTP_FORBIDDEN",
  "PLATFORM_SMS_FIXTURE_OTP_FORBIDDEN",
  "PLATFORM_SMS_CONTEXT_REQUIRED",
  "PLATFORM_SMS_CONTEXT_INVALID",
  "PLATFORM_SMS_MODE_REQUIRED",
]);
