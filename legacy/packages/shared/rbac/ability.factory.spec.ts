import assert from "node:assert/strict";
import test from "node:test";
import { subject } from "@casl/ability";
import { defineAbilityFor } from "./ability.factory";

test("ACTIVE owner can manage all", () => {
  const a = defineAbilityFor({ id: "u1", role: "OWNER", status: "ACTIVE" });
  assert.equal(a.can("manage", "all"), true);
  assert.equal(a.can("delete", "Tour"), true);
});

test("ACTIVE admin cannot update WorkspaceOwnership", () => {
  const a = defineAbilityFor({ id: "u1", role: "admin", status: "ACTIVE" });
  assert.equal(a.can("manage", "Tour"), true);
  assert.equal(a.can("update", "WorkspaceOwnership"), false);
});

test("ACTIVE leader can update Tour but not WorkspaceOwnership", () => {
  const a = defineAbilityFor({ id: "u1", role: "LEADER", status: "ACTIVE" });
  assert.equal(a.can("update", "Tour"), true);
  assert.equal(a.can("update", "WorkspaceOwnership"), false);
  assert.equal(a.can("delete", "Workspace"), false);
});

test("ACTIVE leader can publish Tour and update TourCore / TourTripDetails", () => {
  const a = defineAbilityFor({ id: "u1", role: "LEADER", status: "ACTIVE" });
  assert.equal(a.can("publish", "Tour"), true);
  assert.equal(a.can("update", "TourCore"), true);
  assert.equal(a.can("update", "TourTripDetails"), true);
});

test("ACTIVE member cannot publish Tour or update TourCore", () => {
  const a = defineAbilityFor({ id: "u1", role: "member", status: "ACTIVE" });
  assert.equal(a.can("read", "Tour"), true);
  assert.equal(a.can("publish", "Tour"), false);
  assert.equal(a.can("update", "TourCore"), false);
  assert.equal(a.can("update", "TourTripDetails"), false);
});

test("ACTIVE owner can publish Tour via manage all", () => {
  const a = defineAbilityFor({ id: "u1", role: "owner", status: "ACTIVE" });
  assert.equal(a.can("publish", "Tour"), true);
});

test("ACTIVE viewer is read-only on Tour", () => {
  const a = defineAbilityFor({ id: "u1", role: "viewer", status: "ACTIVE" });
  assert.equal(a.can("read", "Tour"), true);
  assert.equal(a.can("update", "Tour"), false);
});

test("ACTIVE member and leader can create Payment (intent flows)", () => {
  const m = defineAbilityFor({ id: "u1", role: "member", status: "ACTIVE" });
  assert.equal(m.can("create", "Payment"), true);
  const l = defineAbilityFor({ id: "u1", role: "leader", status: "ACTIVE" });
  assert.equal(l.can("create", "Payment"), true);
});

test("SUSPENDED membership loses mutating abilities", () => {
  const a = defineAbilityFor({ id: "u1", role: "owner", status: "SUSPENDED" });
  assert.equal(a.can("read", "Workspace"), true);
  assert.equal(a.can("manage", "all"), false);
});

test("labels enable read on MarketingSegment", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "viewer",
    status: "ACTIVE",
    labels: ["club_member"]
  });
  assert.equal(a.can("read", "MarketingSegment"), true);
});

test("ACTIVE member cannot create, update, or delete UserMembership (UI/API parity)", () => {
  const a = defineAbilityFor({ id: "u1", role: "member", status: "ACTIVE" });
  assert.equal(a.can("create", "UserMembership"), false);
  assert.equal(a.can("update", "UserMembership"), false);
  assert.equal(a.can("delete", "UserMembership"), false);
  assert.equal(a.can("read", "UserMembership"), false);
});

test("ACTIVE leader cannot mutate UserMembership", () => {
  const a = defineAbilityFor({ id: "u1", role: "leader", status: "ACTIVE" });
  assert.equal(a.can("update", "UserMembership"), false);
  assert.equal(a.can("create", "UserMembership"), false);
  assert.equal(a.can("delete", "UserMembership"), false);
  assert.equal(a.can("read", "UserMembership"), true);
});

test("owner can read user-directory documents and internal-notes subjects", () => {
  const a = defineAbilityFor({ id: "u1", role: "owner", status: "ACTIVE" });
  assert.equal(a.can("read", "UserDirectoryDocuments"), true);
  assert.equal(a.can("read", "UserDirectoryInternalNotes"), true);
  assert.equal(a.can("update", "UserDirectoryInternalNotes"), true);
});

test("leader cannot read user-directory documents or internal-notes subjects", () => {
  const a = defineAbilityFor({ id: "u1", role: "leader", status: "ACTIVE" });
  assert.equal(a.can("read", "UserDirectoryDocuments"), false);
  assert.equal(a.can("read", "UserDirectoryInternalNotes"), false);
});

test("admin can read user-directory documents and internal-notes subjects", () => {
  const a = defineAbilityFor({ id: "u1", role: "admin", status: "ACTIVE" });
  assert.equal(a.can("read", "UserDirectoryDocuments"), true);
  assert.equal(a.can("read", "UserDirectoryInternalNotes"), true);
});

test("ACTIVE member can read own MedicalProfile subject but not another user's", () => {
  const a = defineAbilityFor({ id: "u-self", role: "member", status: "ACTIVE" });
  assert.equal(
    a.can("read", subject("MedicalProfile", { ownerUserId: "u-self" })),
    true
  );
  assert.equal(a.can("read", subject("MedicalProfile", { ownerUserId: "u-other" })), false);
});

test("ACTIVE leader can read MedicalProfile for any ownerUserId", () => {
  const a = defineAbilityFor({ id: "u-lead", role: "leader", status: "ACTIVE" });
  assert.equal(a.can("read", subject("MedicalProfile", { ownerUserId: "u-other" })), true);
});

test("ACTIVE member can update own EmergencyContact subject", () => {
  const a = defineAbilityFor({ id: "u-self", role: "member", status: "ACTIVE" });
  assert.equal(
    a.can("update", subject("EmergencyContact", { ownerUserId: "u-self" })),
    true
  );
  assert.equal(a.can("update", subject("EmergencyContact", { ownerUserId: "u-other" })), false);
});

test("ACTIVE leader can read Reconciliation but not manage it", () => {
  const a = defineAbilityFor({ id: "u1", role: "leader", status: "ACTIVE" });
  assert.equal(a.can("read", "Reconciliation"), true);
  assert.equal(a.can("manage", "Reconciliation"), false);
});

test("ACTIVE member cannot read Reconciliation", () => {
  const a = defineAbilityFor({ id: "u1", role: "member", status: "ACTIVE" });
  assert.equal(a.can("read", "Reconciliation"), false);
});

test("explicit capabilities hydrate tour.update.core for member", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "member",
    status: "ACTIVE",
    capabilities: ["tour.update.core"],
  });
  assert.equal(a.can("update", "TourCore"), true);
  assert.equal(a.can("publish", "Tour"), false);
});

test("tenant finance module grants Reconciliation read for member", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "member",
    status: "ACTIVE",
    tenantModules: ["finance"],
  });
  assert.equal(a.can("read", "Reconciliation"), true);
});

test("tenant finance module grants manual payment + receipt upload for member", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "member",
    status: "ACTIVE",
    tenantModules: ["finance"],
  });
  assert.equal(a.can("read", "FinanceManualPayment"), true);
  assert.equal(a.can("create", "FinanceManualPayment"), false);
  assert.equal(a.can("create", "FinanceReceipt"), true);
  assert.equal(a.can("read", "FinanceReceiptReview"), false);
  assert.equal(a.can("update", "FinanceReceiptReview"), false);
});

test("tenant finance module grants receipt review for owner", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "owner",
    status: "ACTIVE",
    tenantModules: ["finance"],
  });
  assert.equal(a.can("create", "FinanceManualPayment"), true);
  assert.equal(a.can("read", "FinanceReceiptReview"), true);
  assert.equal(a.can("update", "FinanceReceiptReview"), true);
});

test("workspace without finance module denies finance receipt subjects for member", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "member",
    status: "ACTIVE",
    tenantModules: ["form_builder"],
  });
  assert.equal(a.can("read", "FinanceManualPayment"), false);
  assert.equal(a.can("create", "FinanceReceipt"), false);
});

test("tour.form.architect alias grants TourTripDetails update via labels", () => {
  const a = defineAbilityFor({
    id: "u1",
    role: "member",
    status: "ACTIVE",
    labels: ["tour.form.architect"],
  });
  assert.equal(a.can("update", "TourTripDetails"), true);
});
