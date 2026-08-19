/**
 * PS-VIS-5c — desktop page shell + side rail + settings profile
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const denaliThemeRoot = join(repoRoot, "packages/workspaces/denali/theme");

describe("portal-visual-wave5.spec.ts", () => {
  it("DESK-01 denali-portal imports desktop skin pack; member header is portal-owned", () => {
    const skin = readFileSync(join(denaliThemeRoot, "denali-portal.css"), "utf8");
    assert.match(skin, /portal\/member-shell-desktop\.css/);
    assert.match(skin, /portal\/member-pages-desktop\.css/);
    assert.match(skin, /portal\/member-shell\.css/);
    assert.doesNotMatch(skin, /portal\/marketing-header-parity\.css/);
    assert.doesNotMatch(skin, /marketing\/shell\.css/);
    assert.doesNotMatch(skin, /34-mkt-header-member\.css/);
    assert.doesNotMatch(skin, /35-mkt-header-desktop\.css/);
  });

  it("DESK-02 member-shell-desktop.css uses full-viewport grid + side rail", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-shell-desktop.css"), "utf8");
    assert.match(css, /@media \(min-width: 48rem\)/);
    assert.match(css, /:has\(\[data-portal-shell\]\)/);
    assert.match(css, /\[data-portal-shell\]:not\(\[data-embedded-host\]\)/);
    assert.match(css, /max-height:\s*100dvh/);
    assert.match(css, /min-height:\s*100dvh/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /grid-template-areas/);
    assert.match(css, /"main nav"/);
    assert.match(css, /max-width:\s*none/);
    assert.match(css, /border-radius:\s*0/);
    assert.match(css, /box-shadow:\s*none/);
    assert.match(css, /data-portal-shell-nav-footer/);
    assert.match(css, /margin-top:\s*auto/);
    assert.doesNotMatch(css, /max-width:\s*64rem/);
  });

  it("DESK-03 embedded host excluded from desktop frame", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-shell-desktop.css"), "utf8");
    assert.match(css, /data-embedded-host/);
    assert.doesNotMatch(css, /\[data-portal-shell\]\s*\{/);
  });

  it("DESK-04 member-pages-desktop.css keeps home and trips one column", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-pages-desktop.css"), "utf8");
    assert.match(css, /@media \(min-width: 64rem\)/);
    assert.match(css, /\[data-portal-member-home-quick-links\]/);
    assert.match(
      css,
      /\[data-portal-member-home-quick-links\]\s*\{\s*display:\s*flex;\s*flex-direction:\s*column/
    );
    assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(/);
    assert.match(css, /\[data-portal-member-registrations-list\]/);
    assert.match(css, /flex-direction:\s*column/);
    assert.doesNotMatch(
      css.split("[data-portal-member-registrations-list]")[1]?.split("}")[0] ?? "",
      /repeat\(2,/
    );
  });

  it("DESK-08 profile uses sectioned settings layout (PS-VIS-5g)", () => {
    const profile = readFileSync(join(denaliThemeRoot, "portal/member-profile.css"), "utf8");
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/profile/member-profile-form.tsx"),
      "utf8"
    );
    assert.match(profile, /Desktop settings \(PS-VIS-5g\)/);
    assert.match(profile, /\[data-member-profile-card\]/);
    assert.match(profile, /\[data-member-profile-actions\]/);
    assert.match(profile, /\[data-member-profile-discard\]/);
    assert.match(profile, /data-member-profile-layout="sectioned"/);
    assert.match(profile, /flex-direction:\s*row/);
    assert.match(form, /data-member-profile-layout="sectioned"/);
    assert.match(form, /data-member-profile-card/);
    assert.match(form, /data-member-profile-discard/);
    assert.match(form, /data-member-profile-actions/);
    assert.match(form, /data-member-profile-session/);
    assert.match(profile, /\[data-member-profile-session\]/);
    assert.doesNotMatch(profile, /grid-template-columns:\s*15\.5rem/);
  });

  it("DESK-09 desktop frame doc documents side rail + sectioned profile", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/workspaces/denali/portal-member-desktop-frame.md"),
      "utf8"
    );
    assert.match(doc, /PS-VIS-5e/);
    assert.match(doc, /Side rail/);
    assert.match(doc, /sectioned/i);
    assert.match(doc, /100dvh/);
    assert.match(doc, /PS-VIS-5f/);
    assert.match(doc, /PS-VIS-5g/);
    assert.match(doc, /data-portal-shell-nav-footer/);
    assert.match(doc, /phone-card/);
  });

  it("DESK-05 login-page.css widens and vertically centers auth on desktop", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/login-page.css"), "utf8");
    assert.match(css, /Desktop auth frame \(PS-VIS-5\)/);
    assert.match(css, /justify-content:\s*center/);
    assert.match(css, /\[data-portal-auth-layout\]/);
    assert.match(css, /32rem/);
  });

  it("DESK-06 desktop frame doc exists", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/workspaces/denali/portal-member-desktop-frame.md"),
      "utf8"
    );
    assert.match(doc, /mist canvas/i);
    assert.match(doc, /side rail/i);
    assert.match(doc, /full-viewport/i);
  });

  it("DESK-07 portal-shell-visual E2E includes desktop frame screenshot", () => {
    const spec = readFileSync(
      join(repoRoot, "apps/portal/tests/e2e/portal-shell-visual.spec.ts"),
      "utf8"
    );
    assert.match(spec, /SMK-PTL-VIS-02/);
    assert.match(spec, /setViewportSize/);
    assert.match(spec, /denali-portal-shell-desktop-frame/);
  });
});
