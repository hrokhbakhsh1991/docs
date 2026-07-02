import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import {
  MobileAlreadyRegisteredError,
  OtpChallengeInvalidError,
  OtpExpiredError,
  OtpInvalidError,
} from "./identity.errors";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import { readIdentityRequestBody } from "./read-identity-request-body";
import {
  MobileChallengeMismatchError,
  MobileUnchangedError,
  requestIdentityMobileChangeOtp,
  verifyIdentityMobileChangeAndCommit,
} from "./me.mobile.service";
import { MobileInvalidError } from "./phone-preflight.errors";
import { OtpRateLimitedError } from "./otp-rate-limit";
import { requireOperatorSession } from "./require-operator-session";

function readStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) {
    return "";
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function handlePostIdentityMeMobileRequestOtp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const mobile = readStringField(body, "mobile");
    if (mobile.length === 0) {
      sendHttpError(res, 400, { error: "validation_error", code: "MOBILE_REQUIRED" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await requestIdentityMobileChangeOtp(auth, mobile);
        sendJson(res, 200, { challengeId: result.challengeId });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof MobileInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof MobileUnchangedError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof MobileAlreadyRegisteredError) {
      sendHttpError(res, 409, { error: "conflict", code: error.code });
      return;
    }
    if (error instanceof OtpRateLimitedError) {
      sendHttpError(res, 429, { error: "rate_limited", code: error.code });
      return;
    }
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePostIdentityMeMobileVerify(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const mobile = readStringField(body, "mobile");
    const challengeId = readStringField(body, "challengeId");
    const code = readStringField(body, "code");
    if (mobile.length === 0) {
      sendHttpError(res, 400, { error: "validation_error", code: "MOBILE_REQUIRED" });
      return;
    }
    if (challengeId.length === 0 || code.length === 0) {
      sendHttpError(res, 400, { error: "validation_error", code: "OTP_PAYLOAD_INVALID" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await verifyIdentityMobileChangeAndCommit(auth, mobile, challengeId, code);
        sendJson(res, 200, {
          profile: result.profile,
          sessionToken: result.sessionToken,
        });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof MobileInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof MobileUnchangedError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof MobileAlreadyRegisteredError) {
      sendHttpError(res, 409, { error: "conflict", code: error.code });
      return;
    }
    if (error instanceof MobileChallengeMismatchError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof OtpInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof OtpExpiredError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof OtpChallengeInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
      return;
    }
    handleHttpError(res, error);
  }
}
