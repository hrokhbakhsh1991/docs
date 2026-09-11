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

// Default to the operator-smoke tour seeded by the official harness; QA_TOUR_ID can still
// override it for a separately provisioned staging tour.
const TOUR_ID = process.env.QA_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000210";

type BookingRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
};

test.describe("scenario-3 tabs: transport roster + finance filters", () => {
  test("approve then transport roster; finance filter/search without banner", async ({ page }) => {
    test.setTimeout(240_000);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      browserErrors.push(`pageerror: ${error.message}`);
    });
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });

    let unpaid: BookingRow | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const listRes = await page.request.get(
        `/api/bookings?tourId=${encodeURIComponent(TOUR_ID)}&status=pending&view=ops&limit=50`,
        { timeout: 10_000 }
      );
      if (!listRes.ok()) {
        await page.waitForTimeout(1500);
        continue;
      }
      const body = (await listRes.json()) as { items?: BookingRow[] };
      unpaid =
        body.items?.find(
          (row) =>
            row.status === "pending" &&
            (row.paymentStatus === "unpaid" || row.paymentStatus === "partial") &&
            typeof row.guestLabel === "string" &&
            row.guestLabel.trim().length > 0
        ) ?? null;
      if (unpaid !== null) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(unpaid, "need pending unpaid/partial on QA tour").not.toBeNull();
    const guestName = unpaid!.guestLabel!.trim();
    const registrationId = unpaid!.id!;
    const guestRe = new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

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

    const rosterResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/tours/${TOUR_ID}/operational-roster`) &&
        response.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabTransport).click();
    await expect(page).toHaveURL(/tab=transport/);
    const rosterResponse = await rosterResponsePromise;
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
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

    const controls = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.controls);
    await expect(controls).toBeVisible({ timeout: 60_000 });
    await page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filtersToggle).click();
    const settled = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled);
    const controls = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.controls);
    const search = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.search);
    await expect(controls.or(settled)).toBeVisible({ timeout: 60_000 });

    if ((await settled.count()) > 0 && (await controls.count()) === 0) {
      await expect(search).toHaveCount(0);
      expect(browserErrors, "transport/finance workspace must be free of browser errors").toEqual([]);
      return;
    }

    await expect(search).toBeVisible();
    const filtersToggle = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filtersToggle);
    await expect(filtersToggle).toBeVisible();
    await filtersToggle.click();

    const paymentFilter = filters.locator("select#tour-workspace-finance-payment-filter");
    await expect(paymentFilter).toBeVisible({ timeout: 10_000 });

    const guestList = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList);
    const empty = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.empty);

    const assertFilterApplied = async () => {
      await expect(guestList.or(empty)).toBeVisible({ timeout: 15_000 });
      if (await guestList.isVisible()) {
        const kinds = await guestList
          .locator("[data-follow-up-kind]")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-follow-up-kind")));
        expect(kinds.length).toBeGreaterThan(0);
        expect(kinds.every((k) => k === kind)).toBeTruthy();
      } else {
        await expect(empty).toBeVisible();
      }
    };

    await paymentFilter.selectOption("unpaid");
    await assertKindOrEmpty("unpaid");

    await paymentFilter.selectOption("partial");
    await assertKindOrEmpty("partial");

    // Name search against a visible row (tour outstanding may paginate past the just-approved guest).
    await paymentFilter.selectOption("all");
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
    expect(browserErrors, "transport/finance workspace must be free of browser errors").toEqual([]);
  });
});
