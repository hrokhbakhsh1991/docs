import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateGeneralMembershipRoleChange,
  evaluateWorkspaceInviteRole,
  GENERAL_PATCH_ASSIGNABLE_ROLES,
  getWorkspaceMembershipRoleRank,
  normalizeWorkspaceMembershipRole,
  RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
  RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN,
  RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN,
  RBAC_SELF_ROLE_CHANGE_FORBIDDEN,
  WORKSPACE_MEMBERSHIP_ROLE_RANK
} from "../../../src/common/rbac/workspace-membership-rbac.policy";

test("normalize maps legacy operator to member", () => {
  assert.equal(normalizeWorkspaceMembershipRole("operator"), "member");
});

test("leader rank exists structurally but is not a persisted invite/patch DTO role yet", () => {
  assert.equal(WORKSPACE_MEMBERSHIP_ROLE_RANK.leader, 4);
  assert.equal(getWorkspaceMembershipRoleRank("leader"), undefined);
});

test("evaluateGeneralMembershipRoleChange forbids self", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "u1",
    actorRole: "owner",
    targetUserId: "u1",
    targetCurrentRole: "admin",
    newRole: "member"
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, RBAC_SELF_ROLE_CHANGE_FORBIDDEN);
});

test("evaluateGeneralMembershipRoleChange forbids modifying owner target", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "owner-1",
    actorRole: "owner",
    targetUserId: "other",
    targetCurrentRole: "owner",
    newRole: "member"
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN);
});

test("evaluateGeneralMembershipRoleChange forbids assigning owner via body edge", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "a",
    actorRole: "owner",
    targetUserId: "b",
    targetCurrentRole: "admin",
    newRole: "owner"
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN);
});

test("evaluateGeneralMembershipRoleChange admin cannot modify peer admin", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "a1",
    actorRole: "admin",
    targetUserId: "a2",
    targetCurrentRole: "admin",
    newRole: "member"
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, RBAC_INSUFFICIENT_ROLE_PRIVILEGE);
});

test("evaluateGeneralMembershipRoleChange owner can downgrade admin to member", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "o",
    actorRole: "owner",
    targetUserId: "a",
    targetCurrentRole: "admin",
    newRole: "member"
  });
  assert.equal(r.ok, true);
});

test("evaluateGeneralMembershipRoleChange admin can set member to viewer", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "a",
    actorRole: "admin",
    targetUserId: "m",
    targetCurrentRole: "member",
    newRole: "viewer"
  });
  assert.equal(r.ok, true);
});

test("GENERAL_PATCH_ASSIGNABLE_ROLES excludes owner", () => {
  assert.equal((GENERAL_PATCH_ASSIGNABLE_ROLES as readonly string[]).includes("owner"), false);
});

test("evaluateWorkspaceInviteRole admin cannot invite owner", () => {
  const r = evaluateWorkspaceInviteRole({ inviterRole: "admin", invitedRole: "owner" });
  assert.equal(r.ok, false);
});

test("evaluateWorkspaceInviteRole owner can invite owner", () => {
  assert.equal(evaluateWorkspaceInviteRole({ inviterRole: "owner", invitedRole: "owner" }).ok, true);
});

test("evaluateWorkspaceInviteRole admin can invite viewer", () => {
  assert.equal(evaluateWorkspaceInviteRole({ inviterRole: "admin", invitedRole: "viewer" }).ok, true);
});
