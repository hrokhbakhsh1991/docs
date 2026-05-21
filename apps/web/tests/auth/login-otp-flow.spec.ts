import { expect, test } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../lib/auth/session-cookie";
import { installAuthBffSmokeRoutes } from "../smoke/auth-bff-smoke-routes";

test.describe("web login phone + otp", () => {
  test("shows otp step after phone, authenticates with valid OTP, sets cookie, redirects", async ({
    page,
    context,
  }) => {
    await installAuthBffSmokeRoutes(page);

    await page.goto("/login");
    await page.getByLabel("Phone").fill("+15551234567");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("OTP")).toBeVisible();
    await page.getByLabel("OTP").fill("1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name === SESSION_TOKEN_COOKIE);
    expect(sessionCookie).toBeTruthy();
  });

  test("redirects to register when session requires registration (new phone)", async ({ page }) => {
    await installAuthBffSmokeRoutes(page);

    await page.route("**/api/auth/login-web-session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requires_registration: true,
          onboarding_token: "test-onboarding-token",
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Phone").fill("+15559876543");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("OTP").fill("1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/auth\/register\?onboarding=test-onboarding-token/);
  });

  test("register without onboarding redirects to login", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error for invalid otp and stays on login", async ({ page }) => {
    await installAuthBffSmokeRoutes(page);

    await page.route("**/api/auth/login-web-session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "AUTH_UNAUTHENTICATED",
            message: "Invalid phone or OTP.",
          },
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Phone").fill("+15551234567");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("OTP").fill("0000");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).toContainText(/invalid phone|OTP/i);
  });
});
