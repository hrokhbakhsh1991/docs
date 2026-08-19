import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const denaliThemeRoot = join(repoRoot, "packages/workspaces/denali/theme");

describe("portal alpine split login presentation", () => {
  it("scopes Alpine Split CSS to Denali /login full page only", () => {
    const skin = readFileSync(join(denaliThemeRoot, "denali-portal.css"), "utf8");
    const alpine = readFileSync(join(denaliThemeRoot, "portal/alpine-login.css"), "utf8");
    assert.match(skin, /portal\/alpine-login\.css/);
    assert.match(alpine, /main\[data-portal-member-login-page\]\[data-portal-login-full-page\]/);
    assert.doesNotMatch(alpine, /data-portal-login-modal-body/);
    assert.doesNotMatch(alpine, /data-catalog-registration-page/);
    assert.match(alpine, /\/auth\/alborz\.webp/);
    assert.match(alpine, /--portal-alpine-band/);
    assert.match(alpine, /max-height:\s*32rem/);
    assert.match(alpine, /\[data-portal-auth-layout\]/);
    assert.match(alpine, /display: contents/);
    assert.match(alpine, /minmax\(25\.5rem,\s*42%\)/);
    assert.match(alpine, /max-width:\s*48rem/);
    assert.match(alpine, /max-width:\s*56rem/);
    assert.match(alpine, /max-width:\s*24\.375rem/);
    assert.match(alpine, /max-width:\s*22\.5rem/);
    assert.match(alpine, /\[data-portal-otp-hero\]/);
    assert.match(alpine, /\[data-dev-otp-hint\]/);
    assert.match(alpine, /p\[role="alert"\]|\[role="alert"\][\s\S]*display:\s*block/);
    assert.match(
      alpine,
      /\[data-portal-auth-card\][\s\S]*button\[type="button"\]\[data-action="send-code"\]/
    );
    assert.match(alpine, /background-image:\s*none/);
    assert.doesNotMatch(alpine, /denali-form-controls/);
  });

  it("login Back is after the form in DOM so Tab matches visual order", () => {
    const chrome = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/portal-registration-chrome.tsx"),
      "utf8"
    );
    const thinHost = readFileSync(
      join(repoRoot, "apps/portal/src/auth/portal-login-thin-host.tsx"),
      "utf8"
    );
    assert.match(chrome, /memberLoginEgress \? null/);
    assert.match(chrome, /backToTour/);
    assert.doesNotMatch(chrome, /backToMarketing/);
    const formIdx = thinHost.indexOf("data-portal-login-form-panel");
    const backIdx = thinHost.indexOf("data-portal-registration-back");
    assert.ok(formIdx > 0 && backIdx > formIdx, "back must follow form panel in thin host");
    assert.match(thinHost, /backToMarketing/);
  });

  it("login page uses sparse title key and does not delete legacy copy keys", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/login/page.tsx"), "utf8");
    const fa = JSON.parse(
      readFileSync(join(repoRoot, "apps/portal/messages/fa/catalogRegistration.json"), "utf8")
    ) as {
      phone: Record<string, string>;
      otp: Record<string, string>;
      profile: Record<string, string>;
    };
    const en = JSON.parse(
      readFileSync(join(repoRoot, "apps/portal/messages/en/catalogRegistration.json"), "utf8")
    ) as {
      phone: Record<string, string>;
      otp: Record<string, string>;
    };
    assert.match(page, /phone\.loginTitle/);
    assert.equal(fa.phone.loginTitle, "ورود");
    assert.equal(en.phone.loginTitle, "Sign in");
    assert.equal(fa.otp.loginTitle, "کد");
    assert.equal(en.otp.loginTitle, "Code");
    assert.equal(fa.profile.emailLabel, "ایمیل، اختیاری");
    assert.doesNotMatch(fa.profile.emailLabel, /[()]/);
    assert.ok(fa.phone.portalHeroTitle);
    assert.ok(fa.phone.portalStoryTitle);
    assert.ok(en.phone.portalHeroTitle);
    assert.ok(en.phone.loginDescription);
  });

  it("login-egress OTP destination uses existing phone state, not a new API", () => {
    const steps = readFileSync(
      join(repoRoot, "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"),
      "utf8"
    );
    assert.match(steps, /readMemberLoginEgress\(context\) \? data\.phone : t\("otp\.sentTo"/);
    assert.match(steps, /transport\.requestOtp/);
    assert.match(steps, /transport\.verifyOtp/);
  });
});
