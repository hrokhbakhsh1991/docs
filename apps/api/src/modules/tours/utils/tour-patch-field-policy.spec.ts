import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceRole } from "@repo/shared";

import { getForbiddenTourPatchDtoKeysForPatchContext } from "./tour-patch-field-policy";

test("member without tour.update.core cannot patch cost_context", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForPatchContext(
    "member",
    { role: WorkspaceRole.Member },
    ["cost_context"],
  );
  assert.deepEqual(forbidden, ["cost_context"]);
});

test("member with explicit tour.update.core may patch title", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForPatchContext(
    "member",
    { role: WorkspaceRole.Member, capabilities: ["tour.update.core"] },
    ["title"],
  );
  assert.deepEqual(forbidden, []);
});

test("leader may patch total_capacity", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForPatchContext(
    "leader",
    { role: WorkspaceRole.Leader },
    ["total_capacity"],
  );
  assert.deepEqual(forbidden, []);
});

test("member with tour.update.core still forbidden on total_capacity rank gate", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForPatchContext(
    "member",
    { role: WorkspaceRole.Member, capabilities: ["tour.update.core"] },
    ["total_capacity"],
  );
  assert.deepEqual(forbidden, ["total_capacity"]);
});

test("leader may patch tripDetails blob", () => {
  const forbidden = getForbiddenTourPatchDtoKeysForPatchContext(
    "leader",
    { role: WorkspaceRole.Leader },
    ["tripDetails"],
  );
  assert.deepEqual(forbidden, []);
});
