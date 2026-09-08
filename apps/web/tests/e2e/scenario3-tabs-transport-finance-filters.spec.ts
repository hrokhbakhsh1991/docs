/**
 * Manual QA — Scenario 3: tabs only (no banner CTAs).
 * Approve → Transport roster → Finance filters/search (settled hides tools).
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TRANSPORT_TEST_IDS } from "../../src/features/tours/tour-workspace-transport-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  clickWorkspaceApproveAndWait,
  ensureTourHasApprovalCapacity,
  escapeRegExp,
  openWorkspaceGuestRow,
  seedPendingUnpaidGuest,
  WORKSPACE_SMOKE_TOUR_ID,
} from "./fixtures/tour-workspace-smoke";

test.describe("scenario-3 tabs: transport roster + finance filters", () => {
  test("approve then transport roster; finance filter/search without banner", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });

    const stamp = Date.now();
    const { guestName, registrationId } = await seedPendingUnpaidGuest(request, stamp);
    const guestRe = new RegExp(escapeRegExp(guestName), "i");

    await page.goto(`/tours/${WORKSPACE_SMOKE_TOUR_ID}/workspace`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page
        .getByTestId(TOUR_WORKSPACE_TEST_IDS.registrationsPanel)
        .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)
    ).toBeVisible({
      timeout: 90_000,
    });

    await openWorkspaceGuestRow(page, guestName);
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible({
      timeout: 20_000,
    });
    await clickWorkspaceApproveAndWait(page, registrationId);

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabTransport).click();
    await expect(page).toHaveURL(/tab=transport/);
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.transportPanel)).toBeVisible({
      timeout: 90_000,
    });
    const transportTable = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table);
    const transportEmpty = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.empty);
    await expect(transportTable.or(transportEmpty)).toBeVisible({ timeout: 60_000 });
    if (await transportTable.isVisible()) {
      await expect(transportTable.getByRole("cell", { name: guestRe }).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabFinance).click();
    await expect(page).toHaveURL(/tab=finance/);
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 90_000,
    });

    const settled = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled);
    const controls = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.controls);
    const search = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.search);
    await expect(controls.or(settled)).toBeVisible({ timeout: 60_000 });

    if ((await settled.count()) > 0 && (await controls.count()) === 0) {
      await expect(search).toHaveCount(0);
      return;
    }

    await expect(search).toBeVisible();
    const filtersToggle = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filtersToggle);
    await expect(filtersToggle).toBeVisible();
    await filtersToggle.click();

    const filterSelect = page.locator("#tour-workspace-finance-payment-filter");
    await expect(filterSelect).toBeVisible({ timeout: 10_000 });

    const guestList = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList);
    const empty = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.empty);

    const assertFilterApplied = async () => {
      await expect(guestList.or(empty)).toBeVisible({ timeout: 15_000 });
    };

    await filterSelect.selectOption("unpaid");
    await assertFilterApplied();

    await filterSelect.selectOption("partial");
    await assertFilterApplied();

    await filterSelect.selectOption("all");
    await search.fill("");
    await expect(guestList.or(empty)).toBeVisible({ timeout: 15_000 });
    if (!(await guestList.isVisible())) {
      return;
    }

    const firstRow = guestList.locator("[data-finance-registration-id]").first();
    await expect(firstRow).toBeVisible();
    const sampleRegistrationId = await firstRow.getAttribute("data-finance-registration-id");
    expect(sampleRegistrationId, "guest row needs registration id").toBeTruthy();
    const rowText = ((await firstRow.innerText()) || "").trim();
    const searchToken =
      rowText
        .split(/\s+/)
        .map((part) => part.trim())
        .find((part) => part.length >= 3 && !/^\d/.test(part)) ?? rowText.slice(0, 8);
    expect(searchToken.length).toBeGreaterThan(0);
    await search.fill(searchToken);
    await expect(
      guestList.locator(`[data-finance-registration-id="${sampleRegistrationId}"]`)
    ).toBeVisible({ timeout: 10_000 });
    await search.fill("___no_such_guest_zz___");
    await expect(empty).toBeVisible({ timeout: 10_000 });
  });
});
