import assert from "node:assert/strict";
import { test } from "node:test";

import { requireOperatorSessionWeb } from "../src/admin/require-operator-session";
import { allowsWorkspaceAdminPath } from "../src/admin/operator-admin-access";

test("an active admin may enter the workspace dashboard without becoming owner", () => {
  const result = requireOperatorSessionWeb({
    session: {
      userId: "00000000-0000-4000-8000-000000000103",
      tenantId: "00000000-0000-4000-8000-000000000002",
      role: "admin",
      workspaceType: "denali",
      pluginId: "denali",
    },
    pathname: "/dashboard",
  });
  assert.equal(result.allowed, true);
});

test("admin operational access never grants owner management or other roles", () => {
  for (const path of [
    "/users",
    "/settings",
    "/api/users",
    "/api/users/bulk/role",
    "/api/settings/branding",
    "/api/tenants/00000000-0000-4000-8000-000000000003/ownership-transfer",
  ]) {
    assert.equal(allowsWorkspaceAdminPath("admin", path), false, path);
  }
  for (const role of ["member", "viewer", "none"]) {
    assert.equal(allowsWorkspaceAdminPath(role, "/dashboard"), false, role);
    assert.equal(allowsWorkspaceAdminPath(role, "/api/tours"), false, role);
  }
  assert.equal(allowsWorkspaceAdminPath("admin", "/api/tours-evil"), false);
  assert.equal(allowsWorkspaceAdminPath("admin", "/api/tours"), true);
  assert.equal(allowsWorkspaceAdminPath("admin", "/settings/me"), true);
  assert.equal(allowsWorkspaceAdminPath("admin", "/settings/me/other"), false);
});

test("middleware admits admin dashboard but denies owner-only APIs and members", async () => {
  const previous = {
    ALLOW_DEV_WEB_SESSION: process.env.ALLOW_DEV_WEB_SESSION,
    APP_INFRA_PROFILE: process.env.APP_INFRA_PROFILE,
    TENANT_SURFACE_ORIGIN_MAP_JSON: process.env.TENANT_SURFACE_ORIGIN_MAP_JSON,
  };
  process.env.ALLOW_DEV_WEB_SESSION = "true";
  process.env.APP_INFRA_PROFILE = "staging";
  process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify({
    version: 1,
    tenants: [
      {
        tenantId: "00000000-0000-4000-8000-000000000003",
        origins: {
          admin: "https://admin.denali.staging.test",
          marketing: "https://denali.staging.test",
          portal: "https://portal.denali.staging.test",
        },
        cookieDomain: null,
      },
    ],
  });
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../middleware");
  const token = (role: string, tenantId: string) => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000103",
        tenant_id: tenantId,
        role,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    return `${header}.${payload}.sig`;
  };
  const request = (
    path: string,
    role: string,
    tenantId = "00000000-0000-4000-8000-000000000003"
  ) => {
    const req = new NextRequest(`https://admin.denali.staging.test${path}`);
    req.cookies.set("atour_op_session", token(role, tenantId));
    return req;
  };
  try {
    const dashboard = await middleware(request("/dashboard", "admin"));
    assert.equal(dashboard.status, 200, dashboard.headers.get("location") ?? "");
    const users = await middleware(request("/api/users", "admin"));
    assert.equal(users.status, 403);
    const member = await middleware(request("/dashboard", "member"));
    assert.equal(member.status, 307);
    const wrongTenant = await middleware(
      request("/api/tours", "admin", "00000000-0000-4000-8000-000000000002")
    );
    assert.equal(wrongTenant.status, 403);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
