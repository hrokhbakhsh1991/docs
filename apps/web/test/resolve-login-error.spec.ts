/**
 * Login error code → localized message mapping
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { resolveLoginErrorMessage } from "../src/features/auth/resolve-login-error";

const testDir = dirname(fileURLToPath(import.meta.url));
const faAuth = JSON.parse(
  readFileSync(resolve(testDir, "../messages/fa/auth.json"), "utf8")
) as { errors: Record<string, string> };

function faTranslate(key: string): string {
  const path = key.split(".");
  let current: unknown = faAuth;
  for (const segment of path) {
    if (current === null || typeof current !== "object") {
      return key;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : key;
}

const LOGIN_ERROR_CATALOG = [
  "MOBILE_REQUIRED",
  "MOBILE_INVALID",
  "AUTH_PHONE_NOT_AUTHORIZED",
  "OTP_RATE_LIMITED",
  "OTP_REQUEST_FAILED",
  "OTP_PAYLOAD_INVALID",
  "OTP_CHALLENGE_INVALID",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "BACKEND_UNREACHABLE",
  "SESSION_TOKEN_MISSING",
  "AUTH_PREFLIGHT_FAILED",
] as const;

describe("resolve-login-error.spec.ts", () => {
  it("WEB-ERR-01 maps AUTH_PHONE_NOT_AUTHORIZED to Persian copy", () => {
    const message = resolveLoginErrorMessage(faTranslate, "AUTH_PHONE_NOT_AUTHORIZED");
    assert.match(message, /امکان ورود/);
    assert.doesNotMatch(message, /workspace/i);
  });

  it("WEB-ERR-02 maps OTP_INVALID to Persian copy", () => {
    const message = resolveLoginErrorMessage(faTranslate, "OTP_INVALID");
    assert.match(message, /درست نیست/);
  });

  it("WEB-ERR-03 resolves every catalog code to non-empty Persian copy", () => {
    for (const code of LOGIN_ERROR_CATALOG) {
      const message = resolveLoginErrorMessage(faTranslate, code);
      assert.ok(message.length > 0, `empty message for ${code}`);
      assert.notEqual(message, code, `unmapped code leaked: ${code}`);
      assert.doesNotMatch(message, /workspace/i);
    }
  });

  it("WEB-ERR-04 unknown code falls back to i18n key path", () => {
    const message = resolveLoginErrorMessage(faTranslate, "UNKNOWN_TEST_CODE");
    assert.equal(message, "errors.UNKNOWN_TEST_CODE");
  });
});
