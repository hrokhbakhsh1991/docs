/**
 * PS-VIS Wave 1 — registration chrome + minimal member header
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

describe("portal-visual-wave1.spec.ts", () => {
  it("VIS-CHROME-01 registration page uses PortalAuthExperienceShell", () => {
    const page = readPortal("app/catalog/[tourId]/register/page.tsx");
    assert.match(page, /PortalAuthExperienceShell/);
    assert.match(page, /pageKind="registration"/);
    assert.doesNotMatch(page, /PortalMemberShell/);
  });

  it("VIS-CHROME-02 registration chrome exposes stable data hooks", () => {
    const chrome = readPortal("src/catalog/portal-registration-chrome.tsx");
    assert.match(chrome, /data-portal-registration-chrome/);
    assert.match(chrome, /data-portal-registration-back/);
    assert.match(chrome, /data-portal-registration-logo/);
    assert.match(chrome, /data-portal-registration-workspace-label/);
  });

  it("VIS-CHROME-03 starter skin styles registration chrome", () => {
    const skin = readFileSync(
      join(repoRoot, "packages/workspaces/starter/theme/starter-portal.css"),
      "utf8"
    );
    assert.match(skin, /\[data-portal-registration-chrome\]/);
    assert.match(skin, /\[data-portal-registration-back\]/);
  });

  it("VIS-SHELL-01 member header is minimal (brand + chip; logout elsewhere)", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /logoUrl=/);
    assert.match(layout, /marketingHomeUrl=/);
    const header = readPortal("src/shell/portal-member-header.tsx");
    assert.match(header, /data-portal-shell-logo/);
    assert.match(header, /data-marketing-header/);
    assert.match(header, /data-portal-member-header-minimal/);
    assert.doesNotMatch(header, /MemberLogoutButton/);
    assert.doesNotMatch(header, /PortalLocaleSwitcher/);
    assert.doesNotMatch(header, /data-marketing-header-nav/);
    const bottomNav = readPortal("src/shell/portal-member-bottom-nav.tsx");
    assert.match(bottomNav, /data-portal-shell-nav-footer/);
    assert.match(bottomNav, /MemberLogoutButton/);
  });

  it("VIS-SHELL-02 locale switcher component remains available (not in member header)", () => {
    const switcher = readPortal("src/i18n/portal-locale-switcher.tsx");
    assert.match(switcher, /LOCALE_COOKIE_NAME/);
    assert.match(switcher, /router\.refresh\(\)/);
  });
});
