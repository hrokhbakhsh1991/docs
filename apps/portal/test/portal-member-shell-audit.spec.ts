/**
 * PS-1..PS-5 — member portal shell closure audit (static)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relPath: string): string {
  return readFileSync(join(repoRoot, relPath), "utf8");
}

describe("member-portal-shell-audit — PS-1..PS-5 closure", () => {
  it("AUDIT-01 PS-1 shell landmarks + no inline nav", () => {
    const layout = read("apps/portal/app/me/layout.tsx");
    assert.match(layout, /PortalMemberShell/);
    assert.doesNotMatch(layout, /<nav/);
  });

  it("AUDIT-02 PS-2 registry nav wiring", () => {
    const layout = read("apps/portal/app/me/layout.tsx");
    assert.match(layout, /resolvePortalMemberNavForPlugin/);
    assert.match(read("packages/workspaces/denali/workspace.manifest.json"), /"memberPortal"/);
    assert.match(read("packages/workspaces/denali/workspace.manifest.json"), /"memberModuleId": "trips"/);
  });

  it("AUDIT-03 PS-3 GSH module URL builder exists", () => {
    assert.match(
      read("packages/guest-surface-host/src/resolve-portal-member-module-url.ts"),
      /resolvePortalMemberModuleUrl/
    );
  });

  it("AUDIT-04 PS-4 marketing manifest nav + portal robots", () => {
    assert.doesNotMatch(read("apps/marketing/src/shell/marketing-shell.tsx"), /FULL_LANDING_NAV_LINKS/);
    assert.match(read("apps/portal/app/robots.ts"), /disallow.*\/api\//);
  });

  it("AUDIT-05 PS-5 entitlements API + portal proxy + dispatcher", () => {
    assert.match(read("apps/api/src/app.ts"), /\/identity\/me\/entitlements/);
    assert.match(read("apps/portal/app/api/me/entitlements/route.ts"), /resolveMemberEntitlementsPayload/);
    assert.match(read("apps/portal/app/me/[...modulePath]/page.tsx"), /MemberModuleUnauthorized/);
    assert.match(read("apps/portal/app/me/home/page.tsx"), /data-portal-member-home/);
  });

  it("AUDIT-06 package.json exposes guard:member-portal-shell and guard:member-shell", () => {
    const pkg = read("package.json");
    assert.match(pkg, /guard:member-portal-shell/);
    assert.match(pkg, /guard:member-shell/);
  });

  it("AUDIT-07 PS-6 static module pages use entitlement gate (DL-21)", () => {
    for (const relPath of [
      "apps/portal/app/me/home/page.tsx",
      "apps/portal/app/me/registrations/page.tsx",
      "apps/portal/app/me/registrations/[id]/page.tsx",
      "apps/portal/app/me/profile/page.tsx",
      "apps/portal/app/me/more/page.tsx",
    ]) {
      const source = read(relPath);
      assert.match(
        source,
        /MemberModuleEntitlementGate|MemberMoreHubEntitlementGate/
      );
    }
  });

  it("AUDIT-08 PS-6 hub route + embedded host shell wiring", () => {
    assert.match(read("apps/portal/app/me/more/page.tsx"), /MemberMoreHubList/);
    assert.match(
      read("apps/portal/app/me/more/member-more-hub-list.tsx"),
      /data-portal-member-hub-list/
    );
    assert.match(read("apps/portal/app/me/layout.tsx"), /resolveEmbeddedMemberPortalHost/);
    assert.match(read("apps/portal/src/shell/portal-member-shell.tsx"), /data-embedded-host/);
    assert.match(read("scripts/generate-workspace-registry.mjs"), /assertMemberPortalL4ReferenceWorkspaces/);
  });
});
