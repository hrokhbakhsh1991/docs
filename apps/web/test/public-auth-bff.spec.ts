/**
 * Public catalog auth BFF — coded errors (M17)
 * Authority: docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("public-auth-bff.spec.ts — M17", () => {
  it("PUB-BFF-01 phone-preflight empty phone returns MOBILE_REQUIRED", async () => {
    const { POST } = await import("../app/api/public-auth/phone-preflight/route");
    const res = await POST(
      new Request("http://urban.localhost:3000/api/public-auth/phone-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "urban.localhost:3000" },
        body: JSON.stringify({ phone: "" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string } };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
  });

  it("PUB-BFF-02 request-otp empty phone returns MOBILE_REQUIRED", async () => {
    const { POST } = await import("../app/api/public-auth/request-otp/route");
    const res = await POST(
      new Request("http://urban.localhost:3000/api/public-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "urban.localhost:3000" },
        body: JSON.stringify({}),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
  });

  it("PUB-BFF-03 verify-otp missing challenge returns OTP_PAYLOAD_INVALID", async () => {
    const { POST } = await import("../app/api/public-auth/verify-otp/route");
    const res = await POST(
      new Request("http://urban.localhost:3000/api/public-auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "urban.localhost:3000" },
        body: JSON.stringify({ phone: "+15550009901", otp: "1234" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "OTP_PAYLOAD_INVALID");
  });

  it("PUB-BFF-04 register-complete missing display name returns DISPLAY_NAME_REQUIRED", async () => {
    const { POST } = await import("../app/api/public-auth/register-complete/route");
    const res = await POST(
      new Request("http://urban.localhost:3000/api/public-auth/register-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "urban.localhost:3000" },
        body: JSON.stringify({ onboarding_token: "token", display_name: "" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "DISPLAY_NAME_REQUIRED");
  });

  it("PUB-BFF-06 session-profile without cookie returns AUTH_UNAUTHENTICATED", async () => {
    const { GET } = await import("../app/api/public-auth/session-profile/route");
    const res = await GET(new Request("http://urban.localhost:3000/api/public-auth/session-profile"));
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "AUTH_UNAUTHENTICATED");
  });

  it("PUB-BFF-07 maps unresolved tenant bootstrap to PUBLIC_CATALOG_TENANT_UNRESOLVED", async () => {
    const { mapPublicAuthBffCatchError } = await import("../src/auth/public-auth-bff-error");
    const res = mapPublicAuthBffCatchError(new Error("PUBLIC_CATALOG_TENANT_UNRESOLVED"));
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "PUBLIC_CATALOG_TENANT_UNRESOLVED");
  });

  it("PUB-BFF-05 coded errors never leak message field", async () => {
    const { POST } = await import("../app/api/public-auth/request-otp/route");
    const res = await POST(
      new Request("http://urban.localhost:3000/api/public-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "urban.localhost:3000" },
        body: JSON.stringify({ phone: "" }),
      })
    );
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
    assert.equal(body.error?.message, undefined);
  });

  it("PUB-BFF-08 session-profile returns display_name from identity/me", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000099",
        tenant_id: "00000000-0000-4000-8000-000000000004",
        role: "member",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const sessionToken = `header.${payload}.sig`;
    const originalFetch = globalThis.fetch;
    const prevApiBase = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/identity/me")) {
        return new Response(
          JSON.stringify({
            displayName: "Smoke Tester",
            email: "smoke@urban-smoke.local",
            mobile: "+15550009901",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    };
    try {
      const { GET } = await import("../app/api/public-auth/session-profile/route");
      const res = await GET(
        new Request("http://urban.localhost:3000/api/public-auth/session-profile", {
          headers: {
            host: "urban.localhost:3000",
            authorization: `Bearer ${sessionToken}`,
          },
        })
      );
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        ok?: boolean;
        display_name?: string;
        email?: string | null;
      };
      assert.equal(body.ok, true);
      assert.equal(body.display_name, "Smoke Tester");
      assert.equal(body.email, "smoke@urban-smoke.local");
    } finally {
      globalThis.fetch = originalFetch;
      if (prevApiBase === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = prevApiBase;
      }
    }
  });

  it("PUB-BFF-09 verify-otp sets session cookie on existing-user branch", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000099",
        tenant_id: "00000000-0000-4000-8000-000000000004",
        role: "member",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const sessionToken = `header.${payload}.sig`;
    const originalFetch = globalThis.fetch;
    const prevApiBase = process.env.TOUR_OPS_API_URL;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevDevSession = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/public/auth/verify-otp")) {
        return new Response(
          JSON.stringify({
            sessionToken,
            userId: "00000000-0000-4000-8000-000000000099",
            tenantId: "00000000-0000-4000-8000-000000000004",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    };
    try {
      const { POST } = await import("../app/api/public-auth/verify-otp/route");
      const res = await POST(
        new Request("http://urban.localhost:3000/api/public-auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json", host: "urban.localhost:3000" },
          body: JSON.stringify({
            phone: "+15550009901",
            otp: "1234",
            challenge_id: "challenge-smoke",
          }),
        })
      );
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok?: boolean; session_token?: string };
      assert.equal(body.ok, true);
      assert.equal(body.session_token, sessionToken);
      const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
      const joined = setCookie.join("; ");
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
});
