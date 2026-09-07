/**
 * GAP-BQC — cross-surface operator gap audit (viewer, dashboard, platform, transport, receipt).
 */
import { expect, test } from "@playwright/test";

import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import {
  loginDenaliOperatorOwner,
  loginDenaliOperatorViewer,
} from "./fixtures/authenticate-denali-operator-for-engagement";
import { DENALI_PUBLISHED_TOUR_ID } from "./fixtures/operator-booking-desk";

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

  test("GAP-TRANSPORT-01 operational roster API + transport UI", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    const rosterRes = await page.request.get(
      `/api/tours/${DENALI_PUBLISHED_TOUR_ID}/operational-roster?filter=operational&limit=20`,
    );
    expect(rosterRes.ok(), await rosterRes.text()).toBeTruthy();

    await page.goto(
      `/tours/${DENALI_PUBLISHED_TOUR_ID}/workspace?tab=transport`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.transportPanel)).toBeVisible({
      timeout: 90_000,
    });
    await captureGapArtifact(page, "/opt/cursor/artifacts/gap-transport-roster-panel.png");
  });

  test("GAP-RECEIPT-01 workspace finance payment recording", async ({ page }) => {
    test.setTimeout(300_000);
    await loginDenaliOperatorOwner(page);
    const stamp = Date.now();
    const guestName = `GAP Receipt ${stamp}`;

    const tourRes = await page.request.get(
      `/api/tours/${encodeURIComponent(DENALI_PUBLISHED_TOUR_ID)}`,
    );
    expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
    const tourBody = (await tourRes.json()) as {
      projection?: { title?: string; departureAt?: string };
    };

    const createRes = await page.request.post("/api/bookings", {
      headers: { "content-type": "application/json" },
      data: {
        tourId: DENALI_PUBLISHED_TOUR_ID,
        tourTitle: tourBody.projection?.title ?? "North Ridge Trek",
        guestLabel: guestName,
        guestEmail: `gap-receipt-${stamp}@denali.local`,
        guestPhone: `+1555${String(stamp).slice(-10)}`,
        partySize: 1,
        departureAt: tourBody.projection?.departureAt ?? "2026-12-25T08:00:00.000Z",
        registrationIntake: { registrantTarget: "other" },
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const registrationId = ((await createRes.json()) as { id?: string }).id?.trim() ?? "";
    expect(registrationId.length).toBeGreaterThan(0);

    const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    const overrideRes = await page.request.put(
      `/api/finance/registrations/${registrationId}/obligation-override`,
      {
        headers: { "content-type": "application/json" },
        data: { obligationMinor: "1000000", reason: "GAP receipt seed" },
      },
    );
    expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();

    await page.goto(
      `/tours/${encodeURIComponent(DENALI_PUBLISHED_TOUR_ID)}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
      timeout: 30_000,
    });

    const amountInput = page.locator(`#workspace-payment-amount-${registrationId}`);
    await expect(amountInput).toBeVisible({ timeout: 15_000 });
    await expect(amountInput).not.toHaveValue("", { timeout: 30_000 });

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/finance/prepayments") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    const submitBtn = page
      .getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)
      .getByRole("button", { name: /Record received payment|ثبت مبلغ واریزشده/i });
    await expect(submitBtn).toBeVisible({ timeout: 15_000 });
    await submitBtn.click();
    const created = await createResponse;
    expect(created.ok(), await created.text()).toBeTruthy();

    const actionBanner = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.paymentActionResult);
    await expect(actionBanner).toBeVisible({ timeout: 30_000 });
    await expect(actionBanner).toHaveAttribute("data-action-kind", "prepayment_recorded");

    const prepaymentsRes = await page.request.get(
      `/api/finance/prepayments?registrationId=${encodeURIComponent(registrationId)}&limit=20`,
    );
    expect(prepaymentsRes.ok(), await prepaymentsRes.text()).toBeTruthy();
    const prepayments = (await prepaymentsRes.json()) as {
      items?: Array<{ amountMinor?: string; registrationId?: string }>;
    };
    expect((prepayments.items ?? []).length).toBeGreaterThan(0);
    const recorded = prepayments.items?.find((row) => row.registrationId === registrationId);
    expect(recorded?.amountMinor).toBe("1000000");

    await expect(page.getByText(/واریز ادمین ثبت شد|Admin payment recorded/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/تسویه شده|fully settled/i)).toBeVisible({ timeout: 30_000 });

    await captureGapArtifact(page, "/opt/cursor/artifacts/gap-receipt-workspace-finance-payment.png");
  });
});
