import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenException } from "@nestjs/common";
import { WorkspaceRole } from "@repo/shared";

import {
  TOUR_PATCH_FIELD_FORBIDDEN,
  assertPatchFieldsAllowedForWorkspaceRole,
  workspaceRoleToTourPatchViewerRole,
} from "./assert-patch-field-policy";
import type { UpdateTourDto } from "../dto/update-tour.dto";

test("workspaceRoleToTourPatchViewerRole maps owner/admin to admin rank", () => {
  assert.equal(workspaceRoleToTourPatchViewerRole(WorkspaceRole.Owner), "admin");
  assert.equal(workspaceRoleToTourPatchViewerRole(WorkspaceRole.Admin), "admin");
  assert.equal(workspaceRoleToTourPatchViewerRole(WorkspaceRole.Leader), "leader");
  assert.equal(workspaceRoleToTourPatchViewerRole(WorkspaceRole.Member), "member");
  assert.equal(workspaceRoleToTourPatchViewerRole(WorkspaceRole.Viewer), "guest");
});

test("assertPatchFieldsAllowedForWorkspaceRole: leader may patch total_capacity", () => {
  assert.doesNotThrow(() =>
    assertPatchFieldsAllowedForWorkspaceRole(WorkspaceRole.Leader, {
      total_capacity: 20,
    } as UpdateTourDto),
  );
});

test("assertPatchFieldsAllowedForWorkspaceRole: member rejected for total_capacity", () => {
  try {
    assertPatchFieldsAllowedForWorkspaceRole(WorkspaceRole.Member, {
      total_capacity: 20,
    } as UpdateTourDto);
    assert.fail("expected ForbiddenException");
  } catch (e: unknown) {
    assert.ok(e instanceof ForbiddenException);
    const body = (e as ForbiddenException).getResponse() as {
      error?: { code?: string; fields?: string[] };
    };
    assert.equal(body.error?.code, TOUR_PATCH_FIELD_FORBIDDEN);
    assert.deepEqual(body.error?.fields, ["total_capacity"]);
  }
});

test("assertPatchFieldsAllowedForWorkspaceRole: member rejected for title without capability", () => {
  try {
    assertPatchFieldsAllowedForWorkspaceRole(WorkspaceRole.Member, {
      title: "1234567890ab",
    } as UpdateTourDto);
    assert.fail("expected ForbiddenException");
  } catch (e: unknown) {
    assert.ok(e instanceof ForbiddenException);
    const body = (e as ForbiddenException).getResponse() as {
      error?: { code?: string; fields?: string[] };
    };
    assert.equal(body.error?.code, TOUR_PATCH_FIELD_FORBIDDEN);
    assert.deepEqual(body.error?.fields, ["title"]);
  }
});

test("assertPatchFieldsAllowedForWorkspaceRole: member with tour.update.core may patch title", () => {
  assert.doesNotThrow(() =>
    assertPatchFieldsAllowedForWorkspaceRole(
      WorkspaceRole.Member,
      { title: "1234567890ab" } as UpdateTourDto,
      { role: WorkspaceRole.Member, capabilities: ["tour.update.core"] },
    ),
  );
});
