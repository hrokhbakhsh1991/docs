/**
 * P1.3-B — wire exactly-one ACTIVE owner into mutation flows (OWN-INT-01..07)
 * Authority: docs/phase-9/appendices/owner-cardinality-invariant.mdoc
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { acceptWorkspaceInvite } from "../src/identity/invites.service";
import { OwnerCreateForbiddenError, isActiveOwner } from "../src/identity/users-rbac.policy";
import { buildPendingInviteSeed } from "./fixtures/pending-invite-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type ApiBody = {
  readonly code?: string;
  readonly role?: string;
  readonly status?: string;
  readonly userId?: string;
  readonly newOwnerUserId?: string;
  readonly previousOwnerUserId?: string;
  readonly items?: Array<Record<string, unknown>>;
  readonly failures?: Array<{ userId: string; code: string }>;
};

function createListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

function seedDirectoryPeers(): void {
  const repo = getIdentityRepository();
  repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: OPERATOR_SMOKE.memberMobile });
  repo.seedMembership({
    userId: OPERATOR_SMOKE.memberUserId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-member",
  });
  repo.seedUser({ id: OPERATOR_SMOKE.adminUserId, mobile: OPERATOR_SMOKE.adminMobile });
  repo.seedMembership({
    userId: OPERATOR_SMOKE.adminUserId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "admin",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-admin",
  });
}

async function countActiveOwners(tenantId: string): Promise<number> {
  const memberships = await getIdentityRepository().listMembershipsByTenant(tenantId);
  return memberships.filter((row) => isActiveOwner({ role: row.role, status: row.status })).length;
}

describe("owner-cardinality-wire.spec.ts — OWN-INT (P1.3-B)", () => {
  const client = installHttpTestClient(createListener);

  beforeEach(() => {
    seedOperatorIdentityFixture();
    seedDirectoryPeers();
  });

  it("OWN-INT-01 only owner demotion via PATCH role is rejected", async () => {
    const response = await client.requestJson<ApiBody>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.ownerUserId}/role`,
      {
        headers: operatorAuthHeaders(),
        body: { role: "admin" },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN");
    assert.equal(await countActiveOwners(OPERATOR_SMOKE.tenantId), 1);
  });

  it("OWN-INT-02 remove only owner is rejected", async () => {
    const response = await client.requestJson<ApiBody>(
      "DELETE",
      `/users/${OPERATOR_SMOKE.ownerUserId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN");
    assert.equal(await countActiveOwners(OPERATOR_SMOKE.tenantId), 1);
  });

  it("OWN-INT-03 suspend only owner is rejected", async () => {
    const response = await client.requestJson<ApiBody>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.ownerUserId}/suspend`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN");
    assert.equal(await countActiveOwners(OPERATOR_SMOKE.tenantId), 1);
  });

  it("OWN-INT-04 ownership transfer yields admin→owner and exactly one ACTIVE owner", async () => {
    const response = await client.requestJson<ApiBody>(
      "POST",
      `/workspaces/${OPERATOR_SMOKE.tenantId}/ownership-transfer`,
      {
        headers: operatorAuthHeaders(),
        body: { newOwnerUserId: OPERATOR_SMOKE.memberUserId },
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.newOwnerUserId, OPERATOR_SMOKE.memberUserId);
    assert.equal(response.body.previousOwnerUserId, OPERATOR_SMOKE.ownerUserId);

    const repo = getIdentityRepository();
    const previous = await repo.findMembership(OPERATOR_SMOKE.ownerUserId, OPERATOR_SMOKE.tenantId);
    const next = await repo.findMembership(OPERATOR_SMOKE.memberUserId, OPERATOR_SMOKE.tenantId);
    assert.equal(previous?.role, "admin");
    assert.equal(previous?.status, "ACTIVE");
    assert.equal(next?.role, "owner");
    assert.equal(next?.status, "ACTIVE");
    assert.equal(await countActiveOwners(OPERATOR_SMOKE.tenantId), 1);
  });

  it("OWN-INT-05 platform owner invite with existing ACTIVE owner is rejected", async () => {
    const repo = getIdentityRepository();
    const inviteeId = "00000000-0000-4000-8000-000000000501";
    const inviteMobile = "+15550005001";
    const token = "00000000-0000-4000-8000-000000000511";
    repo.seedUser({ id: inviteeId, mobile: inviteMobile });
    repo.seedPendingInvite(
      buildPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000000510",
        inviteToken: token,
        tenantId: OPERATOR_SMOKE.tenantId,
        phone: inviteMobile,
        role: "owner",
        invitedByUserId: "platform-admin",
      })
    );

    await assert.rejects(
      () =>
        acceptWorkspaceInvite(
          {
            userId: inviteeId,
            tenantId: OPERATOR_SMOKE.tenantId,
            role: "member",
            status: "ACTIVE",
            workspaceId: "ws-owner-invite-reject",
          },
          token,
          repo
        ),
      (error: unknown) => {
        assert.ok(error instanceof OwnerCreateForbiddenError);
        assert.equal(error.code, "RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN");
        return true;
      }
    );

    assert.equal(await repo.findMembership(inviteeId, OPERATOR_SMOKE.tenantId), null);
    assert.equal(await countActiveOwners(OPERATOR_SMOKE.tenantId), 1);
  });

  it("OWN-INT-06 bootstrap owner invite with zero ACTIVE owners is allowed", async () => {
    const repo = getIdentityRepository();
    const bootstrapTenantId = "00000000-0000-4000-8000-000000000520";
    const inviteeId = "00000000-0000-4000-8000-000000000521";
    const inviteMobile = "+15550005201";
    const token = "00000000-0000-4000-8000-000000000522";

    repo.seedUser({ id: inviteeId, mobile: inviteMobile });
    repo.seedPendingInvite(
      buildPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000000523",
        inviteToken: token,
        tenantId: bootstrapTenantId,
        phone: inviteMobile,
        role: "owner",
        invitedByUserId: "platform-admin",
      })
    );

    assert.equal(await countActiveOwners(bootstrapTenantId), 0);

    const accepted = await acceptWorkspaceInvite(
      {
        userId: inviteeId,
        tenantId: bootstrapTenantId,
        role: "member",
        status: "ACTIVE",
        workspaceId: "ws-owner-bootstrap",
      },
      token,
      repo
    );
    assert.equal(accepted.role, "owner");
    assert.equal(accepted.status, "ACTIVE");
    assert.equal(await countActiveOwners(bootstrapTenantId), 1);
  });

  it("OWN-INT-07 bulk mutation containing owner protects owner and processes peers", async () => {
    const response = await client.requestJson<ApiBody>("PATCH", "/users/bulk/suspend", {
      headers: operatorAuthHeaders(),
      body: {
        userIds: [OPERATOR_SMOKE.memberUserId, OPERATOR_SMOKE.ownerUserId, OPERATOR_SMOKE.adminUserId],
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.items?.length, 2);
    assert.equal(response.body.failures?.length, 1);
    assert.equal(response.body.failures?.[0]?.userId, OPERATOR_SMOKE.ownerUserId);
    assert.equal(response.body.failures?.[0]?.code, "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN");

    const repo = getIdentityRepository();
    const owner = await repo.findMembership(OPERATOR_SMOKE.ownerUserId, OPERATOR_SMOKE.tenantId);
    const member = await repo.findMembership(OPERATOR_SMOKE.memberUserId, OPERATOR_SMOKE.tenantId);
    assert.equal(owner?.status, "ACTIVE");
    assert.equal(member?.status, "SUSPENDED");
    assert.equal(await countActiveOwners(OPERATOR_SMOKE.tenantId), 1);
  });
});
