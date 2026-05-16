import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../../../src/common/auth/user-role.enum";
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
  assert.equal(normalizeWorkspaceMembershipRole("operator"), UserRole.Member);
});

test("leader rank is persisted and participates in normalization", () => {
  assert.equal(WORKSPACE_MEMBERSHIP_ROLE_RANK[UserRole.Leader], 4);
  assert.equal(getWorkspaceMembershipRoleRank("leader"), 4);
  assert.equal(normalizeWorkspaceMembershipRole("leader"), UserRole.Leader);
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
  const allowed = new Set<UserRole>([...GENERAL_PATCH_ASSIGNABLE_ROLES]);
  assert.equal(allowed.has(UserRole.Owner), false);
});

test("GENERAL_PATCH_ASSIGNABLE_ROLES includes leader", () => {
  assert.equal(GENERAL_PATCH_ASSIGNABLE_ROLES.includes(UserRole.Leader), true);
});

test("evaluateGeneralMembershipRoleChange owner can promote admin to leader", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "o",
    actorRole: "owner",
    targetUserId: "a",
    targetCurrentRole: "admin",
    newRole: "leader"
  });
  assert.equal(r.ok, true);
});

test("evaluateGeneralMembershipRoleChange admin cannot assign leader rank", () => {
  const r = evaluateGeneralMembershipRoleChange({
    actorUserId: "a1",
    actorRole: "admin",
    targetUserId: "m1",
    targetCurrentRole: "member",
    newRole: "leader"
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, RBAC_INSUFFICIENT_ROLE_PRIVILEGE);
});

test("evaluateWorkspaceInviteRole admin cannot invite owner", () => {
  const r = evaluateWorkspaceInviteRole({ inviterRole: "admin", invitedRole: "owner" });
  assert.equal(r.ok, false);
});

test("evaluateWorkspaceInviteRole cannot invite owner role", () => {
  assert.equal(evaluateWorkspaceInviteRole({ inviterRole: "owner", invitedRole: "owner" }).ok, false);
});

test("evaluateWorkspaceInviteRole admin can invite viewer", () => {
  assert.equal(evaluateWorkspaceInviteRole({ inviterRole: "admin", invitedRole: "viewer" }).ok, true);
});
