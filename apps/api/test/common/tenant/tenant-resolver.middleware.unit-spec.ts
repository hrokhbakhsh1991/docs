import assert from "node:assert/strict";
import test from "node:test";
import {
  isAuthTenantSessionRoute,
  shouldBypassTenantResolver
} from "../../../src/common/tenant/tenant-resolver.middleware";

test("shouldBypassTenantResolver skips health and public registration", () => {
  assert.equal(shouldBypassTenantResolver("/health", "GET"), true);
  assert.equal(shouldBypassTenantResolver("/health/live", "GET"), true);
  assert.equal(shouldBypassTenantResolver("/internal/foo", "GET"), true);
  assert.equal(shouldBypassTenantResolver("/api/docs", "GET"), true);
  assert.equal(
    shouldBypassTenantResolver("/api/v2/tours/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/register", "POST"),
    true
  );
});

test("shouldBypassTenantResolver does not skip auth session routes", () => {
  assert.equal(shouldBypassTenantResolver("/api/v2/auth/web/session/otp", "POST"), false);
  assert.equal(shouldBypassTenantResolver("/api/v2/auth/telegram/session", "POST"), false);
});

test("isAuthTenantSessionRoute identifies login endpoints", () => {
  assert.equal(isAuthTenantSessionRoute("/api/v2/auth/web/session/otp", "POST"), true);
  assert.equal(isAuthTenantSessionRoute("/api/v2/auth/telegram/session", "POST"), true);
  assert.equal(isAuthTenantSessionRoute("/api/v2/auth/web/session/otp", "GET"), false);
  assert.equal(isAuthTenantSessionRoute("/api/v2/auth/workspace/session", "POST"), false);
});
