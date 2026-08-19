/**
 * Quiet Ledger marketing auth-bridge contracts (Phase 3).
 * Source + message assertions — no Portal `/login` restyle.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(marketingRoot, "../..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("marketing login Quiet Ledger bridge", () => {
  it("AB-P3-01 trigger still preventDefault + stays in PDP context", () => {
    const trigger = read("apps/marketing/src/auth/marketing-login-modal-trigger.tsx");
    const modal = read("apps/marketing/src/auth/marketing-login-modal.tsx");
    const flow = read("apps/marketing/src/auth/marketing-login-auth-flow.tsx");
    assert.match(trigger, /preventDefault/);
    assert.match(trigger, /openLoginModal/);
    assert.match(modal, /data-member-login-egress/);
    assert.match(flow, /memberLoginEgress: true/);
    assert.match(modal, /searchParams\.delete\("auth"\)/);
    assert.match(modal, /location\.assign/);
    assert.doesNotMatch(modal, /completeMemberLoginEgress/);
    assert.doesNotMatch(flow, /completeMemberLoginEgress/);
    assert.doesNotMatch(modal, /window\.innerWidth/);
    assert.match(modal, /matchMedia\(DESKTOP_MQ\)/);
    assert.match(modal, /min-width: 48rem/);
  });

  it("AB-P3-02 dialog/sheet + dismiss + focus contracts", () => {
    const modal = read("apps/marketing/src/auth/marketing-login-modal.tsx");
    assert.match(modal, /data-marketing-login-modal-presentation/);
    assert.match(modal, /data-marketing-login-modal-stage/);
    assert.match(modal, /loginModalCancel/);
    assert.match(modal, /stepper\.otp/);
    assert.match(modal, /visualViewport/);
    assert.match(modal, /--kb-inset/);
    assert.match(modal, /event\.key !== "Escape"/);
    assert.match(modal, /onCancel=\{\(event\) => \{\s*event\.preventDefault\(\);/);
    assert.match(modal, /focusAuthField/);
    assert.match(modal, /data-otp-cell="0"/);
    assert.match(modal, /#phone/);
    assert.match(modal, /restoreFocusRef/);
    assert.doesNotMatch(modal, /data-marketing-login-modal-intro/);
    assert.doesNotMatch(modal, />×</);
    assert.doesNotMatch(modal, /phone\.loginDescription/);
    assert.doesNotMatch(modal, /phone\.existingHint/);
  });

  it("AB-P3-03 skin is marketing-scoped Quiet Ledger, not portal modal", () => {
    const css = read(
      "packages/workspaces/denali/theme/marketing/components/37-mkt-login-modal.css"
    );
    assert.match(css, /body\[data-app-surface="marketing"\]\[data-workspace-plugin="denali"\]/);
    assert.match(css, /23\.25rem/);
    assert.match(css, /max-width: 47\.99rem/);
    assert.match(css, /58svh/);
    assert.match(css, /72svh/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(css, /data-phone-hint/);
    assert.match(css, /data-portal-otp-secondary-actions/);
    assert.match(css, /aria-invalid="true"/);
    assert.doesNotMatch(css, /\[data-portal-login-modal\]/);
    assert.doesNotMatch(css, /92dvh/);
    assert.doesNotMatch(css, /swipe/);
  });

  it("AB-P3-04 FA/EN Quiet Ledger strings", () => {
    const en = JSON.parse(
      read("apps/marketing/messages/en/catalogRegistration.json")
    ) as {
      loginPageTitle: string;
      loginModalCancel: string;
      phone: { label: string; sendCode: string; sending: string };
      otp: { sentTo: string; verify: string; resend: string; changePhone: string };
      stepper: { otp: string };
      errors: { MOBILE_REQUIRED: string };
    };
    const fa = JSON.parse(
      read("apps/marketing/messages/fa/catalogRegistration.json")
    ) as typeof en;
    assert.equal(en.loginPageTitle, "Sign in");
    assert.equal(fa.loginPageTitle, "ورود");
    assert.equal(en.loginModalCancel, "Cancel");
    assert.equal(fa.loginModalCancel, "انصراف");
    assert.equal(en.phone.label, "Mobile");
    assert.equal(fa.phone.label, "موبایل");
    assert.equal(en.phone.sendCode, "Send code");
    assert.equal(fa.phone.sendCode, "ارسال کد");
    assert.equal(en.phone.sending, "Sending…");
    assert.equal(fa.phone.sending, "در حال ارسال…");
    assert.equal(en.stepper.otp, "Code");
    assert.equal(fa.stepper.otp, "کد");
    assert.equal(en.otp.sentTo, "{phone}");
    assert.equal(fa.otp.sentTo, "{phone}");
    assert.equal(en.otp.verify, "Verify");
    assert.equal(fa.otp.verify, "تأیید");
    assert.equal(en.otp.resend, "Resend");
    assert.equal(fa.otp.resend, "ارسال مجدد");
    assert.equal(en.otp.changePhone, "Change");
    assert.equal(fa.otp.changePhone, "تغییر");
    assert.equal(en.errors.MOBILE_REQUIRED, "Enter a mobile number.");
    assert.equal(fa.errors.MOBILE_REQUIRED, "شماره موبایل را وارد کنید.");
  });

  it("AB-P3-05 shared auth steps stay Portal-default (no global restyle)", () => {
    const steps = read("packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx");
    const portalModal = read("apps/portal/src/auth/portal-login-modal.tsx");
    assert.match(steps, /data-portal-otp-orbit/);
    assert.match(steps, /otp\.loginTitle/);
    assert.match(portalModal, /data-portal-login-modal/);
    assert.doesNotMatch(portalModal, /loginModalCancel/);
    assert.doesNotMatch(steps, /loginModalCancel/);
  });
});
