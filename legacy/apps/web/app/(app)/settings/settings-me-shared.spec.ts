import assert from "node:assert/strict";
import test from "node:test";

import { mapMeToEmailForm } from "./settings-me-shared";
import type { WorkspaceMeData } from "./workspace-me-provider";

function meWithEmail(email: WorkspaceMeData["email"]): WorkspaceMeData {
  return {
    id: "user-1",
    email,
    full_name: "Test User",
    is_email_verified: false,
    profile_row_version: 1
  } as WorkspaceMeData;
}

test("mapMeToEmailForm maps null email to empty string for settings UI", () => {
  assert.deepEqual(mapMeToEmailForm(meWithEmail(null)), { email: "" });
});

test("mapMeToEmailForm maps missing email to empty string", () => {
  assert.deepEqual(mapMeToEmailForm(meWithEmail(undefined)), { email: "" });
});

test("mapMeToEmailForm preserves real email", () => {
  assert.deepEqual(mapMeToEmailForm(meWithEmail("user@example.com")), {
    email: "user@example.com"
  });
});
