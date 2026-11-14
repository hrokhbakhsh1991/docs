import assert from "node:assert/strict";
import { test } from "node:test";
import { forwardOperatorPassword } from "../src/auth/password-bff.server";
import { POST as loginWithPassword } from "../app/api/auth/login-password/route";

test("operator password writes require same origin and an authenticated session", async () => {
  for (const origin of [undefined, "https://other.example"]) {
    const response = await forwardOperatorPassword(
      new Request("http://admin.denali.localhost:3000/api/identity/me/password", {
        method: "POST",
        ...(origin ? { headers: { origin } } : {}),
      }),
      "request-otp"
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "ORIGIN_INVALID");
  }
  const response = await forwardOperatorPassword(
    new Request("http://admin.denali.localhost:3000/api/identity/me/password", {
      method: "POST",
      headers: { origin: "http://admin.denali.localhost:3000" },
    }),
    "request-otp"
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "AUTH_UNAUTHENTICATED");
});

test("operator password login rejects a cross-site request before upstream authentication", async () => {
  const response = await loginWithPassword(
    new Request("http://admin.denali.localhost:3000/api/auth/login-password", {
      method: "POST",
      headers: { origin: "https://other.example", "content-type": "application/json" },
      body: JSON.stringify({ phone: "09120000000", password: "a synthetic test passphrase" }),
    })
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "ORIGIN_INVALID");
});

test("operator password login rejects a spoofed client IP from an untrusted edge", async () => {
  const previous = {
    mode: process.env.PASSWORD_AUTH_CLIENT_IP_MODE,
    cidrs: process.env.PASSWORD_AUTH_TRUSTED_EDGE_CIDRS,
    secret: process.env.PASSWORD_AUTH_INGRESS_SECRET,
  };
  process.env.PASSWORD_AUTH_CLIENT_IP_MODE = "trusted-edge";
  process.env.PASSWORD_AUTH_TRUSTED_EDGE_CIDRS = "185.143.232.0/22";
  process.env.PASSWORD_AUTH_INGRESS_SECRET = "b".repeat(64);
  try {
    const response = await loginWithPassword(
      new Request("https://admin.example.com/api/auth/login-password", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
          "x-real-ip": "198.51.100.10",
          "ar-real-ip": "203.0.113.7",
        },
        body: JSON.stringify({ phone: "09120000000", password: "synthetic long passphrase" }),
      })
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "PASSWORD_RATE_LIMIT_UNAVAILABLE");
  } finally {
    for (const [name, value] of [
      ["PASSWORD_AUTH_CLIENT_IP_MODE", previous.mode],
      ["PASSWORD_AUTH_TRUSTED_EDGE_CIDRS", previous.cidrs],
      ["PASSWORD_AUTH_INGRESS_SECRET", previous.secret],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("operator password login preserves owner-only access and keeps the token in an HTTP-only cookie", async () => {
  const previousFetch = globalThis.fetch;
  const oldSecret = process.env.PASSWORD_AUTH_INGRESS_SECRET;
  const oldDev = process.env.ALLOW_DEV_WEB_SESSION;
  const oldApiUrl = process.env.API_INTERNAL_URL;
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.PASSWORD_AUTH_INGRESS_SECRET = "b".repeat(64);
  process.env.ALLOW_DEV_WEB_SESSION = "true";
  process.env.API_INTERNAL_URL = "http://127.0.0.1:3001";
  process.env.NODE_ENV = "development";
  let role = "admin";
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
    return Response.json({ sessionToken: `header.${payload}.signature` });
  };
  const request = () =>
    new Request("http://admin.denali.localhost:3000/api/auth/login-password", {
      method: "POST",
      headers: { origin: "http://admin.denali.localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ phone: "09120000000", password: "a synthetic test passphrase" }),
    });
  try {
    const denied = await loginWithPassword(request());
    assert.equal(
      denied.status,
      403,
      `upstream calls: ${fetchCount}; error: ${(await denied.clone().json()).error?.code}`
    );
    assert.equal((await denied.json()).error.code, "AUTH_OWNER_PANEL_ONLY");
    assert.equal(denied.headers.get("set-cookie"), null);
    role = "owner";
    const accepted = await loginWithPassword(request());
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { ok: true });
    assert.match(accepted.headers.get("set-cookie") ?? "", /HttpOnly/i);
  } finally {
    globalThis.fetch = previousFetch;
    if (oldSecret === undefined) delete process.env.PASSWORD_AUTH_INGRESS_SECRET;
    else process.env.PASSWORD_AUTH_INGRESS_SECRET = oldSecret;
    if (oldDev === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
    else process.env.ALLOW_DEV_WEB_SESSION = oldDev;
    if (oldApiUrl === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = oldApiUrl;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
  }
});
