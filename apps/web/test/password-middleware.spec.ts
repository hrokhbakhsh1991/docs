import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

test("password login reaches its BFF without a session but password management remains protected", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousRoot = process.env.PLATFORM_ROOT_DOMAIN;
  const previousAllowDev = process.env.ALLOW_DEV_WEB_SESSION;
  try {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_ROOT_DOMAIN = "shenski.com";
    delete process.env.ALLOW_DEV_WEB_SESSION;
    const request = (path: string) =>
      new NextRequest(`http://127.0.0.1:23000${path}`, {
        method: "POST",
        headers: {
          host: "admin.denali.shenski.com",
          "x-forwarded-host": "admin.denali.shenski.com",
          "x-forwarded-proto": "https",
        },
      });
    const login = await middleware(request("/api/auth/login-password"));
    assert.equal(login.headers.get("x-middleware-next"), "1");
    const management = await middleware(request("/api/identity/me/password"));
    assert.equal(management.status, 401);
    assert.equal((await management.json()).error.code, "AUTH_UNAUTHENTICATED");
    const nested = await middleware(request("/api/auth/login-password/unexpected"));
    assert.equal(nested.status, 401);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousRoot === undefined) delete process.env.PLATFORM_ROOT_DOMAIN;
    else process.env.PLATFORM_ROOT_DOMAIN = previousRoot;
    if (previousAllowDev === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
    else process.env.ALLOW_DEV_WEB_SESSION = previousAllowDev;
  }
});
