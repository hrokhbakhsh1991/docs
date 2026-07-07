import type { IncomingMessage, ServerResponse } from "node:http";

import {
  OtpChallengeInvalidError,
  OtpExpiredError,
  OtpInvalidError,
} from "../../identity/identity.errors.ts";
import { verifyMobileOtp } from "../../identity/otp.service.ts";
import { normalizeLoginMobile } from "../../identity/phone-login-authorization.ts";
import { PlatformForbidden, PlatformValidation } from "../../platform/platform.errors.ts";
import { resolvePlatformOpsPhoneAccess } from "../../platform/resolve-platform-ops-phone-access.ts";
import { signPlatformOpsSessionToken } from "../../platform/sign-platform-ops-session-token.ts";
import { sendJson } from "../../http/json.ts";

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
}

export async function handlePlatformAuthVerifyOtp(
  req: IncomingMessage,
  res: ServerResponse
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
    const challengeId =
      (typeof body.challengeId === "string" ? body.challengeId : "") ||
      (typeof body.challenge_id === "string" ? body.challenge_id : "");
    const code =
      (typeof body.code === "string" ? body.code : "") ||
      (typeof body.otp === "string" ? body.otp : "");

    if (mobile.length === 0 || challengeId.length === 0 || code.length === 0) {
      throw new PlatformValidation("invalid payload");
    }

    const access = await resolvePlatformOpsPhoneAccess(mobile);
    if (access === null) {
      throw new PlatformForbidden();
    }

    const verified = await verifyMobileOtp(challengeId, code);
    if (verified.mobile !== mobile) {
      throw new PlatformValidation("mobile mismatch");
    }

    const platformSessionToken = await signPlatformOpsSessionToken({
      phone: mobile,
      role: access.role,
    });

    sendJson(res, 200, {
      ok: true,
      mobile,
      role: access.role,
      platformSessionToken,
    });
  } catch (err: unknown) {
    if (
      err instanceof OtpInvalidError ||
      err instanceof OtpExpiredError ||
      err instanceof OtpChallengeInvalidError
    ) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "otp_invalid", code: "OTP_INVALID" }));
      return;
    }
    if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
      return;
    }
    if (err instanceof PlatformForbidden || (err as { code?: string })?.code === "PLATFORM_FORBIDDEN") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
