import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../../../src/common/auth/user-role.enum";
import {
  actorHasTrustedTenantOrPlatformAdminBypass,
  canActAsPlatformAdminWithoutTenant,
  canPerformAdministrativeAction,
  canUploadReceiptAsWorkspaceStaff,
  isProtectedWorkspaceOwnerMembership,
  isWorkspaceAdmin,
  isWorkspaceLeaderOrAbove,
  isWorkspaceMember,
  isWorkspaceOwner,
  isWorkspaceViewer,
  mayPatchSensitiveTripDetailsByRole,
  qualifiesForStaffPricingDiscount,
  registrationTenantMatchesActorScope,
} from "../../../src/common/rbac/workspace-access.helper";

test("isWorkspaceAdmin and isWorkspaceOwner", () => {
  assert.equal(isWorkspaceAdmin("admin"), true);
  assert.equal(isWorkspaceAdmin({ role: "admin" }), true);
  assert.equal(isWorkspaceOwner(UserRole.Owner), true);
  assert.equal(isWorkspaceOwner({ role: "owner" }), true);
  assert.equal(isWorkspaceAdmin(UserRole.Member), false);
});

test("isWorkspaceLeaderOrAbove matches ownership-scope leader band", () => {
  assert.equal(isWorkspaceLeaderOrAbove(UserRole.Owner), true);
  assert.equal(isWorkspaceLeaderOrAbove(UserRole.Admin), true);
  assert.equal(isWorkspaceLeaderOrAbove(UserRole.Leader), true);
  assert.equal(isWorkspaceLeaderOrAbove(UserRole.Member), false);
  assert.equal(isWorkspaceLeaderOrAbove(UserRole.Viewer), false);
});

test("canPerformAdministrativeAction is owner or admin only", () => {
  assert.equal(canPerformAdministrativeAction(UserRole.Owner), true);
  assert.equal(canPerformAdministrativeAction(UserRole.Admin), true);
  assert.equal(canPerformAdministrativeAction(UserRole.Leader), false);
});

test("canActAsPlatformAdminWithoutTenant aliases admin", () => {
  assert.equal(canActAsPlatformAdminWithoutTenant("admin"), true);
  assert.equal(canActAsPlatformAdminWithoutTenant(UserRole.Owner), false);
});

test("isProtectedWorkspaceOwnerMembership and isWorkspaceMember", () => {
  assert.equal(isProtectedWorkspaceOwnerMembership({ role: "owner" }), true);
  assert.equal(isWorkspaceMember({ role: "member" }), true);
  assert.equal(isWorkspaceMember("viewer"), false);
});

test("canUploadReceiptAsWorkspaceStaff", () => {
  assert.equal(canUploadReceiptAsWorkspaceStaff(UserRole.Leader), true);
  assert.equal(canUploadReceiptAsWorkspaceStaff(UserRole.Member), false);
});

test("qualifiesForStaffPricingDiscount and mayPatchSensitiveTripDetailsByRole", () => {
  assert.equal(qualifiesForStaffPricingDiscount(UserRole.Admin), true);
  assert.equal(qualifiesForStaffPricingDiscount(UserRole.Member), false);
  assert.equal(mayPatchSensitiveTripDetailsByRole(UserRole.Leader), true);
  assert.equal(mayPatchSensitiveTripDetailsByRole(UserRole.Viewer), false);
});

test("isWorkspaceViewer", () => {
  assert.equal(isWorkspaceViewer(UserRole.Viewer), true);
  assert.equal(isWorkspaceViewer(UserRole.Member), false);
});

test("actorHasTrustedTenantOrPlatformAdminBypass", () => {
  assert.equal(actorHasTrustedTenantOrPlatformAdminBypass(UserRole.Member, "t-1"), true);
  assert.equal(actorHasTrustedTenantOrPlatformAdminBypass(UserRole.Member, undefined), false);
  assert.equal(actorHasTrustedTenantOrPlatformAdminBypass("admin", undefined), true);
});

test("registrationTenantMatchesActorScope", () => {
  assert.equal(
    registrationTenantMatchesActorScope(UserRole.Admin, undefined, "other-tenant"),
    true,
  );
  assert.equal(
    registrationTenantMatchesActorScope(UserRole.Member, "t-1", "t-1"),
    true,
  );
  assert.equal(
    registrationTenantMatchesActorScope(UserRole.Member, "t-1", "t-2"),
    false,
  );
});
