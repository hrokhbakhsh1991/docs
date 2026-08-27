/**
 * Phase 9.4 — identity users API
 * Authority: docs/phase-9/appendices/users-api-dispatch-addendum.md
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import {
  InviteAlreadyPendingError,
  InviteLifecycleError,
} from "../src/identity/in-memory-identity.repository";
import { inviteWorkspaceUser } from "../src/identity/users.service";
import { acceptWorkspaceInvite } from "../src/identity/invites.service";
import {
  buildExpiredPendingInviteSeed,
  buildPendingInviteSeed,
} from "./fixtures/pending-invite-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type UsersApiResponse = {
  readonly items?: Array<Record<string, unknown>>;
  readonly total?: number;
  readonly code?: string;
  readonly inviteId?: string;
  readonly role?: string;
  readonly userId?: string;
  readonly permanentDiscountPercentage?: number;
  readonly isSelectableLeader?: boolean;
  readonly newOwnerUserId?: string;
  readonly previousOwnerUserId?: string;
  readonly inviteToken?: string;
};

function createUsersTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("identity-users.spec.ts — Phase 9.4 API", () => {
  const client = installHttpTestClient(createUsersTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: "+15550001003" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-member",
    });
    repo.seedUser({ id: OPERATOR_SMOKE.adminUserId, mobile: "+15550001002" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.adminUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "admin",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-admin",
    });
  });

  it("API-9.4-01 member cannot POST /users/invite (P9-F-005)", async () => {
    const response = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.memberUserId,
        "x-actor-role": "member",
      },
      body: { phone: "+15550009999", role: "member" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-02 admin GET /users returns 403 owner-only directory (DEC-P9-018)", async () => {
    const response = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.adminUserId,
        "x-actor-role": "admin",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-03 member GET /users returns 403", async () => {
    const response = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.memberUserId,
        "x-actor-role": "member",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-04 owner POST /users/invite creates pending invite", async () => {
    const response = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "+15550008888", role: "admin", nameNote: "Ops lead" },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.inviteId?.length, 36);
  });

  it("API-9.4-04b owner POST /users/invite rejects invalid phone (USR-07)", async () => {
    const response = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "bad", role: "member" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PHONE_INVALID");
  });

  it("API-9.4-05 admin cannot invite or list pending queue (DEC-P9-018)", async () => {
    const invite = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.adminUserId,
        "x-actor-role": "admin",
      },
      body: { phone: "+15550007777", role: "member" },
    });
    assert.equal(invite.status, 403);
    assert.equal(invite.body.code, "USERS_DIRECTORY_FORBIDDEN");

    const response = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.adminUserId,
        "x-actor-role": "admin",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-06 member GET /users/invites returns 403 (R2)", async () => {
    const response = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.memberUserId,
        "x-actor-role": "member",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-07 owner DELETE /users/invites/{id} revokes pending invite (R2)", async () => {
    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "+15550006666", role: "member" },
    });
    assert.equal(created.status, 201);
    const inviteId = created.body.inviteId;
    assert.ok(typeof inviteId === "string");

    const revoked = await client.requestJson<UsersApiResponse>(
      "DELETE",
      `/users/invites/${inviteId}`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(revoked.status, 204);

    const list = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: operatorAuthHeaders(),
    });
    const ids = (list.body.items ?? []).map((row) => row.inviteId);
    assert.ok(!ids.includes(inviteId));
  });

  it("API-9.4-08 DELETE unknown invite returns 404 cross-tenant safe (R2)", async () => {
    const repo = getIdentityRepository();
    const foreignInviteId = "00000000-0000-4000-8000-000000009999";
    repo.seedPendingInvite(
      buildPendingInviteSeed({
        inviteId: foreignInviteId,
        inviteToken: "00000000-0000-4000-8000-000000009998",
        tenantId: "00000000-0000-4000-8000-000000000099",
        phone: "+15550005555",
        role: "member",
        invitedByUserId: "foreign-user",
      })
    );

    const response = await client.requestJson<UsersApiResponse>(
      "DELETE",
      `/users/invites/${foreignInviteId}`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "INVITE_NOT_FOUND");
  });

  it("API-9.4-10 owner PATCH member role to admin (R3)", async () => {
    const patchTargetId = "00000000-0000-4000-8000-000000000198";
    const repo = getIdentityRepository();
    repo.seedUser({ id: patchTargetId, mobile: "+15550001998" });
    repo.seedMembership({
      userId: patchTargetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-patch",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${patchTargetId}/role`,
      {
        headers: operatorAuthHeaders(),
        body: { role: "admin" },
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.role, "admin");
  });

  it("API-9.4-11 admin cannot PATCH owner role — owner-only directory (DEC-P9-018)", async () => {
    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.ownerUserId}/role`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.adminUserId,
          "x-actor-role": "admin",
        },
        body: { role: "member" },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-12 admin cannot PATCH roles — owner-only directory (DEC-P9-018)", async () => {
    const selfPatch = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.adminUserId}/role`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.adminUserId,
          "x-actor-role": "admin",
        },
        body: { role: "member" },
      }
    );
    assert.equal(selfPatch.status, 403);
    assert.equal(selfPatch.body.code, "USERS_DIRECTORY_FORBIDDEN");

    const peerAdminId = "00000000-0000-4000-8000-000000000197";
    const repo = getIdentityRepository();
    repo.seedUser({ id: peerAdminId, mobile: "+15550001997" });
    repo.seedMembership({
      userId: peerAdminId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "admin",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-peer-admin",
    });

    const peerPatch = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${peerAdminId}/role`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.adminUserId,
          "x-actor-role": "admin",
        },
        body: { role: "member" },
      }
    );
    assert.equal(peerPatch.status, 403);
    assert.equal(peerPatch.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-13 owner DELETE member returns 204 (R3)", async () => {
    const extraMemberId = "00000000-0000-4000-8000-000000000199";
    const repo = getIdentityRepository();
    repo.seedUser({ id: extraMemberId, mobile: "+15550001999" });
    repo.seedMembership({
      userId: extraMemberId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-extra",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "DELETE",
      `/users/${extraMemberId}`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 204);

    const list = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: operatorAuthHeaders(),
    });
    const ids = (list.body.items ?? []).map((row) => row.userId);
    assert.ok(!ids.includes(extraMemberId));
  });

  it("API-9.4-14 self DELETE forbidden (R3)", async () => {
    const response = await client.requestJson<UsersApiResponse>(
      "DELETE",
      `/users/${OPERATOR_SMOKE.ownerUserId}`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN");
  });

  it("API-9.4-15 owner PATCH member rewards persists discount (R4)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000196";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001996" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-rewards",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${targetId}/rewards`,
      {
        headers: operatorAuthHeaders(),
        body: { permanentDiscountPercentage: 15, isSelectableLeader: true },
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.permanentDiscountPercentage, 15);
    assert.equal(response.body.isSelectableLeader, true);
  });

  it("API-9.4-16 admin cannot PATCH owner rewards — owner-only directory (DEC-P9-018)", async () => {
    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.ownerUserId}/rewards`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.adminUserId,
          "x-actor-role": "admin",
        },
        body: { permanentDiscountPercentage: 5 },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });

  it("API-9.4-18 admin cannot POST ownership-transfer (R4)", async () => {
    const response = await client.requestJson<UsersApiResponse>(
      "POST",
      `/workspaces/${OPERATOR_SMOKE.tenantId}/ownership-transfer`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.adminUserId,
          "x-actor-role": "admin",
        },
        body: { newOwnerUserId: OPERATOR_SMOKE.memberUserId },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "OWNERSHIP_TRANSFER_FORBIDDEN");
  });

  it("API-9.4-19 invitee POST accept creates membership (R5 · CP-9.4-04)", async () => {
    const inviteeId = "00000000-0000-4000-8000-000000000195";
    const inviteeMobile = "+15550001995";
    const repo = getIdentityRepository();
    repo.seedUser({ id: inviteeId, mobile: inviteeMobile });

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: inviteeMobile, role: "member", nameNote: "New teammate" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string" && inviteToken.length === 36);

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": inviteeId,
          "x-actor-role": "member",
          "x-workspace-id": "ws-invitee-pending",
        },
      }
    );
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.userId, inviteeId);
    assert.equal(accepted.body.role, "member");
    assert.equal(accepted.body.status, "ACTIVE");

    const list = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: operatorAuthHeaders(),
    });
    const phones = (list.body.items ?? []).map((row) => row.phone);
    assert.ok(phones.includes(inviteeMobile));

    const pending = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: operatorAuthHeaders(),
    });
    const pendingPhones = (pending.body.items ?? []).map((row) => row.phone);
    assert.ok(!pendingPhones.includes(inviteeMobile));
  });

  it("API-9.4-20 accept with phone mismatch returns 403 (R5)", async () => {
    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "+15550001994", role: "member" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string");

    const response = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.memberUserId,
          "x-actor-role": "member",
        },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "INVITE_PHONE_MISMATCH");
  });

  it("API-9.4-22 cross-tenant accept returns 403 (R5 · CP-9.4-05)", async () => {
    const repo = getIdentityRepository();
    const token = "00000000-0000-4000-8000-000000009997";
    repo.seedPendingInvite(
      buildPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000009996",
        inviteToken: token,
        tenantId: "00000000-0000-4000-8000-000000000099",
        phone: OPERATOR_SMOKE.ownerMobile,
        role: "member",
        invitedByUserId: "foreign-user",
      })
    );

    const response = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${token}/accept`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "INVITE_TENANT_MISMATCH");
  });

  it("API-9.4-22b accept does not overwrite existing owner (INVITE-ACCEPT-MEMBERSHIP-INVARIANT)", async () => {
    const repo = getIdentityRepository();
    const before = await repo.findMembership(OPERATOR_SMOKE.ownerUserId, OPERATOR_SMOKE.tenantId);
    assert.ok(before);
    assert.equal(before.role, "owner");
    const sessionVersionBefore = before.sessionVersion;

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: OPERATOR_SMOKE.ownerMobile, role: "member" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string");

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(accepted.status, 403);
    assert.equal(accepted.body.code, "INVITE_ACCEPT_OWNER_PROTECTED");

    const after = await repo.findMembership(OPERATOR_SMOKE.ownerUserId, OPERATOR_SMOKE.tenantId);
    assert.ok(after);
    assert.equal(after.role, "owner");
    assert.equal(after.status, "ACTIVE");
    assert.equal(after.sessionVersion, sessionVersionBefore);

    const storedInvite = await repo.findInviteByToken(inviteToken);
    assert.equal(storedInvite?.status, "INVITED");

    const pending = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: operatorAuthHeaders(),
    });
    const pendingPhones = (pending.body.items ?? []).map((row) => row.phone);
    assert.ok(!pendingPhones.includes(OPERATOR_SMOKE.ownerMobile));
  });

  it("API-9.4-22c accept does not overwrite existing member (INVITE-ACCEPT-MEMBERSHIP-INVARIANT)", async () => {
    const repo = getIdentityRepository();
    const before = await repo.findMembership(OPERATOR_SMOKE.memberUserId, OPERATOR_SMOKE.tenantId);
    assert.ok(before);
    assert.equal(before.role, "member");
    const sessionVersionBefore = before.sessionVersion;

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: OPERATOR_SMOKE.memberMobile, role: "admin" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string");

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": OPERATOR_SMOKE.memberUserId,
          "x-actor-role": "member",
        },
      }
    );
    assert.equal(accepted.status, 409);
    assert.equal(accepted.body.code, "INVITE_ACCEPT_MEMBERSHIP_EXISTS");

    const after = await repo.findMembership(OPERATOR_SMOKE.memberUserId, OPERATOR_SMOKE.tenantId);
    assert.ok(after);
    assert.equal(after.role, "member");
    assert.equal(after.sessionVersion, sessionVersionBefore);

    const rows = await repo.listMembershipsByTenant(OPERATOR_SMOKE.tenantId);
    const forMember = rows.filter((row) => row.userId === OPERATOR_SMOKE.memberUserId);
    assert.equal(forMember.length, 1);
  });

  it("API-9.4-22d accept creates membership in A and leaves workspace B untouched", async () => {
    const repo = getIdentityRepository();
    const otherTenantId = "00000000-0000-4000-8000-000000000088";
    const userId = "00000000-0000-4000-8000-000000000188";
    const mobile = "+15550001888";
    repo.seedUser({ id: userId, mobile });
    repo.seedMembership({
      userId,
      tenantId: otherTenantId,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 4,
      workspaceId: "ws-foreign-b",
    });

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: mobile, role: "member" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string");

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": userId,
          "x-actor-role": "member",
          "x-workspace-id": "ws-invitee-pending",
        },
      }
    );
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.role, "member");
    assert.equal(accepted.body.userId, userId);

    const membershipA = await repo.findMembership(userId, OPERATOR_SMOKE.tenantId);
    assert.ok(membershipA);
    assert.equal(membershipA.role, "member");
    assert.equal(membershipA.status, "ACTIVE");

    const membershipB = await repo.findMembership(userId, otherTenantId);
    assert.ok(membershipB);
    assert.equal(membershipB.role, "owner");
    assert.equal(membershipB.sessionVersion, 4);
    assert.equal(membershipB.status, "ACTIVE");
  });

  it("API-9.4-09 owner POST resend returns same pending row (R2)", async () => {
    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "+15550004444", role: "admin", nameNote: "Resend probe" },
    });
    assert.equal(created.status, 201);
    const inviteId = created.body.inviteId;
    assert.ok(typeof inviteId === "string");

    const resent = await client.requestJson<UsersApiResponse>(
      "POST",
      `/users/invites/${inviteId}/resend`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(resent.status, 200);
    assert.equal(resent.body.inviteId, inviteId);
    assert.equal(resent.body.phone, "+15550004444");
    assert.equal(resent.body.role, "admin");
    assert.equal(resent.body.status, "INVITED");
    assert.equal(resent.body.otpSent, true);
  });

  it("API-9.4-23 owner PATCH suspend member sets SUSPENDED and bumps sessionVersion (R1)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000191";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001991" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-suspend",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${targetId}/suspend`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "SUSPENDED");
    assert.equal(response.body.userId, targetId);

    const membership = await repo.findMembership(targetId, OPERATOR_SMOKE.tenantId);
    assert.equal(membership?.status, "SUSPENDED");
    assert.equal(membership?.sessionVersion, 2);
  });

  it("API-9.4-24 owner PATCH reactivate member restores ACTIVE (R1)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000190";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001990" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "admin",
      status: "SUSPENDED",
      sessionVersion: 3,
      workspaceId: "ws-operator-reactivate",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${targetId}/reactivate`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ACTIVE");

    const membership = await repo.findMembership(targetId, OPERATOR_SMOKE.tenantId);
    assert.equal(membership?.status, "ACTIVE");
    assert.equal(membership?.sessionVersion, 4);
  });

  it("API-9.4-25 suspend already suspended returns 409 (R1)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000189";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001989" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "SUSPENDED",
      sessionVersion: 2,
      workspaceId: "ws-operator-already-suspended",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${targetId}/suspend`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "MEMBERSHIP_ALREADY_SUSPENDED");
  });

  it("API-9.4-26 reactivate active member returns 409 (R1)", async () => {
    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.memberUserId}/reactivate`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "MEMBERSHIP_NOT_SUSPENDED");
  });

  it("API-9.4-27 self suspend forbidden (R1)", async () => {
    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${OPERATOR_SMOKE.ownerUserId}/suspend`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN");
  });

  it("API-9.4-28 suspended member still listed in GET /users (R1)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000188";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001988" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "SUSPENDED",
      sessionVersion: 1,
      workspaceId: "ws-operator-listed-suspended",
    });

    const response = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    const row = (response.body.items ?? []).find((item) => item.userId === targetId);
    assert.ok(row);
    assert.equal(row?.status, "SUSPENDED");
  });

  it("API-9.4-29 owner POST /users/invite accepts viewer role (R3 · DEC-P9-019)", async () => {
    const response = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "+15550002901", role: "viewer", nameNote: "Read-only teammate" },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.role, "viewer");
  });

  it("API-9.4-30 owner PATCH member role to viewer (R3 · DEC-P9-019)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000290";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550002990" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-viewer-patch",
    });

    const response = await client.requestJson<UsersApiResponse>(
      "PATCH",
      `/users/${targetId}/role`,
      {
        headers: operatorAuthHeaders(),
        body: { role: "viewer" },
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.role, "viewer");
  });

  it("API-9.4-31 GET /users?role=viewer filters roster (R3 · DEC-P9-019)", async () => {
    const viewerId = "00000000-0000-4000-8000-000000000291";
    const memberId = "00000000-0000-4000-8000-000000000292";
    const repo = getIdentityRepository();
    repo.seedUser({ id: viewerId, mobile: "+15550002991" });
    repo.seedUser({ id: memberId, mobile: "+15550002992" });
    repo.seedMembership({
      userId: viewerId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "viewer",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-viewer-filter",
    });
    repo.seedMembership({
      userId: memberId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-member-filter",
    });

    const response = await client.requestJson<UsersApiResponse>("GET", "/users?role=viewer", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    const ids = (response.body.items ?? []).map((item) => item.userId);
    assert.ok(ids.includes(viewerId));
    assert.equal(ids.includes(memberId), false);
  });

  it("API-9.4-32 GET /users cursor paginates roster (R4)", async () => {
    const page1 = await client.requestJson<UsersApiResponse>("GET", "/users?limit=1", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(page1.status, 200);
    assert.equal(page1.body.items?.length, 1);
    assert.ok(page1.body.nextCursor);

    const page2 = await client.requestJson<UsersApiResponse>(
      "GET",
      `/users?limit=1&cursor=${encodeURIComponent(String(page1.body.nextCursor))}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(page2.status, 200);
    assert.equal(page2.body.items?.length, 1);
    assert.notEqual(page2.body.items?.[0]?.userId, page1.body.items?.[0]?.userId);
  });

  it("API-9.4-17 owner POST ownership-transfer swaps roles (R4)", async () => {
    const newOwnerId = OPERATOR_SMOKE.adminUserId;
    const response = await client.requestJson<UsersApiResponse>(
      "POST",
      `/workspaces/${OPERATOR_SMOKE.tenantId}/ownership-transfer`,
      {
        headers: operatorAuthHeaders(),
        body: { newOwnerUserId: newOwnerId },
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.newOwnerUserId, newOwnerId);
    assert.equal(response.body.previousOwnerUserId, OPERATOR_SMOKE.ownerUserId);

    const list = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": newOwnerId,
        "x-actor-role": "owner",
      },
    });
    const ownerRow = (list.body.items ?? []).find((row) => row.userId === newOwnerId);
    assert.equal(ownerRow?.role, "owner");
  });

  it("API-9.4-33 GET /users rows include avatarUrl (S9-R7 directory projection)", async () => {
    const response = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    assert.ok((response.body.items ?? []).length > 0);
    for (const row of response.body.items ?? []) {
      assert.ok("avatarUrl" in row);
      assert.ok(row.avatarUrl === null || typeof row.avatarUrl === "string");
      assert.ok("gender" in row);
      assert.ok(row.gender === null || typeof row.gender === "string");
    }
  });

  it("INVITE-DUP-01 same tenant same phone rejects duplicate active invite", async () => {
    const phoneInputIntl = "+989120000701";
    const phoneStored = "09120000701";
    const first = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: phoneInputIntl, role: "member", nameNote: "First invite" },
    });
    assert.equal(first.status, 201);
    assert.ok(typeof first.body.inviteId === "string");

    const second = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: "09120000701", role: "admin" },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "INVITE_ALREADY_PENDING");
    assert.equal(second.body.inviteId, first.body.inviteId);

    const list = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(list.status, 200);
    const matching = (list.body.items ?? []).filter((row) => row.phone === phoneStored);
    assert.equal(matching.length, 1);
  });

  it("INVITE-DUP-02 same phone different tenant both allowed", async () => {
    const repo = getIdentityRepository();
    const phone = "+15550007702";
    const tenantA = OPERATOR_SMOKE.tenantId;
    const tenantB = "00000000-0000-4000-8000-000000000099";

    const tenantAInvite = await repo.createPendingInvite({
      tenantId: tenantA,
      phone,
      role: "member",
      invitedByUserId: OPERATOR_SMOKE.ownerUserId,
    });
    const tenantBInvite = await repo.createPendingInvite({
      tenantId: tenantB,
      phone,
      role: "viewer",
      invitedByUserId: "00000000-0000-4000-8000-000000000199",
    });

    assert.notEqual(tenantAInvite.inviteId, tenantBInvite.inviteId);
    const pendingA = (await repo.listPendingInvitesByTenant(tenantA)).filter(
      (row) => row.phone === phone
    );
    const pendingB = (await repo.listPendingInvitesByTenant(tenantB)).filter(
      (row) => row.phone === phone
    );
    assert.equal(pendingA.length, 1);
    assert.equal(pendingB.length, 1);
  });

  it("INVITE-DUP-03 revoked invite allows new active invite for same phone", async () => {
    const phone = "+15550007703";
    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone, role: "member" },
    });
    assert.equal(created.status, 201);
    const inviteId = created.body.inviteId;
    assert.ok(typeof inviteId === "string");

    const revoked = await client.requestJson<UsersApiResponse>(
      "DELETE",
      `/users/invites/${inviteId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(revoked.status, 204);

    const again = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone, role: "admin" },
    });
    assert.equal(again.status, 201);
    assert.notEqual(again.body.inviteId, inviteId);
  });

  it("INVITE-DUP-04 concurrent invite creation leaves one active invite", async () => {
    const repo = getIdentityRepository();
    const phone = "+15550007704";
    const ownerAuth = {
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "owner" as const,
      status: "ACTIVE" as const,
      workspaceId: "ws-operator-smoke",
    };

    const results = await Promise.allSettled([
      inviteWorkspaceUser(ownerAuth, { phone, role: "member" }, repo),
      inviteWorkspaceUser(ownerAuth, { phone, role: "member" }, repo),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const failure = rejected[0];
    assert.equal(failure?.status, "rejected");
    if (failure?.status === "rejected") {
      assert.ok(failure.reason instanceof InviteAlreadyPendingError);
    }

    const pending = await repo.listPendingInvitesByTenant(OPERATOR_SMOKE.tenantId);
    const matching = pending.filter((row) => row.phone === phone);
    assert.equal(matching.length, 1);
  });

  it("INVITE-LIFECYCLE-02 public guest onboarding accepts matching pending invite", async () => {
    const repo = getIdentityRepository();
    const phone = "+15550007712";

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone, role: "member", nameNote: "Public guest lifecycle" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string");

    const before = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(before.status, 200);
    assert.equal((before.body.items ?? []).filter((row) => row.phone === phone).length, 1);

    const registered = await repo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: phone,
      displayName: "Public Guest Member",
    });
    assert.equal(registered.membership.status, "ACTIVE");
    assert.equal(registered.membership.role, "member");

    const storedInvite = await repo.findInviteByToken(inviteToken);
    assert.equal(storedInvite?.status, "ACCEPTED");

    const after = await client.requestJson<UsersApiResponse>("GET", "/users/invites", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(after.status, 200);
    assert.equal((after.body.items ?? []).filter((row) => row.phone === phone).length, 0);
  });

  it("INVITE-TTL-01 pending invite before expiry accepts successfully", async () => {
    const inviteeId = "00000000-0000-4000-8000-000000000881";
    const inviteeMobile = "+15550008881";
    const repo = getIdentityRepository();
    repo.seedUser({ id: inviteeId, mobile: inviteeMobile });

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: inviteeMobile, role: "member" },
    });
    assert.equal(created.status, 201);
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteToken === "string");

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": inviteeId,
          "x-workspace-id": "ws-invitee-ttl-01",
        },
      }
    );
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.userId, inviteeId);
    const membership = await repo.findMembership(inviteeId, OPERATOR_SMOKE.tenantId);
    assert.ok(membership);
    assert.equal(membership?.status, "ACTIVE");
  });

  it("INVITE-TTL-02 expired invite accept is rejected without membership", async () => {
    const inviteeId = "00000000-0000-4000-8000-000000000882";
    const inviteeMobile = "+15550008882";
    const token = "00000000-0000-4000-8000-000000000882";
    const repo = getIdentityRepository();
    repo.seedUser({ id: inviteeId, mobile: inviteeMobile });
    repo.seedPendingInvite(
      buildExpiredPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000000883",
        inviteToken: token,
        tenantId: OPERATOR_SMOKE.tenantId,
        phone: inviteeMobile,
        role: "member",
        invitedByUserId: OPERATOR_SMOKE.ownerUserId,
      })
    );

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${token}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": inviteeId,
          "x-workspace-id": "ws-invitee-ttl-02",
        },
      }
    );
    assert.equal(accepted.status, 410);
    assert.equal(accepted.body.code, "INVITE_EXPIRED");
    assert.equal(await repo.findMembership(inviteeId, OPERATOR_SMOKE.tenantId), null);
  });

  it("INVITE-TTL-03 revoked invite accept is rejected", async () => {
    const inviteeId = "00000000-0000-4000-8000-000000000884";
    const inviteeMobile = "+15550008884";
    const repo = getIdentityRepository();
    repo.seedUser({ id: inviteeId, mobile: inviteeMobile });

    const created = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: operatorAuthHeaders(),
      body: { phone: inviteeMobile, role: "viewer" },
    });
    assert.equal(created.status, 201);
    const inviteId = created.body.inviteId;
    const inviteToken = created.body.inviteToken;
    assert.ok(typeof inviteId === "string" && typeof inviteToken === "string");

    const revoked = await client.requestJson<UsersApiResponse>(
      "DELETE",
      `/users/invites/${inviteId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(revoked.status, 204);

    const accepted = await client.requestJson<UsersApiResponse>(
      "POST",
      `/auth/invite/${inviteToken}/accept`,
      {
        headers: {
          ...operatorAuthHeaders(),
          "x-user-id": inviteeId,
          "x-workspace-id": "ws-invitee-ttl-03",
        },
      }
    );
    assert.equal(accepted.status, 410);
    assert.equal(accepted.body.code, "INVITE_REVOKED");
    assert.equal(await repo.findMembership(inviteeId, OPERATOR_SMOKE.tenantId), null);
  });

  it("INVITE-TTL-04 invite expiry is isolated per tenant", async () => {
    const phone = "+15550008885";
    const inviteeId = "00000000-0000-4000-8000-000000000885";
    const tenantB = "00000000-0000-4000-8000-000000000088";
    const tokenA = "00000000-0000-4000-8000-000000000885";
    const tokenB = "00000000-0000-4000-8000-000000000886";
    const repo = getIdentityRepository();
    repo.seedUser({ id: inviteeId, mobile: phone });

    repo.seedPendingInvite(
      buildExpiredPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000000887",
        inviteToken: tokenA,
        tenantId: OPERATOR_SMOKE.tenantId,
        phone,
        role: "member",
        invitedByUserId: OPERATOR_SMOKE.ownerUserId,
      })
    );
    repo.seedPendingInvite(
      buildPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000000888",
        inviteToken: tokenB,
        tenantId: tenantB,
        phone,
        role: "member",
        invitedByUserId: "00000000-0000-4000-8000-000000000188",
      })
    );

    const tenantAAuth = {
      userId: inviteeId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "owner" as const,
      status: "ACTIVE" as const,
      workspaceId: "ws-invitee-ttl-04a",
    };
    const tenantBAuth = {
      userId: inviteeId,
      tenantId: tenantB,
      role: "owner" as const,
      status: "ACTIVE" as const,
      workspaceId: "ws-invitee-ttl-04b",
    };

    await assert.rejects(
      () => acceptWorkspaceInvite(tenantAAuth, tokenA, repo),
      (error: unknown) => {
        assert.ok(error instanceof InviteLifecycleError);
        assert.equal(error.code, "INVITE_EXPIRED");
        return true;
      }
    );
    assert.equal(await repo.findMembership(inviteeId, OPERATOR_SMOKE.tenantId), null);

    const acceptedB = await acceptWorkspaceInvite(tenantBAuth, tokenB, repo);
    assert.equal(acceptedB.userId, inviteeId);
    assert.equal(acceptedB.tenantId, tenantB);
    assert.ok(await repo.findMembership(inviteeId, tenantB));
  });
});
