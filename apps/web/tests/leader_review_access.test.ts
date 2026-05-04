import { expect, test } from "@playwright/test";

import {
  canAccessLeaderReview,
  isLeaderReviewRoute,
  isLeaderRole,
} from "../lib/auth/routeRolePolicy";

test.describe("routeRolePolicy (pure authority)", () => {
  test("isLeaderRole returns true for leader roles", () => {
    expect(isLeaderRole("owner")).toBeTruthy();
    expect(isLeaderRole("admin")).toBeTruthy();
    expect(isLeaderRole(" OWNER ")).toBeTruthy();
  });

  test("isLeaderRole returns false for non-leader or missing roles", () => {
    expect(isLeaderRole("member")).toBeFalsy();
    expect(isLeaderRole("participant")).toBeFalsy();
    expect(isLeaderRole("")).toBeFalsy();
    expect(isLeaderRole(undefined)).toBeFalsy();
    expect(isLeaderRole(null)).toBeFalsy();
  });

  test("isLeaderReviewRoute matches leader review path and subpaths", () => {
    expect(isLeaderReviewRoute("/leader/review")).toBeTruthy();
    expect(isLeaderReviewRoute("/leader/review/")).toBeTruthy();
    expect(isLeaderReviewRoute("/leader/review/items/1")).toBeTruthy();
    expect(isLeaderReviewRoute("/dashboard")).toBeFalsy();
    expect(isLeaderReviewRoute("/leader")).toBeFalsy();
  });

  test("canAccessLeaderReview enforces leader-only on leader review routes", () => {
    expect(canAccessLeaderReview("owner", "/leader/review")).toBeTruthy();
    expect(canAccessLeaderReview("admin", "/leader/review/sub")).toBeTruthy();
    expect(canAccessLeaderReview("member", "/leader/review")).toBeFalsy();
    expect(canAccessLeaderReview(undefined, "/leader/review")).toBeFalsy();
    // Non-leader-review paths are not blocked by this policy function.
    expect(canAccessLeaderReview("member", "/dashboard")).toBeTruthy();
  });
});

