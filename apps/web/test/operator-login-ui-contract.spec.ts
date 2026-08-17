/**
 * Operator login UI contract — OTP segment + coded errors
 * Authority: docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md §5
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");

describe("operator-login-ui-contract.spec.ts", () => {
  const loginForm = readFileSync(join(WEB_ROOT, "app/auth/login/login-form.tsx"), "utf8");
  const navigateAfterAuth = readFileSync(
    join(WEB_ROOT, "src/auth/navigate-after-auth-session-change.ts"),
    "utf8"
  );
  const requestOtpRoute = readFileSync(
    join(WEB_ROOT, "app/api/auth/request-otp/route.ts"),
    "utf8"
  );
  const loginSessionRoute = readFileSync(
    join(WEB_ROOT, "app/api/auth/login-web-session/route.ts"),
    "utf8"
  );
  const phonePreflightRoute = readFileSync(
    join(WEB_ROOT, "app/api/auth/phone-preflight/route.ts"),
    "utf8"
  );
  const logoutRoute = readFileSync(join(WEB_ROOT, "app/api/auth/logout/route.ts"), "utf8");
  const dashboardPage = readFileSync(
    join(WEB_ROOT, "app/(app)/dashboard/dashboard-page-client.tsx"),
    "utf8"
  );
  const welcomeGate = readFileSync(
    join(WEB_ROOT, "src/admin/onboarding/operator-welcome-gate.tsx"),
    "utf8"
  );
  const operatorShell = readFileSync(join(WEB_ROOT, "src/admin/shell/operator-shell.tsx"), "utf8");

  it("WEB-LOGIN-UI-01 login form uses OtpSegmentInput and coded error resolver", () => {
    assert.match(loginForm, /OtpSegmentInput/);
    assert.match(loginForm, /resolveLoginErrorMessage/);
    assert.match(loginForm, /readPhoneForSubmit/);
    assert.match(loginForm, /normalizeNumericInputValue/);
    assert.match(loginForm, /OPERATOR_LOGIN_TEST_IDS\.phoneError/);
    assert.match(loginForm, /OPERATOR_LOGIN_TEST_IDS\.otpError/);
    assert.doesNotMatch(loginForm, /requires_registration/);
    assert.doesNotMatch(loginForm, /data\.message/);
  });

  it("GL-OTP-01-OP operator OTP sink is unnamed and cells use auth i18n", () => {
    const otpInput = readFileSync(
      join(WEB_ROOT, "src/features/auth/otp-segment-input.tsx"),
      "utf8"
    );
    const faAuth = JSON.parse(
      readFileSync(join(WEB_ROOT, "messages/fa/auth.json"), "utf8")
    ) as { readonly otpDigitLabel?: string; readonly otpLabel?: string };
    const enAuth = JSON.parse(
      readFileSync(join(WEB_ROOT, "messages/en/auth.json"), "utf8")
    ) as { readonly otpDigitLabel?: string; readonly otpLabel?: string };
    assert.match(otpInput, /data-otp-autofill-sink/);
    assert.match(otpInput, /aria-hidden="true"/);
    assert.match(otpInput, /tabIndex=\{-1\}/);
    assert.match(otpInput, /otpDigitLabel/);
    assert.match(otpInput, /otpLabel/);
    assert.doesNotMatch(otpInput, /Digit \$\{index/);
    assert.doesNotMatch(loginForm, /htmlFor="otp"/);
    assert.equal(faAuth.otpDigitLabel, "رقم {index}");
    assert.equal(enAuth.otpDigitLabel, "Digit {index}");
    assert.equal(faAuth.otpLabel, "رمز یک‌بارمصرف");
    assert.equal(enAuth.otpLabel, "Verification code");
  });

  it("WEB-LOGIN-UI-02 dev OTP hint gated to development", () => {
    assert.match(loginForm, /process\.env\.NODE_ENV === "development"/);
    assert.match(loginForm, /showDevOtpHint/);
    assert.match(loginForm, /initialLoginPhone/);
    assert.match(loginForm, /initialLoginOtp/);
  });

  it("WEB-LOGIN-UI-03 resend cooldown and change-phone reset challenge", () => {
    assert.match(loginForm, /RESEND_COOLDOWN_SEC/);
    assert.match(loginForm, /resendOtpIn/);
    assert.match(loginForm, /setChallengeId\(""\)/);
  });

  it("WEB-LOGIN-UI-04 BFF routes return stable error codes", () => {
    assert.match(requestOtpRoute, /bffCodedError/);
    assert.match(requestOtpRoute, /MOBILE_REQUIRED/);
    assert.match(requestOtpRoute, /checkBffLoginRateLimit/);
    assert.match(loginSessionRoute, /bffCodedError/);
    assert.match(loginSessionRoute, /OTP_PAYLOAD_INVALID/);
    assert.match(loginSessionRoute, /AUTH_PHONE_NOT_AUTHORIZED/);
    assert.doesNotMatch(loginSessionRoute, /requires_registration:\s*true/);
    assert.doesNotMatch(requestOtpRoute, /message:/);
    assert.doesNotMatch(loginSessionRoute, /message:/);
  });

  it("WEB-LOGIN-UI-05 phone-preflight BFF proxies authorized flag", () => {
    assert.match(phonePreflightRoute, /\/auth\/phone-preflight/);
    assert.match(phonePreflightRoute, /bffCodedError/);
    assert.match(phonePreflightRoute, /authorized:\s*payload\.authorized === true/);
    assert.match(phonePreflightRoute, /AUTH_PREFLIGHT_FAILED/);
  });

  it("WEB-LOGIN-UI-06 post-auth login uses document navigation; logout stays soft", () => {
    assert.match(loginForm, /navigateAfterLogin/);
    assert.match(navigateAfterAuth, /window\.location\.assign/);
    assert.match(operatorShell, /navigateAfterLogout/);
    assert.doesNotMatch(operatorShell, /window\.location\.href/);
  });

  it("WEB-LOGIN-UI-07 owner-only panel gate wired (DEC-P9-018)", () => {
    assert.match(loginForm, /shouldShowOwnerOnlyBanner/);
    assert.match(loginForm, /OPERATOR_LOGIN_TEST_IDS\.ownerOnlyBanner/);
    assert.match(loginSessionRoute, /AUTH_OWNER_PANEL_ONLY/);
    assert.match(loginSessionRoute, /sessionRole !== "owner"/);
    const middleware = readFileSync(join(WEB_ROOT, "middleware.ts"), "utf8");
    assert.match(middleware, /AUTH_OWNER_PANEL_ONLY/);
    assert.match(middleware, /owner-only/);
  });

  it("WEB-LOGIN-UI-08 welcome-back wired via BFF cookie + dashboard gate (no duplicate client arm)", () => {
    assert.match(loginSessionRoute, /setOperatorWelcomeArmedCookieOnResponse/);
    assert.match(logoutRoute, /clearOperatorWelcomeArmedCookieOnResponse/);
    assert.match(dashboardPage, /OperatorWelcomeGate/);
    assert.match(welcomeGate, /syncOperatorWelcomeFromLoginCookie/);
    assert.match(welcomeGate, /markOperatorWelcomePresentedThisLogin/);
    assert.match(welcomeGate, /isOperatorWelcomePresentedThisLogin/);
    assert.match(operatorShell, /clearOperatorWelcomeSession/);
    assert.doesNotMatch(loginForm, /armOperatorWelcomeForLogin/);
  });
});
