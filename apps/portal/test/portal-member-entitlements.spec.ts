/**
 * PS-5 — member entitlements BFF bootstrap
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-member-entitlements — PS-5", () => {
  it("PS5-ENT-01 entitlements route requires session", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/entitlements/route.ts"),
      "utf8"
    );
    assert.match(route, /buildMemberApiHeaders/);
    assert.match(route, /resolveMemberEntitlementsPayload/);
    assert.match(route, /Authorization === undefined/);
    assert.match(route, /401/);
  });

  it("PS5-ENT-02 bootstrap uses SDK tier evaluator", () => {
    const bff = readFileSync(
      join(repoRoot, "apps/portal/src/me/member-entitlements-bff.server.ts"),
      "utf8"
    );
    assert.match(bff, /evaluateMemberPortalEntitlements/);
    assert.match(bff, /fetchMemberEntitlementsUpstream/);
    assert.match(bff, /resolveMemberEntitlementsPayload/);
  });

  it("PS6-ENT-01 entitlements route uses private BFF cache", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/entitlements/route.ts"),
      "utf8"
    );
    assert.match(route, /readMemberEntitlementsCache/);
    assert.match(route, /writeMemberEntitlementsCache/);
    assert.match(route, /resolveMemberEntitlementsCacheControlHeader/);
  });

  it("PS6-ENT-02 logout invalidates entitlements cache", () => {
    const logout = readFileSync(
      join(repoRoot, "apps/portal/app/api/public-auth/logout/route.ts"),
      "utf8"
    );
    assert.match(logout, /invalidateMemberEntitlementsCacheForMember/);
  });

  it("PS6-ENT-03 profile PATCH invalidates entitlements cache", () => {
    const profile = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/profile/route.ts"),
      "utf8"
    );
    assert.match(profile, /invalidateMemberEntitlementsCacheForMember/);
  });

  it("PS6-ENT-04 entitlements invalidate route exists", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/entitlements/invalidate/route.ts"),
      "utf8"
    );
    assert.match(route, /invalidateMemberEntitlementsCacheForMember/);
    assert.match(route, /POST/);
  });

  it("PS5-ENT-03 shell resolver shares BFF payload path", () => {
    const shell = readFileSync(
      join(repoRoot, "apps/portal/src/me/resolve-member-entitlements-for-shell.server.ts"),
      "utf8"
    );
    assert.match(shell, /resolveMemberEntitlementsPayload/);
    assert.match(shell, /buildMemberApiHeaders/);
  });
});
