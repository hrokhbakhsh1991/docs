import type { Page } from "@playwright/test";

/** Same payload shape as legacy `/api/v2/auth/web/session/otp` smoke mocks (member). */
export const SMOKE_MEMBER_SESSION_JWT =
  "header.eyJzdWIiOiJ1c2VyLTEiLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtMSIsInJvbGUiOiJtZW1iZXIifQ.signature";

export type AuthBffSmokeRoutesOptions = {
  /** Cookie value for `session` (JWT-shaped string). */
  sessionJwt?: string;
};

/**
 * Stubs Next BFF auth routes so Playwright can exercise `/login` without a live Denali backend.
 * Includes `GET /api/auth/session` with **`role: "member"`** so `/bookings` does not redirect participants away.
 * Call **before** other `page.route` handlers that might overlap.
 */
export async function installAuthBffSmokeRoutes(page: Page, opts: AuthBffSmokeRoutesOptions = {}): Promise<void> {
  const sessionJwt = opts.sessionJwt ?? SMOKE_MEMBER_SESSION_JWT;

  await page.route("**/api/auth/phone-preflight", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/auth/request-otp", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/auth/login-web-session", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Set-Cookie": `session=${sessionJwt}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        session_token: sessionJwt,
        user_id: "user-1",
        tenant_id: "tenant-1",
        user: { userId: "user-1", tenantId: "tenant-1", role: "member" },
      }),
    });
  });
}
