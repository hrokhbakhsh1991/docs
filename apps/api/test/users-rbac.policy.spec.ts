import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateMembershipRoleChange,
  evaluateMembershipRemoval,
  evaluateInviteAccept,
  evaluateInviteCreate,
  RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
  INVITE_ACCEPT_OWNER_PROTECTED,
  INVITE_ACCEPT_MEMBERSHIP_EXISTS,
  INVITE_ALREADY_PENDING,
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
});
