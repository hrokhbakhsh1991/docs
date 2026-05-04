import { expect, test } from "@playwright/test";

import { API } from "../../lib/api-paths";

type BookingRow = {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: "self_vehicle";
  entryMode: "web";
  status: "Accepted";
  paymentStatus: "NotPaid";
  createdAt: string;
  updatedAt: string;
};

test.describe("pre-release smoke flow", () => {
  test("login, tours, create booking, bookings list", async ({ page }) => {
    const nowIso = new Date().toISOString();
    const state = {
      sawAuthHeader: false,
      sawIdempotencyKey: false,
      bookings: [] as BookingRow[],
    };

    await page.route("**/api/v2/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method().toUpperCase();
      const path = url.pathname;
      const authHeader = request.headers()["authorization"];

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

      if (!authHeader?.startsWith("Bearer ")) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Missing bearer token" } }),
        });
        return;
      }
      state.sawAuthHeader = true;

      if (path === API.tours && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "tour-1",
                title: "City highlights walk",
                description: "Tour through city center",
                total_capacity: 20,
                accepted_count: state.bookings.length,
                lifecycle_status: "OPEN",
                cost_context: { totalCost: 90, currency: "USD", location: "Center" },
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          }),
        });
        return;
      }

      if (path === API.tour("tour-1") && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "tour-1",
            title: "City highlights walk",
            description: "Tour through city center",
            total_capacity: 20,
            accepted_count: state.bookings.length,
            lifecycle_status: "OPEN",
            cost_context: { totalCost: 90, currency: "USD", location: "Center" },
          }),
        });
        return;
      }

      const registerRe = new RegExp(`^${API.tours.replace(/\//g, "\\/")}\\/([^/]+)\\/register$`, "u");
      const registerMatch = registerRe.exec(path);
      if (registerMatch && method === "POST") {
        const tourIdResolved = registerMatch[1] ?? "tour-1";
        const idemKey = request.headers()["idempotency-key"];
        if (idemKey?.trim()) {
          state.sawIdempotencyKey = true;
        }
        const body = request.postDataJSON() as { tourId?: string; tenantId?: string };
        const created: BookingRow = {
          id: "booking-1",
          tenantId: body.tenantId ?? "tenant-1",
          tourId: body.tourId ?? tourIdResolved,
          participantFullName: "Alex Rivera",
          participantContactPhone: "+100000000",
          transportMode: "self_vehicle",
          entryMode: "web",
          status: "Accepted",
          paymentStatus: "NotPaid",
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        state.bookings = [created];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            registration: created,
            paymentIntent: null,
            waitlistPosition: null,
          }),
        });
        return;
      }

      if (path === API.bookings && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(state.bookings),
        });
        return;
      }

      if (path === API.users && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }

      await route.fulfill({ status: 404, body: "not-found" });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("alex@example.com");
    await page.getByLabel("Password").fill("secret");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/tours$/);

    await expect(page.locator("body")).toContainText("Tours");

    await page.goto("/tours/tour-1/register");
    await page.getByLabel("Full name").fill("Alex Rivera");
    await page.getByLabel("Contact phone").fill("+100000000");
    const submit = page.getByRole("button", { name: "Submit registration" });
    await expect(submit).toBeVisible();
    await submit.click();
    await expect(page.getByTestId("register-success")).toBeVisible();

    await page.goto("/bookings");
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("body")).toContainText("City highlights walk");
    await expect(page.locator("body")).toContainText("Confirmed");

    expect(state.sawAuthHeader).toBeTruthy();
    expect(state.sawIdempotencyKey).toBeTruthy();
  });
});
