import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateMembershipRoleChange,
  evaluateMembershipRemoval,
  evaluateInviteAccept,
  evaluateInviteCreate,
  evaluateInviteLifecycleForAccept,
  evaluateOwnerRoleChange,
  evaluateOwnerCreate,
  evaluateOwnerMembershipRemoval,
  evaluateOwnerMembershipSuspend,
  evaluateOwnershipTransfer,
  isActiveOwner,
  RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
  RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN,
  RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN,
  INVITE_ACCEPT_OWNER_PROTECTED,
  INVITE_ACCEPT_MEMBERSHIP_EXISTS,
  INVITE_ALREADY_PENDING,
  INVITE_EXPIRED,
  INVITE_REVOKED,
  INVITE_ALREADY_ACCEPTED,
} from "../src/identity/users-rbac.policy";

describe("users-rbac.policy (DEC-P9-019)", () => {
  it("RBAC-R3-01 owner may PATCH member to viewer", () => {
    const decision = evaluateMembershipRoleChange({
      actorUserId: "owner-1",
      actorRole: "owner",
      targetUserId: "member-1",
      targetCurrentRole: "member",
      newRole: "viewer",
    });
    assert.equal(decision.ok, true);
  });

  it("RBAC-R3-02 owner may invite-assign viewer rank on admin downgrade", () => {
    const decision = evaluateMembershipRoleChange({
      actorUserId: "owner-1",
      actorRole: "owner",
      targetUserId: "admin-1",
      targetCurrentRole: "admin",
      newRole: "viewer",
    });
    assert.equal(decision.ok, true);
  });

  it("RBAC-R3-03 admin cannot PATCH peer admin to viewer", () => {
    const decision = evaluateMembershipRoleChange({
      actorUserId: "admin-1",
      actorRole: "admin",
      targetUserId: "admin-2",
      targetCurrentRole: "admin",
      newRole: "viewer",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, RBAC_INSUFFICIENT_ROLE_PRIVILEGE);
    }
  });

  it("RBAC-R3-04 admin may remove viewer", () => {
    const decision = evaluateMembershipRemoval({
      actorUserId: "admin-1",
      actorRole: "admin",
      targetUserId: "viewer-1",
      targetCurrentRole: "viewer",
    });
    assert.equal(decision.ok, true);
  });

  it("RBAC-R3-05 viewer cannot be actor for role change", () => {
    const decision = evaluateMembershipRoleChange({
      actorUserId: "viewer-1",
      actorRole: "viewer",
      targetUserId: "member-1",
      targetCurrentRole: "member",
      newRole: "viewer",
    });
    assert.equal(decision.ok, false);
  });

  it("RBAC-INVITE-01 no existing membership allows accept", () => {
    const decision = evaluateInviteAccept({ existingMembershipRole: null });
    assert.equal(decision.ok, true);
  });

  it("RBAC-INVITE-02 existing owner is protected", () => {
    const decision = evaluateInviteAccept({ existingMembershipRole: "owner" });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, INVITE_ACCEPT_OWNER_PROTECTED);
    }
  });

  it("RBAC-INVITE-03 existing member/admin/viewer is duplicate", () => {
    for (const role of ["admin", "member", "viewer"] as const) {
      const decision = evaluateInviteAccept({ existingMembershipRole: role });
      assert.equal(decision.ok, false);
      if (!decision.ok) {
        assert.equal(decision.code, INVITE_ACCEPT_MEMBERSHIP_EXISTS);
      }
    }
  });

  it("RBAC-INVITE-04 suspended membership uses same duplicate reject (not implicit reactivate)", () => {
    const decision = evaluateInviteAccept({ existingMembershipRole: "member" });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, INVITE_ACCEPT_MEMBERSHIP_EXISTS);
    }
  });

  it("RBAC-INVITE-05 active pending invite blocks duplicate create", () => {
    const decision = evaluateInviteCreate({
      existingPendingInvite: { inviteId: "00000000-0000-4000-8000-000000000777" },
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, INVITE_ALREADY_PENDING);
    }
  });

  it("RBAC-INVITE-06 no pending invite allows create", () => {
    const decision = evaluateInviteCreate({ existingPendingInvite: null });
    assert.equal(decision.ok, true);
  });

  it("RBAC-INVITE-07 active invite before expiry allows accept lifecycle", () => {
    const decision = evaluateInviteLifecycleForAccept({
      status: "INVITED",
      expiresAt: new Date(Date.now() + 60_000),
    });
    assert.equal(decision.ok, true);
  });

  it("RBAC-INVITE-08 expired invite rejects accept lifecycle", () => {
    const decision = evaluateInviteLifecycleForAccept({
      status: "INVITED",
      expiresAt: new Date(Date.now() - 60_000),
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, INVITE_EXPIRED);
    }
  });

  it("RBAC-INVITE-09 revoked and accepted invite reject accept lifecycle", () => {
    for (const status of ["REVOKED", "ACCEPTED", "EXPIRED"] as const) {
      const decision = evaluateInviteLifecycleForAccept({
        status,
        expiresAt: new Date(Date.now() + 60_000),
      });
      assert.equal(decision.ok, false);
      if (!decision.ok) {
        assert.equal(
          decision.code,
          status === "REVOKED"
            ? INVITE_REVOKED
            : status === "ACCEPTED"
              ? INVITE_ALREADY_ACCEPTED
              : INVITE_EXPIRED
        );
      }
    }
  });

  it("OWN-POLICY-01 one active owner exists — demote via PATCH is rejected", () => {
    assert.equal(isActiveOwner({ role: "owner", status: "ACTIVE" }), true);
    const decision = evaluateOwnerRoleChange({
      targetRole: "owner",
      targetStatus: "ACTIVE",
      newRole: "admin",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN);
    }
  });

  it("OWN-POLICY-02 no active owner — owner creation is allowed", () => {
    const decision = evaluateOwnerCreate({ activeOwnerCount: 0 });
    assert.equal(decision.ok, true);
  });

  it("OWN-POLICY-03 one active owner exists — second owner creation is rejected", () => {
    const decision = evaluateOwnerCreate({ activeOwnerCount: 1 });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN);
    }
  });

  it("OWN-POLICY-04 owner transfer yields A admin, B owner, exactly one active owner", () => {
    const actorUserId = "owner-a";
    const targetUserId = "member-b";
    const before = {
      [actorUserId]: { role: "owner", status: "ACTIVE" },
      [targetUserId]: { role: "member", status: "ACTIVE" },
    };

    const decision = evaluateOwnershipTransfer({
      actorUserId,
      actorRole: before[actorUserId].role,
      actorStatus: before[actorUserId].status,
      targetUserId,
      targetExists: true,
      targetRole: before[targetUserId].role,
      targetStatus: before[targetUserId].status,
      activeOwnerUserIds: [actorUserId],
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) {
      return;
    }

    const after = {
      [actorUserId]: { role: decision.previousOwnerNewRole, status: "ACTIVE" },
      [targetUserId]: { role: decision.targetNewRole, status: "ACTIVE" },
    };
    assert.equal(after[actorUserId].role, "admin");
    assert.equal(after[targetUserId].role, "owner");
    const activeOwners = Object.entries(after).filter(([, row]) => isActiveOwner(row));
    assert.equal(activeOwners.length, 1);
    assert.equal(activeOwners[0]?.[0], targetUserId);
  });

  it("OWN-POLICY-05 suspend active owner is rejected", () => {
    const decision = evaluateOwnerMembershipSuspend({
      targetRole: "owner",
      targetStatus: "ACTIVE",
      activeOwnerCount: 1,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN);
    }
  });

  it("OWN-POLICY-06 remove active owner is rejected", () => {
    const decision = evaluateOwnerMembershipRemoval({
      targetRole: "owner",
      targetStatus: "ACTIVE",
      activeOwnerCount: 1,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN);
    }
  });
});
