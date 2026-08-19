/**
 * PS-VIS-4 — member shell + module page hooks
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const portalRoot = join(repoRoot, "apps/portal");
const denaliThemeRoot = join(repoRoot, "packages/workspaces/denali/theme");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal-visual-wave4.spec.ts", () => {
  it("VIS-SHELL-04 denali-portal imports member skin pack", () => {
    const skin = readFileSync(join(denaliThemeRoot, "denali-portal.css"), "utf8");
    assert.match(skin, /portal\/member-shell\.css/);
    assert.match(skin, /portal\/member-pages\.css/);
    assert.match(skin, /portal\/member-profile\.css/);
  });

  it("VIS-FORM-01 shared denali-form-controls.css exists and is imported", () => {
    const login = readFileSync(join(denaliThemeRoot, "portal/login-page.css"), "utf8");
    const profile = readFileSync(join(denaliThemeRoot, "portal/member-profile.css"), "utf8");
    const controls = readFileSync(join(denaliThemeRoot, "portal/denali-form-controls.css"), "utf8");
    assert.match(login, /denali-form-controls\.css/);
    assert.match(profile, /denali-form-controls\.css/);
    assert.match(controls, /\[data-portal-auth-card\]/);
    assert.match(controls, /\[data-member-profile-save\]/);
  });

  it("VIS-SHELL-05 member-shell.css styles mist Pocket canvas", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-shell.css"), "utf8");
    assert.match(css, /\[data-portal-shell-main\]/);
    assert.match(css, /--color-bg-page/);
    assert.doesNotMatch(css, /radial-gradient/);
    assert.match(css, /backdrop-filter:\s*none/);
    assert.match(css, /portal-pocket-nav-size/);
  });

  it("VIS-SHELL-07 member header is a compact portal-owned app bar", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-shell.css"), "utf8");
    const skin = readFileSync(join(denaliThemeRoot, "denali-portal.css"), "utf8");
    assert.match(css, /height:\s*var\(--portal-pocket-header-height/);
    assert.match(css, /max-height:\s*var\(--portal-pocket-header-height/);
    assert.match(css, /padding-block:\s*0/);
    assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
    assert.match(css, /Do not import marketing header CSS/);
    assert.doesNotMatch(css, /@import/);
    assert.doesNotMatch(skin, /marketing\/shell\.css/);
    assert.doesNotMatch(skin, /34-mkt-header-member/);
    assert.doesNotMatch(skin, /35-mkt-header-desktop/);
    assert.doesNotMatch(skin, /marketing-header-parity/);
  });

  it("VIS-SHELL-06 user menu exposes profile icon hook", () => {
    const menu = readPortal("src/shell/portal-member-user-menu.tsx");
    assert.match(menu, /PortalNavIcon/);
    assert.match(menu, /data-portal-shell-nav-module-id/);
  });

  it("VIS-HOME-04 home quick links use icon grid component", () => {
    const home = readPortal("app/me/home/page.tsx");
    const links = readPortal("app/me/home/member-home-quick-links.tsx");
    assert.match(home, /MemberHomeQuickLinks/);
    assert.match(home, /data-portal-member-page-header/);
    assert.match(links, /data-portal-member-home-quick-link-icon/);
  });

  it("VIS-HOME-05 Pocket home has canvas title and next-action CTA", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-pages.css"), "utf8");
    const home = css.slice(
      css.indexOf("/* ── Home (Pocket 3.3)"),
      css.indexOf("/* ── Trips list (Pocket 3.2)")
    );
    assert.match(home, /background:\s*none/);
    assert.match(home, /content:\s*none/);
    assert.match(home, /portal-pocket-title-size/);
    assert.match(home, /li:first-child/);
    assert.match(home, /portal-pocket-cta-height/);
    assert.match(home, /\[data-portal-member-section-heading\] \{\s*display:\s*none/);
    assert.doesNotMatch(home, /linear-gradient/);
    assert.doesNotMatch(home, /radial-gradient/);
    assert.doesNotMatch(home, /min-height:\s*10rem/);
    assert.doesNotMatch(home, /#[0-9a-fA-F]{3,8}/);
  });

  it("VIS-TRIP-03 registrations list exposes chevron + list hook", () => {
    const page = readPortal("app/me/registrations/page.tsx");
    assert.match(page, /data-portal-member-registrations-list/);
    assert.match(page, /data-portal-member-row-chevron/);
  });

  it("VIS-TRIP-05 Pocket trips list has canvas title and no hero gradient", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-pages.css"), "utf8");
    const trips = css.slice(
      css.indexOf("/* ── Trips list (Pocket 3.2)"),
      css.indexOf("/* ── Trip detail")
    );
    assert.match(trips, /background:\s*none/);
    assert.match(trips, /content:\s*none/);
    assert.match(trips, /portal-pocket-title-size/);
    assert.match(trips, /portal-pocket-touch/);
    assert.doesNotMatch(trips, /linear-gradient/);
    assert.doesNotMatch(trips, /radial-gradient/);
    assert.doesNotMatch(trips, /#[0-9a-fA-F]{3,8}/);
  });

  it("VIS-TRIP-04 detail page uses app bar + hero section", () => {
    const page = readPortal("app/me/registrations/[id]/page.tsx");
    assert.match(page, /data-portal-member-detail-app-bar/);
    assert.match(page, /data-portal-member-detail-hero/);
    assert.match(page, /data-portal-member-back/);
  });

  it("VIS-TRIP-06 Pocket trip detail has canvas title and stacked status", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-pages.css"), "utf8");
    const detail = css.slice(
      css.indexOf("/* ── Trip detail (Pocket 3.4)"),
      css.indexOf("/* ── More hub")
    );
    assert.match(detail, /background:\s*none/);
    assert.match(detail, /content:\s*none/);
    assert.match(detail, /portal-pocket-title-size/);
    assert.match(detail, /flex-direction:\s*column/);
    assert.doesNotMatch(detail, /linear-gradient/);
    assert.doesNotMatch(detail, /radial-gradient/);
    assert.doesNotMatch(detail, /repeat\(2,/);
    assert.doesNotMatch(detail, /#[0-9a-fA-F]{3,8}/);
  });

  it("VIS-PROF-03 profile page header + avatar data hooks", () => {
    const page = readPortal("app/me/profile/page.tsx");
    const avatar = readPortal("app/me/profile/member-profile-avatar.tsx");
    assert.match(page, /data-portal-member-page-header/);
    assert.match(avatar, /data-member-profile-avatar-preview/);
    assert.doesNotMatch(avatar, /member-profile-avatar__preview/);
  });

  it("VIS-PROF-04 member-profile.css sticky actions (mobile) + sectioned desktop", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-profile.css"), "utf8");
    assert.match(css, /\[data-member-profile-save\]/);
    assert.match(css, /\[data-member-profile-actions\]/);
    assert.match(css, /position:\s*sticky/);
    assert.match(css, /Desktop settings \(PS-VIS-5g\)/);
    assert.match(css, /\[data-member-profile-card\]/);
    assert.match(css, /data-member-profile-layout="sectioned"/);
    const controls = readFileSync(join(denaliThemeRoot, "portal/denali-form-controls.css"), "utf8");
    assert.match(controls, /background:\s*var\(--color-primary\)/);
    assert.doesNotMatch(controls, /linear-gradient/);
    assert.match(controls, /\[data-member-profile-save\]/);
    assert.match(controls, /\[data-action-kind="secondary"\]/);
    assert.match(controls, /\[data-action-kind="tertiary"\]/);
  });

  it("VIS-MORE-01 more hub uses icon list component", () => {
    const page = readPortal("app/me/more/page.tsx");
    const list = readPortal("app/me/more/member-more-hub-list.tsx");
    assert.match(page, /MemberMoreHubList/);
    assert.match(page, /data-portal-member-page-header/);
    assert.match(page, /data-portal-member-hub-section-eyebrow/);
    assert.match(list, /data-portal-member-hub-link-icon/);
    assert.match(list, /data-portal-member-hub-link-description/);
    assert.match(list, /data-portal-member-hub-card-count/);
  });

  it("VIS-STUB-01 module stub exposes back link hook", () => {
    const stub = readFileSync(join(portalRoot, "src/me/member-module-stub.tsx"), "utf8");
    assert.match(stub, /data-portal-member-stub-back/);
    assert.match(stub, /data-portal-member-page-header/);
    assert.match(stub, /data-portal-member-module-stub-card/);
  });
});
