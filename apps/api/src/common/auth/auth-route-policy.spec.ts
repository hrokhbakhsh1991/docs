import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_WORKSPACE_SESSION_ROUTE,
  isAuthTenantHostStrictRoute,
} from "./auth-route-policy";

test("workspace session POST is host-strict", () => {
  assert.equal(
    isAuthTenantHostStrictRoute(AUTH_WORKSPACE_SESSION_ROUTE, "POST"),
    true,
  );
});

test("workspace list GET is not host-strict", () => {
  assert.equal(isAuthTenantHostStrictRoute("/api/v2/auth/workspaces", "GET"), false);
});
