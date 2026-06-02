import assert from "node:assert/strict";
import test from "node:test";

import {
  canViewTourDetailChatLink,
  hasFullTourDetailAccess,
  hasMinTourDetailAccess,
  hasPurchasedTourDetailAccess,
} from "./tour-detail-access-ui";

test("hasMinTourDetailAccess ranks tiers correctly", () => {
  assert.equal(hasMinTourDetailAccess("GUEST", "PURCHASED_USER"), false);
  assert.equal(hasMinTourDetailAccess("PURCHASED_USER", "PURCHASED_USER"), true);
  assert.equal(hasMinTourDetailAccess("OPERATIONAL", "ADMIN"), false);
  assert.equal(hasMinTourDetailAccess("ADMIN", "OPERATIONAL"), true);
});

test("hasFullTourDetailAccess includes operational leader tier", () => {
  assert.equal(hasFullTourDetailAccess("OPERATIONAL"), true);
  assert.equal(hasFullTourDetailAccess("PURCHASED_USER"), false);
});

test("hasPurchasedTourDetailAccess includes purchased tier", () => {
  assert.equal(hasPurchasedTourDetailAccess("PURCHASED_USER"), true);
  assert.equal(hasPurchasedTourDetailAccess("GUEST"), false);
});

test("canViewTourDetailChatLink is owner/admin only", () => {
  assert.equal(canViewTourDetailChatLink("OWNER"), true);
  assert.equal(canViewTourDetailChatLink("ADMIN"), true);
  assert.equal(canViewTourDetailChatLink("OPERATIONAL"), false);
});
