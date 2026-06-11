/**
 * Phase 9.1 — operator admin login (invite-only; no self-registration)
 * Authority: docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  OPERATOR_LOGIN_MESSAGE_KEYS,
  OPERATOR_LOGIN_TEST_IDS,
} from "../src/features/auth/operator-login-copy";
import {
  buildRegisterRedirectTarget,
  resolveNoMembershipLoginMessageKey,
  shouldShowInviteOnlyBanner,
} from "../src/features/auth/operator-login-logic";

const testDir = dirname(fileURLToPath(import.meta.url));
const enAuthMessages = JSON.parse(
  readFileSync(resolve(testDir, "../messages/en/auth.json"), "utf8")
) as {
  inviteOnlyFooter: string;
  inviteOnlyBanner: string;
  resendOtp: string;
  errors: Record<string, string>;
};
const faAuthMessages = JSON.parse(
  readFileSync(resolve(testDir, "../messages/fa/auth.json"), "utf8")
) as { errors: Record<string, string> };

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

/** Legacy codes kept in i18n for old clients — login BFF must not emit these. */
const LEGACY_LOGIN_ERROR_CODES = ["INVALID_INPUT"] as const;

describe("auth-operator-login.spec.ts — Phase 9.1 admin login", () => {
  it("WEB-9.1-06 register path redirects to invite-only login banner query", () => {
    assert.equal(buildRegisterRedirectTarget(), "/auth/login?access=invite-only");
  });

  it("WEB-9.1-07 no-membership message does not mention self-registration", () => {
    const key = resolveNoMembershipLoginMessageKey();
    assert.equal(key, OPERATOR_LOGIN_MESSAGE_KEYS.noMembershipError);
    const message = enAuthMessages.errors.noMembership;
    assert.match(message, /authorized/i);
    assert.doesNotMatch(message, /workspace/i);
    assert.doesNotMatch(message, /not implemented/i);
  });

  it("WEB-9.1-08 invite-only banner query is recognized", () => {
    assert.equal(shouldShowInviteOnlyBanner(new URLSearchParams("access=invite-only")), true);
    assert.equal(shouldShowInviteOnlyBanner(new URLSearchParams()), false);
  });

  it("WEB-9.1-09 login copy states authorized access without workspace jargon", () => {
    assert.match(enAuthMessages.inviteOnlyFooter, /authorized/i);
    assert.match(enAuthMessages.inviteOnlyBanner, /Public registration is not available/i);
    assert.doesNotMatch(enAuthMessages.inviteOnlyFooter, /workspace owner/i);
  });

  it("WEB-9.1-10 login form exposes field-level error test ids", () => {
    assert.equal(OPERATOR_LOGIN_TEST_IDS.phoneError, "operator-login-phone-error");
    assert.equal(OPERATOR_LOGIN_TEST_IDS.otpError, "operator-login-otp-error");
  });

  it("WEB-9.1-11 auth.errors catalog includes all login error codes", () => {
    for (const code of LOGIN_ERROR_CATALOG) {
      assert.ok(
        typeof enAuthMessages.errors[code] === "string" && enAuthMessages.errors[code].length > 0,
        `missing en auth.errors.${code}`
      );
      assert.ok(
        typeof faAuthMessages.errors[code] === "string" && faAuthMessages.errors[code].length > 0,
        `missing fa auth.errors.${code}`
      );
    }
    assert.match(enAuthMessages.errors.AUTH_PHONE_NOT_AUTHORIZED, /authorized/i);
    assert.match(faAuthMessages.errors.AUTH_PHONE_NOT_AUTHORIZED, /امکان ورود/);
    assert.doesNotMatch(faAuthMessages.errors.AUTH_PHONE_NOT_AUTHORIZED, /workspace/i);
    assert.match(enAuthMessages.resendOtp, /resend/i);
  });

  it("WEB-9.1-12 legacy INVALID_INPUT remains in i18n but outside active login catalog", () => {
    assert.ok(typeof enAuthMessages.errors.INVALID_INPUT === "string");
    assert.ok(typeof faAuthMessages.errors.INVALID_INPUT === "string");
    for (const code of LEGACY_LOGIN_ERROR_CODES) {
      assert.ok(
        !(LOGIN_ERROR_CATALOG as readonly string[]).includes(code),
        `${code} must not be in active login catalog`
      );
    }
  });
});
