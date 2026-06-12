/**
 * BFF login routes — stable coded errors (no message leak)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("auth-bff-login-codes.spec.ts", () => {
  it("BFF-LOGIN-01 request-otp empty phone returns MOBILE_REQUIRED", async () => {
    const { POST } = await import("../app/api/auth/request-otp/route");
    const res = await POST(
      new Request("http://127.0.0.1/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string; message?: string } };
    assert.equal(body.ok, false);
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
    assert.equal(body.error?.message, undefined);
  });

  it("BFF-LOGIN-02 login-web-session empty otp returns OTP_PAYLOAD_INVALID", async () => {
    const { POST } = await import("../app/api/auth/login-web-session/route");
    const res = await POST(
      new Request("http://127.0.0.1/api/auth/login-web-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+15550001001", otp: "" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string } };
    assert.equal(body.error?.code, "OTP_PAYLOAD_INVALID");
  });

  it("BFF-LOGIN-03 phone-preflight empty phone returns MOBILE_REQUIRED", async () => {
    const { POST } = await import("../app/api/auth/phone-preflight/route");
    const res = await POST(
      new Request("http://127.0.0.1/api/auth/phone-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string } };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
  });

  it("BFF-LOGIN-04 coded errors never leak message field", async () => {
    const { POST } = await import("../app/api/auth/request-otp/route");
    const res = await POST(
      new Request("http://127.0.0.1/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "" }),
      })
    );
    const body = (await res.json()) as {
      ok?: boolean;
      error?: { code?: string; message?: string };
    };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
    assert.equal(body.error?.message, undefined);
  });

  it("BFF-LOGIN-05 login-web-session whitespace otp returns OTP_PAYLOAD_INVALID", async () => {
    const { POST } = await import("../app/api/auth/login-web-session/route");
    const res = await POST(
      new Request("http://127.0.0.1/api/auth/login-web-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+15550001001", otp: "   ", challenge_id: "challenge" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    assert.equal(body.error?.code, "OTP_PAYLOAD_INVALID");
    assert.equal(body.error?.message, undefined);
  });

  it("BFF-LOGIN-06 request-otp returns OTP_RATE_LIMITED after BFF window", async () => {
    const { resetBffLoginRateLimitForTests } = await import("../src/auth/bff-login-rate-limit");
    resetBffLoginRateLimitForTests();
    const { POST } = await import("../app/api/auth/request-otp/route");
    const headers = {
      "Content-Type": "application/json",
      host: "denali.localhost:3000",
      "x-forwarded-for": "198.51.100.42",
    };
    let lastStatus = 0;
    let lastCode = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const res = await POST(
        new Request("http://127.0.0.1/api/auth/request-otp", {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: "+15550001001" }),
        })
      );
      lastStatus = res.status;
      const body = (await res.json()) as { error?: { code?: string } };
      lastCode = body.error?.code ?? "";
      if (lastStatus === 429) {
        break;
      }
    }
    assert.equal(lastStatus, 429);
    assert.equal(lastCode, "OTP_RATE_LIMITED");
  });

  it("BFF-LOGIN-08 login-web-session sets welcome-armed cookie for owner", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevDevSession = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000101",
        tenant_id: "00000000-0000-4000-8000-000000000014",
        role: "owner",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .toString("base64url");
    const ownerToken = `header.${payload}.sig`;
    const originalFetch = globalThis.fetch;
    const prevApiBase = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          sessionToken: ownerToken,
          userId: "00000000-0000-4000-8000-000000000101",
          tenantId: "00000000-0000-4000-8000-000000000014",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    try {
      const { POST } = await import("../app/api/auth/login-web-session/route");
      const res = await POST(
        new Request("http://denali.localhost:3000/api/auth/login-web-session", {
          method: "POST",
          headers: { "Content-Type": "application/json", host: "denali.localhost:3000" },
          body: JSON.stringify({ phone: "+15550001001", otp: "1234", challenge_id: "c1" }),
        })
      );
      assert.equal(res.status, 200);
      const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
      const joined = setCookie.join("; ");
      assert.match(joined, /operator-welcome-armed=1/);
      assert.match(joined, /session=/);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevApiBase === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = prevApiBase;
      }
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = prevNodeEnv;
      }
      if (prevDevSession === undefined) {
        delete process.env.ALLOW_DEV_WEB_SESSION;
      } else {
        process.env.ALLOW_DEV_WEB_SESSION = prevDevSession;
      }
    }
  });

  it("BFF-LOGIN-07 login-web-session rejects non-owner JWT (DEC-P9-018)", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevDevSession = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000103",
        tenant_id: "00000000-0000-4000-8000-000000000014",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .toString("base64url");
    const adminToken = `header.${payload}.sig`;
    const originalFetch = globalThis.fetch;
    const prevApiBase = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          sessionToken: adminToken,
          userId: "00000000-0000-4000-8000-000000000103",
          tenantId: "00000000-0000-4000-8000-000000000014",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    try {
      const { POST } = await import("../app/api/auth/login-web-session/route");
      const res = await POST(
        new Request("http://denali.localhost:3000/api/auth/login-web-session", {
          method: "POST",
          headers: { "Content-Type": "application/json", host: "denali.localhost:3000" },
          body: JSON.stringify({ phone: "+15550001002", otp: "1234", challenge_id: "c1" }),
        })
      );
      assert.equal(res.status, 403);
      const body = (await res.json()) as { ok?: boolean; error?: { code?: string; message?: string } };
      assert.equal(body.ok, false);
      assert.equal(body.error?.code, "AUTH_OWNER_PANEL_ONLY");
      assert.equal(body.error?.message, undefined);
      assert.equal(res.headers.get("set-cookie"), null);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevApiBase === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = prevApiBase;
      }
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = prevNodeEnv;
      }
      if (prevDevSession === undefined) {
        delete process.env.ALLOW_DEV_WEB_SESSION;
      } else {
        process.env.ALLOW_DEV_WEB_SESSION = prevDevSession;
      }
    }
  });
});
