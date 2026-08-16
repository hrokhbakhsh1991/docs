/**
 * GL-BRAND-01 — guest chrome never falls back to pluginId / "Portal".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const portalRoot = join(repoRoot, "apps/portal");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

function readChromeDefaultSiteName(locale: "fa" | "en"): string | undefined {
  const raw = JSON.parse(
    readFileSync(join(portalRoot, `messages/${locale}/catalogRegistration.json`), "utf8")
  ) as { readonly chrome?: { readonly defaultSiteName?: string } };
  return raw.chrome?.defaultSiteName;
}

function readMarketingDefaultSiteName(locale: "fa" | "en"): string | undefined {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, `apps/marketing/messages/${locale}/catalog.json`), "utf8")
  ) as { readonly nav?: { readonly defaultSiteName?: string } };
  return raw.nav?.defaultSiteName;
}

describe("portal-guest-chrome-branding.spec.ts", () => {
  it("GL-BRAND-01 login chrome uses shared displayName helper, not Portal", () => {
    const chrome = readPortal("src/catalog/portal-registration-chrome.tsx");
    assert.match(chrome, /resolveGuestChromeDisplayName/);
    assert.match(chrome, /chrome\.defaultSiteName/);
    assert.doesNotMatch(chrome, /\|\| ["']Portal["']/);
  });

  it("GL-BRAND-01 member shell uses shared displayName helper, not pluginId", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /resolveGuestChromeDisplayName/);
    assert.match(layout, /chrome\.defaultSiteName/);
    assert.doesNotMatch(layout, /branding\.displayName\?\.trim\(\) \|\| bootstrap\.pluginId/);
  });

  it("GL-BRAND-01 document title is branding, not hardcoded Portal", () => {
    const layout = readPortal("app/layout.tsx");
    assert.match(layout, /generateMetadata/);
    assert.match(layout, /resolveGuestChromeDisplayName/);
    assert.doesNotMatch(layout, /default: ["']Portal["']/);
  });

  it("GL-BRAND-01 portal fallback literals stay aligned with marketing", () => {
    assert.equal(readChromeDefaultSiteName("fa"), readMarketingDefaultSiteName("fa"));
    assert.equal(readChromeDefaultSiteName("en"), readMarketingDefaultSiteName("en"));
    assert.equal(readChromeDefaultSiteName("fa"), "باشگاه");
    assert.equal(readChromeDefaultSiteName("en"), "Club");
  });

  it("GL-BRAND-02 guest apps do not hardcode the club trade name", () => {
    const files = [
      "src/catalog/portal-registration-chrome.tsx",
      "app/me/layout.tsx",
      "app/layout.tsx",
      "app/login/page.tsx",
    ] as const;
    for (const relative of files) {
      assert.doesNotMatch(readPortal(relative), /shenski/i);
    }
  });

  it("GL-POLISH-01 portal metadata and rewrite serve a generic favicon", () => {
    const layout = readPortal("app/layout.tsx");
    const nextConfig = readPortal("next.config.ts");
    const icon = readFileSync(join(portalRoot, "public/icon.svg"), "utf8");
    assert.match(layout, /url: "\/icon\.svg"/);
    assert.match(nextConfig, /source: "\/favicon\.ico"/);
    assert.match(nextConfig, /destination: "\/icon\.svg"/);
    assert.match(icon, /viewBox="0 0 32 32"/);
    assert.doesNotMatch(icon, /shenski|denali/i);
  });

  it("GL-BRAND-03 member chip uses shared helper, not hardcoded Member", () => {
    const layout = readPortal("app/me/layout.tsx");
    const fa = JSON.parse(
      readFileSync(join(portalRoot, "messages/fa/portalMember.json"), "utf8")
    ) as { readonly nav?: { readonly memberFallback?: string } };
    const en = JSON.parse(
      readFileSync(join(portalRoot, "messages/en/portalMember.json"), "utf8")
    ) as { readonly nav?: { readonly memberFallback?: string } };
    const marketingFa = JSON.parse(
      readFileSync(join(repoRoot, "apps/marketing/messages/fa/catalog.json"), "utf8")
    ) as { readonly nav?: { readonly memberFallback?: string } };
    const marketingEn = JSON.parse(
      readFileSync(join(repoRoot, "apps/marketing/messages/en/catalog.json"), "utf8")
    ) as { readonly nav?: { readonly memberFallback?: string } };
    assert.match(layout, /resolveGuestMemberChipLabel/);
    assert.match(layout, /portalMember\.nav/);
    assert.match(layout, /memberFallback/);
    assert.doesNotMatch(layout, /["']Member["']/);
    assert.doesNotMatch(layout, /guestVisibleProfileMobile/);
    assert.doesNotMatch(layout, /resolveGuestChromeDisplayName\(\s*profile/);
    assert.equal(fa.nav?.memberFallback, "عضو");
    assert.equal(en.nav?.memberFallback, "Member");
    assert.equal(fa.nav?.memberFallback, marketingFa.nav?.memberFallback);
    assert.equal(en.nav?.memberFallback, marketingEn.nav?.memberFallback);
  });

  it("GL-OTP-01-SHELL unused P6 portal OTP shell stays Digit-free", () => {
    const otpInput = readPortal("src/features/auth/otp-segment-input.tsx");
    assert.match(otpInput, /data-otp-autofill-sink/);
    assert.match(otpInput, /otp\.digitLabel/);
    assert.match(otpInput, /otp\.groupLabel/);
    assert.doesNotMatch(otpInput, /Digit \$\{index/);
  });
});
