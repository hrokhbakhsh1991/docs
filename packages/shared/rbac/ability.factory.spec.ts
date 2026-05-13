import assert from "node:assert/strict";
import test from "node:test";
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

test("ACTIVE viewer is read-only on Tour", () => {
  const a = defineAbilityFor({ id: "u1", role: "viewer", status: "ACTIVE" });
  assert.equal(a.can("read", "Tour"), true);
  assert.equal(a.can("update", "Tour"), false);
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
