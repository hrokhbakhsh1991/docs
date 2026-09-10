/**
 * Tour workspace gap coverage — waitlist, transport filters, reject, roster degraded.
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TRANSPORT_TEST_IDS } from "../../src/features/tours/tour-workspace-transport-logic";
import { TOUR_WORKSPACE_WAITLIST_TEST_IDS } from "../../src/features/tours/tour-workspace-waitlist-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  ensureTourHasApprovalCapacity,
  openWorkspaceGuestRow,
  seedPendingUnpaidGuest,
  WORKSPACE_SMOKE_TOUR_ID,
} from "./fixtures/tour-workspace-smoke";

const WORKSPACE_BASE = `/tours/${WORKSPACE_SMOKE_TOUR_ID}/workspace`;

function isProfileBStagingExternalRun(): boolean {
  const base = process.env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
  if (process.env.PW_EXTERNAL_SERVERS !== "1" || base.length === 0) {
    return false;
  }
  if (/^https?:\/\/(\d{1,3}\.){3}\d+/.test(base)) {
    return true;
  }
  if (/operator\.admin\.localhost:23\d{3}/i.test(base)) {
    return true;
  }
  return /:23\d{3}/.test(base);
}

test.describe("denali-workspace-gap-coverage.spec.ts", () => {
  test("waitlist tab shows scoped command center chrome", async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(`${WORKSPACE_BASE}?tab=waitlist`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/tab=waitlist/);
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabWaitlist)).toHaveAttribute(
      "aria-current",
      "page"
    );

    const waitlistPanel = page.getByTestId(TOUR_WORKSPACE_TEST_IDS.waitlistPanel);
    await expect(waitlistPanel).toBeVisible({ timeout: 30_000 });
    await expect(
      waitlistPanel.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)
    ).toBeVisible({
      timeout: 30_000,
    });

    const capacity = waitlistPanel.getByTestId(TOUR_WORKSPACE_WAITLIST_TEST_IDS.capacity);
    await expect(capacity).toBeVisible({ timeout: 30_000 });
    await expect(
      waitlistPanel.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.workspaceControls)
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(waitlistPanel.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.search)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("transport tab roster filters switch without error", async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(`${WORKSPACE_BASE}?tab=transport`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.transportPanel)).toBeVisible({
      timeout: 90_000,
    });
    const table = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table);
    const empty = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.empty);
    await expect(table.or(empty)).toBeVisible({ timeout: 60_000 });

    const filtersToggle = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filtersToggle);
    if (await filtersToggle.isVisible().catch(() => false)) {
      await filtersToggle.click();
      const filterSelect = page.locator(
        `#tour-workspace-transport-roster-filter, [data-testid="${TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filters}"] select`
      );
      await expect(filterSelect).toBeVisible({ timeout: 10_000 });

      for (const filter of ["final", "unpaid", "paid"] as const) {
        await filterSelect.selectOption(filter);
        const rosterResponse = page
          .waitForResponse(
            (response) =>
              response.url().includes("/operational-roster") &&
              response.url().includes(`filter=${filter}`) &&
              response.ok(),
            { timeout: process.env.PW_EXTERNAL_SERVERS === "1" ? 8_000 : 60_000 }
          )
          .catch(() => null);
        if (rosterResponse !== null) {
          await rosterResponse;
        }
        await expect(table.or(empty)).toBeVisible({ timeout: 30_000 });
      }
    }
  });

  test("workspace registrations reject reaches terminal rejected", async ({ page }) => {
    const stamp = Date.now();
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });
    const { guestName, registrationId } = await seedPendingUnpaidGuest(page, stamp);
    await page.goto(WORKSPACE_BASE, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });

    await openWorkspaceGuestRow(page, guestName);
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton)).toBeVisible({
      timeout: 15_000,
    });

    const rejectResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${registrationId}/reject`) &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton).click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog)).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog)
      .getByRole("button", { name: /تأیید رد|reject confirm/i })
      .click();
    await rejectResponse;

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toContainText(
      /rejected|ردشده|رد شده/i,
      { timeout: 15_000 }
    );
  });

  test("finance tab shows degraded banner when operational roster fails", async ({ page }) => {
    test.skip(
      isProfileBStagingExternalRun() && process.env.PW_STAGING_WEB_DEGRADED_BANNER !== "1",
      "Profile B staging web must include finance roster degraded banner (deploy apps/web; set PW_STAGING_WEB_DEGRADED_BANNER=1 to enforce)"
    );

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    const rosterDegradedResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/operational-roster") &&
        response.request().method() === "GET" &&
        response.status() === 503,
      { timeout: 90_000 }
    );

    await page.route(/\/api\/tours\/[^/]+\/operational-roster/, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "TENANT_DB_BUDGET_EXCEEDED",
          error: "TENANT_DB_BUDGET_EXCEEDED",
        }),
      });
    });

    await page.goto(`${WORKSPACE_BASE}?tab=finance`, { waitUntil: "domcontentloaded" });
    await rosterDegradedResponse;
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.degraded)).toBeVisible({
      timeout: 30_000,
    });
  });
});
