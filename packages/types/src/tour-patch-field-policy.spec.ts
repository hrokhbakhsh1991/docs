import assert from "node:assert/strict";
import test from "node:test";

import {
  getForbiddenTourPatchDtoKeysForRole,
  TOUR_PATCH_FIELD_RULES,
} from "./tour-patch-field-policy";

test("TOUR_PATCH_FIELD_RULES includes total_capacity with leader minRoleForEdit", () => {
  const row = TOUR_PATCH_FIELD_RULES.find((r) => r.dtoKey === "total_capacity");
  assert.ok(row);
  assert.equal(row.minRoleForEdit, "leader");
});

test("getForbiddenTourPatchDtoKeysForRole: member cannot patch total_capacity", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForRole("member", ["total_capacity"]);
  assert.deepEqual(forbidden, ["total_capacity"]);
});

test("getForbiddenTourPatchDtoKeysForRole: leader may patch total_capacity", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForRole("leader", ["total_capacity"]);
  assert.deepEqual(forbidden, []);
});

test("getForbiddenTourPatchDtoKeysForRole: admin may patch total_capacity", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForRole("admin", ["total_capacity", "title"]);
  assert.deepEqual(forbidden, []);
});

test("getForbiddenTourPatchDtoKeysForRole: ignores keys not in policy", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForRole("member", ["title", "description"]);
  assert.deepEqual(forbidden, []);
});
