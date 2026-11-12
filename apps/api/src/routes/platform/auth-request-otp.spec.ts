import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { handlePlatformAuthRequestOtp } from "./auth-request-otp.ts";

function request(body: unknown): IncomingMessage {
  return Readable.from([JSON.stringify(body)]) as unknown as IncomingMessage;
}

function response() {
  let statusCode = 0;
  let responseBody = "";
  const res = {
    set statusCode(status: number) {
      statusCode = status;
    },
    get statusCode() {
      return statusCode;
    },
    setHeader() {
      return res;
    },
    writeHead(status: number) {
      statusCode = status;
      return res;
    },
    end(body?: string) {
      responseBody = body ?? "";
      return res;
    },
  } as unknown as ServerResponse;
  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return JSON.parse(responseBody);
    },
  };
}

test("platform OTP requests use the separate platform SMS accounting scope", async () => {
  let received: { mobile: string; context: unknown } | undefined;
  const output = response();
  await handlePlatformAuthRequestOtp(request({ mobile: "+989224180093" }), output.res, {
    resolveAccess: async () => ({ role: "owner" }),
    createChallenge: async (mobile, context) => {
      received = { mobile, context };
      return { challengeId: "challenge-platform", otpLength: 4 };
    },
  });

  assert.equal(output.statusCode, 200);
  assert.equal(received?.mobile, "09224180093");
  assert.deepEqual(received?.context, {
    tenantId: null,
    workspaceType: "platform",
    purpose: "platform_ops_login",
  });
  assert.deepEqual(output.body, { challengeId: "challenge-platform" });
});

test("platform OTP reports missing platform template as an actionable service error", async () => {
  const output = response();
  await handlePlatformAuthRequestOtp(request({ mobile: "09224180093" }), output.res, {
    resolveAccess: async () => ({ role: "owner" }),
    createChallenge: async () => {
      throw new Error("PLATFORM_SMS_CONFIG_INVALID");
    },
  });

  assert.equal(output.statusCode, 503);
  assert.deepEqual(output.body, {
    error: "service_unavailable",
    code: "PLATFORM_SMS_CONFIG_INVALID",
  });
});

test("platform OTP never exposes unexpected configuration or provider error text", async () => {
  const output = response();
  await handlePlatformAuthRequestOtp(request({ mobile: "09224180093" }), output.res, {
    resolveAccess: async () => ({ role: "owner" }),
    createChallenge: async () => {
      throw new Error("provider secret must not leak");
    },
  });
  assert.equal(output.statusCode, 500);
  assert.deepEqual(output.body, { error: "internal_error" });
});
