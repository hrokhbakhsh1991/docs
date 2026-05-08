import type { Page, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

function makeSessionToken(role: string, userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      user_id: userId,
      tenant_id: "tenant-1",
      role,
    }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

async function setSessionCookie(page: Page, role: string, userId: string) {
  await page.context().addCookies([
    {
      name: "tour_ops_session",
      value: makeSessionToken(role, userId),
      url: "http://localhost:3000",
      sameSite: "Strict",
    },
  ]);
}

const pageData = {
  data: [
    { id: "u-admin", name: "Admin User", email: "admin.user@test.local", role: "admin", status: "Active" },
    { id: "u-member", name: "Member User", email: "member.user@test.local", role: "member", status: "Active" },
  ],
  nextCursor: null,
} as const;

test.describe("/users optimistic role updates", () => {
  test("success keeps optimistic role and row-level loading", async ({ page }) => {
    await setSessionCookie(page, "owner", "u-owner");
    let patchRoute: Route | null = null;

    await page.route("**/api/v2/users**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "GET" && url.pathname === "/api/v2/users") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(pageData),
        });
        return;
      }
      if (req.method() === "PATCH" && url.pathname === "/api/v2/users/u-member") {
        patchRoute = route;
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }),
      });
    });

    await page.goto("/users");

    const memberSelect = page.getByLabel("Role for Member User");
    const adminSelect = page.getByLabel("Role for Admin User");
    await expect(memberSelect).toBeVisible();
    await expect(adminSelect).toBeEnabled();

    await memberSelect.selectOption("viewer");
    await expect(memberSelect).toHaveValue("viewer");
    await expect(memberSelect).toBeDisabled();
    await expect(adminSelect).toBeEnabled();

    await expect.poll(() => Boolean(patchRoute)).toBeTruthy();
    await patchRoute!.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "u-member",
        name: "Member User",
        email: "member.user@test.local",
        role: "viewer",
        status: "Active",
      }),
    });

    await expect(memberSelect).toHaveValue("viewer");
    await expect(memberSelect).toBeEnabled();
    await expect(page.getByText("Role updated.")).toBeVisible();
  });

  test("failure rolls back optimistic role and shows feedback", async ({ page }) => {
    await setSessionCookie(page, "owner", "u-owner");

    await page.route("**/api/v2/users**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "GET" && url.pathname === "/api/v2/users") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(pageData),
        });
        return;
      }
      if (req.method() === "PATCH" && url.pathname === "/api/v2/users/u-member") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "req-test",
            error: {
              code: "INTERNAL_ERROR",
              message: "Could not update role",
              details: {},
              retryability: "SAFE_RETRY",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }),
      });
    });

    await page.goto("/users");
    const memberSelect = page.getByLabel("Role for Member User");

    await expect(memberSelect).toHaveValue("member");
    await memberSelect.selectOption("viewer");
    await expect(memberSelect).toHaveValue("viewer");
    await expect(memberSelect).toBeEnabled();
    await expect(memberSelect).toHaveValue("member");
  });
});

