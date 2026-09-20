/**
 * Manual QA — Scenario 3: tabs only (no banner CTAs).
 * Approve → Transport roster → Finance filters/search (settled hides tools).
 */
import { expect, test } from "@playwright/test";

import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TRANSPORT_TEST_IDS } from "../../src/features/tours/tour-workspace-transport-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  ensureTourHasApprovalCapacity,
  fetchWorkspaceBookingRows,
  seedApprovedUnpaidGuest,
  WORKSPACE_SMOKE_TOUR_ID,
} from "./fixtures/tour-workspace-smoke";

// Default to the operator-smoke tour seeded by the official harness; QA_TOUR_ID can still
// override it for a separately provisioned staging tour.

test.describe("scenario-3 tabs: transport roster + finance filters", () => {
  test("approve then transport roster; finance filter/search without banner", async ({ page }) => {
    test.setTimeout(240_000);
    const browserErrors: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) {
        browserErrors.push(`http ${response.status()}: ${response.url()}`);
      }
    });
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

    const { guestName, registrationId } = await seedApprovedUnpaidGuest(page, Date.now());
    const approvedRows = await fetchWorkspaceBookingRows(page, { status: "approved" });
    expect(
      approvedRows.some((row) => row.guestLabel?.trim() === guestName),
      "approved unpaid booking must be visible in the operator API list before UI navigation"
    ).toBeTruthy();
    const guestRe = new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const rosterResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/tours/${WORKSPACE_SMOKE_TOUR_ID}/operational-roster`) &&
        response.request().method() === "GET",
      { timeout: 180_000 }
    );
    await page.goto(`/tours/${WORKSPACE_SMOKE_TOUR_ID}/workspace?tab=transport`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabTransport)).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 90_000 }
    );
    const rosterResponse = await rosterResponsePromise;
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.transportPanel)).toBeVisible({
      timeout: 90_000,
    });
    const participantRow = page.locator(`[data-registration-id="${registrationId}"]`);
    await expect(
      participantRow
        .getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalizeParticipantButton)
        .first()
    ).toBeVisible({ timeout: 30_000 });
    const finalizeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${registrationId}/finalize`) &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );
    await participantRow
      .getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalizeParticipantButton)
      .first()
      .click();
    const finalizeResponse = await finalizeResponsePromise;
    expect(finalizeResponse.ok(), await finalizeResponse.text()).toBeTruthy();
    await expect(
      participantRow.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalBadge).first()
    ).toBeVisible({ timeout: 30_000 });
    const transportTable = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table);
    const transportEmpty = page.getByTestId(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.empty);
    await expect(transportTable.or(transportEmpty)).toBeVisible({ timeout: 60_000 });
    if (await transportTable.isVisible()) {
      await expect(transportTable.getByRole("cell", { name: guestRe }).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabFinance).click();
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabFinance)).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 90_000 }
    );
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.panel)).toBeVisible({
      timeout: 90_000,
    });

    const controls = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.controls);
    const settled = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled);
    await expect(controls.or(settled)).toBeVisible({ timeout: 90_000 });
    const search = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.search);
    const filters = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filters);

    if (await settled.isVisible().catch(() => false)) {
      await expect(search).toHaveCount(0);
      expect(browserErrors, "transport/finance workspace must be free of browser errors").toEqual(
        []
      );
      return;
    }

    await page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.filtersToggle).click();
    await expect(search).toBeVisible();
    await expect(filters).toBeVisible();
    const paymentFilter = filters.locator("select#tour-workspace-finance-payment-filter");
    await expect(paymentFilter).toBeVisible({ timeout: 10_000 });

    const guestList = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList);
    const empty = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.empty);

    const assertKindOrEmpty = async (kind: "unpaid" | "partial") => {
      await expect(guestList.or(empty)).toBeVisible({ timeout: 15_000 });
      if (await guestList.isVisible()) {
        const kinds = await guestList
          .locator("[data-follow-up-kind]")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-follow-up-kind")));
        expect(kinds.length).toBeGreaterThan(0);
        expect(kinds.every((value) => value === kind)).toBeTruthy();
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
