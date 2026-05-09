import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveFieldAccess,
  type FieldConfigBase,
  type UserRole,
} from "./tripDetailsFieldConfig";

const baseEditable: Pick<FieldConfigBase, "visibility" | "requiredness"> = {
  visibility: "editable",
  requiredness: "optional",
};

test("list RBAC: leader is editable when in allowedRoles", () => {
  const r = resolveFieldAccess(
    {
      ...baseEditable,
      allowedRoles: ["leader"],
      viewOnlyRoles: ["member"],
    },
    "leader",
  );
  assert.equal(r.accessLevel, "editable");
  assert.equal(r.visibility, "editable");
  assert.equal(r.canEdit, true);
});

test("list RBAC: member is readonly when in viewOnlyRoles only", () => {
  const r = resolveFieldAccess(
    {
      ...baseEditable,
      allowedRoles: ["leader"],
      viewOnlyRoles: ["member"],
    },
    "member",
  );
  assert.equal(r.accessLevel, "readonly");
  assert.equal(r.canView, true);
  assert.equal(r.canEdit, false);
});

test("list RBAC: guest is hidden when not in either list", () => {
  const r = resolveFieldAccess(
    {
      ...baseEditable,
      allowedRoles: ["leader"],
      viewOnlyRoles: ["member"],
    },
    "guest",
  );
  assert.equal(r.accessLevel, "hidden");
  assert.equal(r.canView, false);
});

test("list RBAC: admin is hidden when not listed (strict allow-list)", () => {
  const r = resolveFieldAccess(
    {
      ...baseEditable,
      allowedRoles: ["leader"],
      viewOnlyRoles: ["member"],
    },
    "admin",
  );
  assert.equal(r.accessLevel, "hidden");
});

test("no list RBAC: only visibility+driven — editable stays editable for any role", () => {
  for (const role of ["guest", "member", "leader", "admin"] as UserRole[]) {
    const r = resolveFieldAccess({ ...baseEditable }, role);
    assert.equal(r.accessLevel, "editable", role);
  }
});

test("no list RBAC: global readonly forces readonly for all roles", () => {
  for (const role of ["guest", "leader", "admin"] as UserRole[]) {
    const r = resolveFieldAccess({ ...baseEditable, visibility: "readonly" }, role);
    assert.equal(r.accessLevel, "readonly", role);
    assert.equal(r.canEdit, false);
  }
});

test("no list RBAC: global hidden forces hidden for all roles", () => {
  const r = resolveFieldAccess({ ...baseEditable, visibility: "hidden" }, "leader");
  assert.equal(r.accessLevel, "hidden");
});

test("legacy minRole: capacity-style thresholds when lists absent", () => {
  const rGuest = resolveFieldAccess(
    {
      ...baseEditable,
      role: { minRoleForView: "leader", minRoleForEdit: "leader" },
    },
    "guest",
  );
  assert.equal(rGuest.accessLevel, "hidden");

  const rLeader = resolveFieldAccess(
    {
      ...baseEditable,
      role: { minRoleForView: "leader", minRoleForEdit: "leader" },
    },
    "leader",
  );
  assert.equal(rLeader.accessLevel, "editable");

  const rAdmin = resolveFieldAccess(
    {
      ...baseEditable,
      role: { minRoleForView: "leader", minRoleForEdit: "leader" },
    },
    "admin",
  );
  assert.equal(rAdmin.accessLevel, "editable");
});

test("list RBAC takes precedence over minRole when both are set", () => {
  const r = resolveFieldAccess(
    {
      ...baseEditable,
      role: { minRoleForView: "leader", minRoleForEdit: "leader" },
      allowedRoles: ["leader"],
      viewOnlyRoles: ["member"],
    },
    "admin",
  );
  assert.equal(r.accessLevel, "hidden");
});
