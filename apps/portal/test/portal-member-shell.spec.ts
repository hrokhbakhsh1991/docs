/**
 * PS-1 — platform member shell landmarks
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

describe("portal-member-shell.spec.ts — PS-1", () => {
  it("PS1-SHELL-01 me layout uses PortalMemberShell without inline nav", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /PortalMemberShell/);
    assert.doesNotMatch(layout, /<nav/);
    assert.doesNotMatch(layout, /href="\/me\/registrations"/);
  });

  it("PS1-SHELL-02 shell package exposes canonical landmarks", () => {
    const shell = readPortal("src/shell/portal-member-shell.tsx");
    const header = readPortal("src/shell/portal-member-header.tsx");
    const bottomNav = readPortal("src/shell/portal-member-bottom-nav.tsx");
    assert.match(shell, /data-portal-shell/);
    assert.match(shell, /data-slot="shell"/);
    assert.doesNotMatch(shell, /data-portal-member-shell/);
    assert.match(shell, /data-portal-shell-main/);
    assert.match(shell, /data-portal-shell-skip-link/);
    assert.match(header, /data-portal-shell-header/);
    assert.match(header, /data-slot="shell-header"/);
    assert.match(bottomNav, /data-portal-shell-bottom-nav/);
    assert.match(bottomNav, /data-portal-shell-nav-link/);
    assert.match(bottomNav, /data-active=/);
  });

  it("PS1-SHELL-02b shell TSX has no appearance className (skin owns visuals)", () => {
    const shellFiles = [
      "src/shell/portal-member-shell.tsx",
      "src/shell/portal-member-header.tsx",
      "src/shell/portal-member-bottom-nav.tsx",
      "src/shell/portal-member-user-menu.tsx",
    ];
    const appearancePattern =
      /className=\{?("|\{)[^"]*(?:bg-|text-|border-|shadow-|backdrop-|rounded-|font-|px-|py-|gap-|max-w)/;
    for (const file of shellFiles) {
      const source = readPortal(file);
      assert.doesNotMatch(
        source,
        appearancePattern,
        `${file} must not contain appearance Tailwind className`
      );
    }
  });

  it("PS1-SHELL-03 bare /me redirects via member registry default", () => {
    const page = readPortal("app/me/page.tsx");
    assert.match(page, /tryResolveMemberPortalDefaultRoutePath/);
    assert.doesNotMatch(page, /redirect\("\/me\/registrations"\)/);
  });

  it("PS1-SHELL-04 registration page is outside member shell layout", () => {
    const registerPage = readPortal("app/catalog/[tourId]/register/page.tsx");
    assert.match(registerPage, /data-catalog-registration-page/);
    assert.doesNotMatch(registerPage, /PortalMemberShell/);
    assert.doesNotMatch(registerPage, /data-portal-shell-bottom-nav/);
  });

  it("PS1-SHELL-05 logout hook preserved in user menu", () => {
    const userMenu = readPortal("src/shell/portal-member-user-menu.tsx");
    assert.match(userMenu, /MemberLogoutButton/);
    const logout = readPortal("src/me/member-logout-button.tsx");
    assert.match(logout, /data-public-auth-logout/);
    assert.match(logout, /data-public-auth-logout-ready/);
  });
});

describe("portal-member-shell.spec.ts — PS-2 registry nav", () => {
  it("PS2-SHELL-01 me layout resolves registry nav for pluginId", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /resolvePortalMemberNavForPlugin/);
    assert.match(layout, /primaryNav=/);
    assert.match(layout, /userMenuNav=/);
    assert.doesNotMatch(layout, /href="\/me\/registrations"/);
    assert.doesNotMatch(layout, /href="\/me\/profile"/);
  });

  it("PS2-SHELL-02 bottom nav consumes registry items prop", () => {
    const bottomNav = readPortal("src/shell/portal-member-bottom-nav.tsx");
    assert.match(bottomNav, /items\.map/);
    assert.doesNotMatch(bottomNav, /PHASE1_PRIMARY_NAV/);
    assert.doesNotMatch(bottomNav, /href="\/me\/registrations"/);
  });

  it("PS2-SHELL-03 user menu consumes registry items prop", () => {
    const userMenu = readPortal("src/shell/portal-member-user-menu.tsx");
    assert.match(userMenu, /items\.map/);
    assert.doesNotMatch(userMenu, /href="\/me\/profile"/);
  });
});

describe("portal-member-shell.spec.ts — PS-5 entitlements nav", () => {
  it("PS5-SHELL-01 me layout intersects registry nav with entitlements", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /resolveMemberEntitlementsForShell/);
    assert.match(layout, /resolvePortalMemberNavForPlugin/);
    assert.match(layout, /grantedEntitlementKeys/);
  });

  it("PS5-SHELL-02 nav resolver requires granted entitlement keys", () => {
    const resolver = readPortal("src/shell/resolve-portal-member-nav.server.ts");
    assert.match(resolver, /memberPortalEntitlementKey/);
    assert.match(resolver, /grantedEntitlementKeys/);
  });
});
