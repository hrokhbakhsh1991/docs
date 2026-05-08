import { expect, test } from "@playwright/test";
import { SESSION_TOKEN_COOKIE } from "../../lib/auth/session-cookie";
import { API } from "../../lib/api-paths";

test.describe("web login phone + otp", () => {
  test("shows otp step after phone, authenticates with valid OTP, sets cookie, redirects", async ({
    page,
    context,
  }) => {
    await page.route("**/api/v2/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method().toUpperCase();
      const path = url.pathname;

      if (path === API.auth.webSession && method === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            session_token:
              "header.eyJzdWIiOiJ1c2VyLTEiLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtMSIsInJvbGUiOiJtZW1iZXIifQ.signature",
            user_id: "user-1",
            tenant_id: "tenant-1",
            entry_mode: "web",
          }),
        });
        return;
      }

      if (path === API.auth.workspaces && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              tenant_id: "tenant-1",
              tenant_name: "Tenant One",
              tenant_subdomain: "tenant-one",
              role: "member",
            },
          ]),
        });
        return;
      }

      if (path === API.tours && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0, page: 1, limit: 10 }),
        });
        return;
      }

      await route.fulfill({ status: 404, body: "not-found" });
    });

    await page.goto("/login");
    await page.getByLabel("Phone").fill("+15551234567");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("OTP")).toBeVisible();
    await page.getByLabel("OTP").fill("1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/tours$/);
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name === SESSION_TOKEN_COOKIE);
    expect(sessionCookie).toBeTruthy();
  });

  test("shows error for invalid otp and stays on login", async ({ page }) => {
    await page.route("**/api/v2/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method().toUpperCase();
      const path = url.pathname;

      if (path === API.auth.webSession && method === "POST") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "req-login-invalid-otp",
            error: {
              code: "AUTH_UNAUTHENTICATED",
              message: "Invalid phone or OTP.",
              details: {},
              retryability: "NO_RETRY",
            },
          }),
        });
        return;
      }

      await route.fulfill({ status: 404, body: "not-found" });
    });

    await page.goto("/login");
    await page.getByLabel("Phone").fill("+15551234567");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("OTP").fill("0000");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).toContainText(
      "Your session has expired. Please sign in again."
    );
  });
});
