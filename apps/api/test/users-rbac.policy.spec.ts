import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateMembershipRoleChange,
  evaluateMembershipRemoval,
  RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
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
});
