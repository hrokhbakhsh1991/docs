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
    if (mobile.length === 0) {
      throw new PlatformValidation("mobile required");
    }

    const access = await resolvePlatformOpsPhoneAccess(mobile);
    if (access === null) {
      throw new PlatformForbidden();
    }

    const { createMobileOtpChallenge } = await import("../../identity/otp.service.ts");
    const { challengeId } = await createMobileOtpChallenge(mobile);
    sendJson(res, 200, { challengeId });
  } catch (err: unknown) {
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
