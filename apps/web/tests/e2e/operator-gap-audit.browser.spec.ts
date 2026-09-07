/**
 * GAP-BQC — cross-surface operator gap audit (viewer, dashboard, platform route).
 */
import { expect, test } from "@playwright/test";

import {
  loginDenaliOperatorOwner,
  loginDenaliOperatorViewer,
} from "./fixtures/authenticate-denali-operator-for-engagement";

async function captureGapArtifact(page: import("@playwright/test").Page, path: string): Promise<void> {
  try {
    await page.screenshot({ path, fullPage: true });
  } catch (error) {
    console.warn(`GAP artifact screenshot skipped (${path}):`, error);
  }
}

test.describe("operator gap audit — GAP-BQC", () => {
  test("GAP-VIEWER-01 viewer is blocked from owner-only bookings panel", async ({ page }) => {
    await loginDenaliOperatorViewer(page);
    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/access=owner-only|auth\/login/i);

    const approveApi = await page.request.post(
      "/api/bookings/00000000-0000-4000-8000-000000000099/approve",
    );
    expect([401, 403, 404]).toContain(approveApi.status());

    await captureGapArtifact(page, "/opt/cursor/artifacts/gap-viewer-owner-only-redirect.png");
  });

  test("GAP-DASHBOARD-01 operator dashboard after login", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("operator-dashboard-grid")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("dashboard-widget-finance")).toBeVisible({ timeout: 60_000 });
    await captureGapArtifact(page, "/opt/cursor/artifacts/gap-operator-dashboard.png");
  });

  test("GAP-PLATFORM-01 platform versions route is not served on operator admin host", async ({
    page,
  }) => {
    await loginDenaliOperatorOwner(page);
    const res = await page.goto("/platform/versions", { waitUntil: "domcontentloaded" });
    const status = res?.status() ?? 0;
    expect([404, 307, 308]).toContain(status);
    await captureGapArtifact(page, "/opt/cursor/artifacts/gap-platform-versions-operator-host.png");
  });
});
