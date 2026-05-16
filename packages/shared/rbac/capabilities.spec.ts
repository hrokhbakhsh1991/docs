import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceRole } from "./workspace-roles";
import {
  TOUR_CAPABILITIES,
  roleGrantsCapability,
  roleGrantsTourCapability,
} from "./capabilities";

test("leader grants all tour capabilities", () => {
  for (const cap of TOUR_CAPABILITIES) {
    assert.equal(roleGrantsTourCapability(WorkspaceRole.Leader, cap), true, cap);
  }
});

test("member grants tour.read only among tour capabilities", () => {
  assert.equal(roleGrantsTourCapability(WorkspaceRole.Member, "tour.read"), true);
  assert.equal(roleGrantsTourCapability(WorkspaceRole.Member, "tour.create"), false);
  assert.equal(roleGrantsTourCapability(WorkspaceRole.Member, "tour.update.core"), false);
  assert.equal(roleGrantsTourCapability(WorkspaceRole.Member, "tour.publish"), false);
});

test("viewer grants tour.read only", () => {
  assert.equal(roleGrantsTourCapability(WorkspaceRole.Viewer, "tour.read"), true);
  assert.equal(roleGrantsTourCapability(WorkspaceRole.Viewer, "tour.update"), false);
});

test("admin grants settings.themes.manage; leader does not", () => {
  assert.equal(roleGrantsCapability(WorkspaceRole.Admin, "settings.themes.manage"), true);
  assert.equal(roleGrantsCapability(WorkspaceRole.Leader, "settings.themes.manage"), false);
  assert.equal(roleGrantsCapability(WorkspaceRole.Leader, "settings.read"), true);
});

test("member grants settings.read", () => {
  assert.equal(roleGrantsCapability(WorkspaceRole.Member, "settings.read"), true);
});
