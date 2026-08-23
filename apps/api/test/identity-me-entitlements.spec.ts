/**
 * PS-5 — identity/me/entitlements API upstream
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type EntitlementsResponse = {
  readonly ok?: boolean;
  readonly tenantId?: string;
  readonly workspaceId?: string;
  readonly granted?: string[];
  readonly denied?: unknown[];
  readonly code?: string;
};

function memberHeaders(userId: string, workspaceId: string): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": workspaceId,
  };
}

describe("identity-me-entitlements.spec.ts — PS-5", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  let memberUserId = "";
  let memberWorkspaceId = "";

  before(async () => {
    seedOperatorIdentityFixture();
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559004455",
      displayName: "Entitlements Member",
      email: "entitlements-member@denali-smoke.local",
    });
    memberUserId = user.id;
    memberWorkspaceId = membership.workspaceId ?? "ws-public-entitlements";
  });

  it("API-ME-ENT-01 GET /identity/me/entitlements requires session", async () => {
    const response = await client.requestJson<EntitlementsResponse>(
      "GET",
      "/identity/me/entitlements"
    );
    assert.equal(response.status, 401);
  });

  it("API-ME-ENT-02 member receives Denali effective registry keys", async () => {
    const response = await client.requestJson<EntitlementsResponse>(
      "GET",
      "/identity/me/entitlements",
      { headers: memberHeaders(memberUserId, memberWorkspaceId) }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.workspaceId, memberWorkspaceId);
    assert.ok(response.body.granted?.includes("member.module.home"));
    assert.ok(response.body.granted?.includes("member.module.trips"));
    assert.ok(response.body.granted?.includes("member.module.profile"));
    assert.deepEqual(response.body.denied, [{ key: "member.module.wallet", reason: "plan_limit" }]);
  });

  it("API-ME-ENT-03 service reports auth workspaceId, not plugin/workspace type", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/identity/me.entitlements.service.ts"),
      "utf8"
    );
    assert.match(source, /workspaceId = auth\.workspaceId\?\.trim\(\)/);
    assert.doesNotMatch(source, /workspaceId:\s*pluginId/);
    assert.doesNotMatch(source, /emptyMemberEntitlements\(auth\.tenantId,\s*pluginId\)/);
    assert.doesNotMatch(source, /emptyMemberEntitlements\(auth\.tenantId,\s*workspaceType\)/);
  });
});
