/**
 * PS-5 — home aggregate BFF + module dispatcher
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildMemberHomePayload } from "../src/me/member-home-bff.server";
import { isMemberModuleEntitled } from "../src/me/member-module-entitlement-gate";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("member-home-bff — PS-5", () => {
  it("PS5-HOME-03 buildMemberHomePayload marks primary modules entitled", () => {
    const payload = buildMemberHomePayload({
      tenantId: "tenant-denali",
      pluginId: "denali",
      grantedEntitlementKeys: [
        "member.module.home",
        "member.module.trips",
        "member.module.profile",
      ],
    });
    assert.equal(payload.ok, true);
    assert.ok(payload.modules.some((module) => module.id === "home" && module.entitled));
    assert.ok(payload.modules.some((module) => module.id === "trips" && module.entitled));
    assert.ok(payload.modules.some((module) => module.id === "profile" && module.entitled));
  });

  it("PS5-HOME-04 isMemberModuleEntitled checks entitlement key", () => {
    assert.equal(
      isMemberModuleEntitled("trips", ["member.module.trips"]),
      true
    );
    assert.equal(isMemberModuleEntitled("trips", []), false);
  });
});

describe("member-module-dispatcher — PS-5", () => {
  it("PS5-DISP-01 catch-all dispatcher resolves registry route", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/me/[...modulePath]/page.tsx"),
      "utf8"
    );
    assert.match(page, /resolveMemberPortalModuleByRoutePath/);
    assert.match(page, /MemberPortalUnknownRouteError/);
    assert.match(page, /MemberModuleUnauthorized/);
    assert.match(page, /MemberModuleStub/);
  });

  it("PS5-DISP-02 home BFF route requires session", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/home/route.ts"),
      "utf8"
    );
    assert.match(route, /buildMemberHomePayload/);
    assert.match(route, /Authorization === undefined/);
  });

  it("PS5-DISP-03 home page consumes aggregate payload", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/home/page.tsx"), "utf8");
    const quickLinks = readFileSync(
      join(repoRoot, "apps/portal/app/me/home/member-home-quick-links.tsx"),
      "utf8"
    );
    assert.match(page, /buildMemberHomePayload/);
    assert.match(page, /MemberHomeQuickLinks/);
    assert.match(quickLinks, /data-portal-member-home-quick-links/);
  });
});
