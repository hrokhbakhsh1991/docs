/**
 * BQC — Tour creation closure gaps (member reg, PDP parity, viewer, tenant, LTR, export).
 */
import { expect, test } from "@playwright/test";

import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M } from "../../test/fixtures/denali-itinerary-wizard-fixture";
import {
  createDenaliMultiDayDraftTour,
  expectDraftCanonicalFieldsPersisted,
  expectFlatEditShowsTitle,
  openFlatEditForTour,
  prepareDenaliTourWizard,
  publishTourFromFlatEdit,
} from "../../test/fixtures/tour-creation-publication-fixture";
import {
  assertDenaliTenantCannotAccessOperatorTour,
  assertNoTourExportControls,
  assertViewerCannotMutateTour,
  completePortalRegistrationForTour,
  fetchMarketingCatalogListItem,
  fetchMarketingCatalogTour,
  openMarketingTourDetail,
  publishTourForClosure,
  readCanonicalBasePriceMinor,
  readCanonicalItineraryDayCount,
  readCanonicalPeakHeight,
  setOperatorLocale,
} from "../../test/fixtures/tour-creation-closure-fixture";

test.describe("tour-creation-closure.spec.ts", () => {
  test.setTimeout(360_000);

  test("TC-CL-REG-01 member completes portal registration for published tour", async ({
    page,
  }) => {
    const title = `TC-CL-REG ${Date.now()}`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    const { tourId } = await publishTourForClosure(page, title);

    await completePortalRegistrationForTour(page, tourId, {
      phone,
      fullName: "Closure Registration Guest",
    });

    await page.goto("http://admin.operator.localhost:3000/tours", {
      waitUntil: "domcontentloaded",
    });
    await loginOperatorOwner(page);
    const registrationsRes = await page.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(registrationsRes.ok(), await registrationsRes.text()).toBeTruthy();
    const registrations = (await registrationsRes.json()) as {
      items?: readonly { guestLabel?: string }[];
    };
    const names = (registrations.items ?? [])
      .map((row) => row.guestLabel?.trim() ?? "")
      .filter((name) => name.length > 0);
    expect(names.some((name) => name.includes("Closure Registration Guest"))).toBeTruthy();
  });

  test("TC-CL-PDP-01 marketing catalog parity matches operator canonical", async ({ page }) => {
    const title = `TC-CL-PDP ${Date.now()}`;
    const { tourId, canonical } = await publishTourForClosure(page, title);

    const listItem = await fetchMarketingCatalogListItem(page, tourId);
    expect(listItem).toBeDefined();
    expect(listItem?.title).toBe(title);
    expect(listItem?.category).toBe(canonical.category);

    const detail = await fetchMarketingCatalogTour(page, tourId);
    expect(detail.title).toBe(title);
    expect(detail.category).toBe(canonical.category);
    expect(detail.totalCapacity).toBe(canonical.capacityMax);
    expect(detail.peakHeightMeters).toBe(readCanonicalPeakHeight(canonical));
    expect(detail.itineraryDays?.length ?? 0).toBe(readCanonicalItineraryDayCount(canonical));

    const canonicalPrice = readCanonicalBasePriceMinor(canonical);
    if (canonicalPrice !== null) {
      expect(detail.priceAmount).toBe(canonicalPrice);
    }

    await openMarketingTourDetail(page, tourId, title);
    await expect(page.locator("[data-marketing-catalog-itinerary]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-marketing-catalog-detail-destination]")).toBeVisible();
  });

  test("TC-CL-VIEWER-01 viewer cannot mutate tour in UI or API", async ({ page }) => {
    const title = `TC-CL-VIEWER ${Date.now()}`;
    const { tourId } = await publishTourForClosure(page, title);
    await assertViewerCannotMutateTour(page, tourId, title);
  });

  test("TC-CL-TENANT-01 denali tenant cannot read or patch operator tour", async ({ page }) => {
    const title = `TC-CL-TENANT ${Date.now()}`;
    const { tourId } = await publishTourForClosure(page, title);
    await assertDenaliTenantCannotAccessOperatorTour(page, tourId, title);
  });

  test("TC-CL-LTR-01 English LTR create draft publish persists fields", async ({ page }) => {
    await setOperatorLocale(page, "en");
    const title = `TC-CL-LTR ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const tourId = await createDenaliMultiDayDraftTour(page, title);
    await expectDraftCanonicalFieldsPersisted(page, tourId, {
      title,
      category: "mountain_multi",
      capacityMax: 12,
      peakHeight: OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M,
      itineraryDayCount: 3,
    });
    await publishTourFromFlatEdit(page, tourId);
    await openFlatEditForTour(page, tourId);
    await expectFlatEditShowsTitle(page, title);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible();
  });

  test("TC-CL-EXPORT-01 tour Excel/PDF export is not implemented", async ({ page }) => {
    const title = `TC-CL-EXPORT ${Date.now()}`;
    const { tourId } = await publishTourForClosure(page, title);
    await assertNoTourExportControls(page, tourId);
  });
});
