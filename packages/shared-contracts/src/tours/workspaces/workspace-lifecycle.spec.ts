import assert from "node:assert/strict";
import test from "node:test";

import { DENALI_WORKSPACE } from "./denali";
import { assertWorkspaceLifecycleTransition } from "./workspace-lifecycle";

test("lifecycle: allow DRAFT -> OPEN for Denali", () => {
  assert.doesNotThrow(() => {
    assertWorkspaceLifecycleTransition(DENALI_WORKSPACE, { from: "DRAFT", to: "OPEN" });
  });
});

test("lifecycle: block illegal OPEN -> DRAFT for Denali", () => {
  assert.throws(() => {
    assertWorkspaceLifecycleTransition(DENALI_WORKSPACE, { from: "OPEN", to: "DRAFT" });
  }, /WORKSPACE_LIFECYCLE_ILLEGAL_TRANSITION/);
});

test("lifecycle: allow OPEN -> CANCELLED for Denali", () => {
  assert.doesNotThrow(() => {
    assertWorkspaceLifecycleTransition(DENALI_WORKSPACE, { from: "OPEN", to: "CANCELLED" });
  });
});

test("lifecycle: block DRAFT -> CLOSED for Denali", () => {
  assert.throws(() => {
    assertWorkspaceLifecycleTransition(DENALI_WORKSPACE, { from: "DRAFT", to: "CLOSED" });
  }, /WORKSPACE_LIFECYCLE_ILLEGAL_TRANSITION/);
});
