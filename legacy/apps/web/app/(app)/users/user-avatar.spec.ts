import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveAvatarDisplayGender } from "./user-avatar-utils";

test("resolveAvatarDisplayGender maps missing and prefer_not_to_say to neutral", () => {
  assert.equal(resolveAvatarDisplayGender(null), "neutral");
  assert.equal(resolveAvatarDisplayGender(undefined), "neutral");
  assert.equal(resolveAvatarDisplayGender(""), "neutral");
  assert.equal(resolveAvatarDisplayGender("   "), "neutral");
  assert.equal(resolveAvatarDisplayGender("prefer_not_to_say"), "neutral");
  assert.equal(resolveAvatarDisplayGender("non_binary"), "neutral");
  assert.equal(resolveAvatarDisplayGender("unknown_value"), "neutral");
});

test("resolveAvatarDisplayGender preserves male and female", () => {
  assert.equal(resolveAvatarDisplayGender("male"), "male");
  assert.equal(resolveAvatarDisplayGender("FEMALE"), "female");
});
