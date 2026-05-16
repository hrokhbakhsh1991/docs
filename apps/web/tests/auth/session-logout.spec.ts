import { expect, test } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../lib/auth/session-cookie";

const SAMPLE_JWT =
  "header.eyJzdWIiOiJ1c2VyLTEiLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtMSIsInJvbGUiOiJtZW1iZXIifQ.signature";

test.describe("BFF session (local cookie/JWT, no Nest upstream)", () => {
  test("GET /api/auth/session without cookie returns authenticated false", async ({ request }) => {
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { authenticated?: boolean };
    expect(body.authenticated).toBe(false);
  });

  test("GET /api/auth/session with valid cookie returns authenticated true", async ({
    request,
    context,
  }) => {
    await context.addCookies([
      {
        name: SESSION_TOKEN_COOKIE,
        value: SAMPLE_JWT,
        url: "http://127.0.0.1:3000",
      },
    ]);
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { authenticated?: boolean; user_id?: string };
    expect(body.authenticated).toBe(true);
    expect(body.user_id).toBe("user-1");
  });

  test("GET /api/me without session cookie returns 401", async ({ request }) => {
    const res = await request.get("/api/me");
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("AUTH_UNAUTHENTICATED");
  });

  test("POST /api/auth/logout clears session cookie", async ({ request, context }) => {
    await context.addCookies([
      {
        name: SESSION_TOKEN_COOKIE,
        value: SAMPLE_JWT,
        url: "http://127.0.0.1:3000",
      },
    ]);
    const res = await request.post("/api/auth/logout");
    expect(res.ok()).toBeTruthy();
    const cookies = await context.cookies("http://127.0.0.1:3000");
    const session = cookies.find((c) => c.name === SESSION_TOKEN_COOKIE);
    expect(session?.value ?? "").toBe("");
  });
});
