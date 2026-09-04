/**
 * TKT-K1 — operator ticketing reports/settings smoke.
 */
import { expect, test } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";
import {
  loginOperatorOwner,
  loginOperatorViewer,
} from "../../test/fixtures/operator-owner-session";

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

async function readSessionBearer(page: import("@playwright/test").Page): Promise<string> {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === SESSION_TOKEN_COOKIE);
  expect(session?.value, "operator session cookie missing").toBeTruthy();
  return session!.value;
}

test.describe("TKT-K1 operator reports and settings", () => {
  test("owner views reports/settings; viewer read-only settings", async ({ page }) => {
    await loginOperatorOwner(page);

    await page.goto("/reports/ticketing", { waitUntil: "load" });
    await expect(page.locator("[data-ticketing-reports]")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("ticketing-report-count")).toBeVisible();

    const bearer = await readSessionBearer(page);
    const summaryRes = await page.request.get(`${tourOpsApiBase()}/ticket-reports/summary`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    expect(summaryRes.ok(), await summaryRes.text()).toBeTruthy();

    await page.goto("/settings/ticketing", { waitUntil: "load" });
    await expect(page.locator("[data-ticketing-settings]")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("ticketing-settings-categories")).toContainText("general");

    await loginOperatorViewer(page);
    const viewerPatch = await page.request.patch("/api/ticket-settings", {
      data: { enabled: false, rowVersion: 1 },
    });
    expect(viewerPatch.status()).toBe(403);
  });
});
