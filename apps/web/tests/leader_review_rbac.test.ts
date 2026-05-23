import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { API } from "../lib/api-paths";
import { LEADER_REVIEW_COPY } from "../app/(app)/leader/review/leader-review-copy";

function makeSessionToken(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-1",
      tenant_id: "tenant-1",
      role,
    }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

async function setSessionCookie(page: Page, role: string) {
  await page.context().addCookies([
    {
      name: "tour_ops_session",
      value: makeSessionToken(role),
      url: "http://localhost:3000",
      sameSite: "Strict",
    },
  ]);
}

test.describe("leader review RBAC", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/leader/review");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("authenticated participant is redirected to /dashboard", async ({ page }) => {
    await setSessionCookie(page, "member");
    await page.goto("/leader/review");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("authenticated leader can open /leader/review", async ({ page }) => {
    await setSessionCookie(page, "owner");

    await page.route("**/api/v2/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method().toUpperCase();
      const path = url.pathname;

      if (path === API.tours && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "tour-1",
                title: "Leader Tour",
                total_capacity: 10,
                accepted_count: 1,
                lifecycle_status: "OPEN",
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          }),
        });
        return;
      }

      if (path === API.tourRegistrations("tour-1") && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "reg-1",
              tenantId: "tenant-1",
              tourId: "tour-1",
              participantFullName: "Ali Leader",
              participantContactPhone: "+989120000000",
              transportMode: "self_vehicle",
              entryMode: "web",
              status: "Pending",
              paymentStatus: "NotPaid",
              createdAt: "2026-05-01T10:00:00.000Z",
              updatedAt: "2026-05-01T10:00:00.000Z",
            },
          ]),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }),
      });
    });

    const res = await page.goto("/leader/review");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/leader\/review$/);
    await expect(page.locator("body")).toContainText(LEADER_REVIEW_COPY.metadata.title);
  });
});

