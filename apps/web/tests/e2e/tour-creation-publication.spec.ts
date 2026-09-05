/**
 * BQC — Tour creation + publication journey (Denali operator).
 * Authority: docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md · P6 VS-01 publish visibility
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";
import { OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M } from "../../test/fixtures/denali-itinerary-wizard-fixture";
import {
  createDenaliMultiDayDraftTour,
  expectDraftCanonicalFieldsPersisted,
  expectFlatEditShowsTitle,
  expectTourInDenaliCatalog,
  expectTourListedAsActive,
  openFlatEditForTour,
  prepareDenaliTourWizard,
  publishTourFromFlatEdit,
  runTourCreationPublicationJourney,
} from "../../test/fixtures/tour-creation-publication-fixture";

type AxeViolation = {
  readonly id: string;
  readonly impact?: "minor" | "moderate" | "serious" | "critical" | null;
  readonly help: string;
};

const AXE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../node_modules/.pnpm/node_modules/axe-core/axe.min.js"),
  "utf8"
);

async function assertNoSeriousA11yViolations(
  page: Page,
  selector: string,
  label: string
): Promise<void> {
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async (contextSelector) => {
    const context = document.querySelector(contextSelector);
    if (context === null) {
      return [];
    }
    const axe = (window as unknown as {
      axe: {
        run: (
          context: Element,
          options: {
            readonly runOnly: { readonly type: "tag"; readonly values: readonly string[] };
          }
        ) => Promise<{ readonly violations: readonly AxeViolation[] }>;
      };
    }).axe;
    const result = await axe.run(context, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
  }, selector);
  expect(violations, `${label} serious/critical axe violations`).toEqual([]);
}

test.describe("tour-creation-publication.spec.ts — Denali create → publish", () => {
  test.setTimeout(300_000);

  test("TC-D01 desktop RTL: wizard create → flat-edit publish → catalog", async ({ page }) => {
    const tourTitle = `TC-D01 Publish ${Date.now()}`;
    const tourId = await runTourCreationPublicationJourney(page, tourTitle);
    expect(tourId.length).toBeGreaterThan(0);
    await page.screenshot({
      path: "/opt/cursor/artifacts/tour-creation-desktop-rtl-published.png",
      fullPage: true,
    });
  });

  test("TC-M01 mobile RTL: wizard create → flat-edit publish → catalog", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const tourTitle = `TC-M01 Publish ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const tourId = await createDenaliMultiDayDraftTour(page, tourTitle);
    await publishTourFromFlatEdit(page, tourId);
    await expectTourListedAsActive(page, tourTitle);
    await expectTourInDenaliCatalog(page, tourTitle);
    await page.screenshot({
      path: "/opt/cursor/artifacts/tour-creation-mobile-rtl-published.png",
      fullPage: true,
    });
  });

  test("TC-A01 accessibility: flat-edit publish action bar", async ({ page }) => {
    const tourTitle = `TC-A01 A11y ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const tourId = await createDenaliMultiDayDraftTour(page, tourTitle);
    await page.goto(`/tours/${encodeURIComponent(tourId)}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
    await assertNoSeriousA11yViolations(
      page,
      `[data-testid="${TOUR_EDIT_TEST_IDS.stickyActions}"]`,
      "flat edit publish bar"
    );
    await publishTourFromFlatEdit(page, tourId);
    await assertNoSeriousA11yViolations(
      page,
      `[data-testid="${TOUR_EDIT_TEST_IDS.stickyActions}"]`,
      "flat edit post-publish bar"
    );
  });

  test("TC-P01 persistence: published status survives reload", async ({ page }) => {
    const tourTitle = `TC-P01 Persist ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const tourId = await createDenaliMultiDayDraftTour(page, tourTitle);
    await publishTourFromFlatEdit(page, tourId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-tour-status="active"]')).toBeVisible({ timeout: 30_000 });
    await expectTourInDenaliCatalog(page, tourTitle);
  });

  test("TC-FIELD-01 draft canonical fields persist via API after wizard create", async ({
    page,
  }) => {
    const tourTitle = `TC-FIELD-01 ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const tourId = await createDenaliMultiDayDraftTour(page, tourTitle);
    await expectDraftCanonicalFieldsPersisted(page, tourId, {
      title: tourTitle,
      category: "mountain_multi",
      capacityMax: 12,
      peakHeight: OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M,
      itineraryDayCount: 3,
    });
  });

  test("TC-DRAFT-01 flat-edit reload keeps wizard title after draft create", async ({ page }) => {
    const tourTitle = `TC-DRAFT-01 ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    const tourId = await createDenaliMultiDayDraftTour(page, tourTitle);
    await openFlatEditForTour(page, tourId);
    await expectFlatEditShowsTitle(page, tourTitle);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectFlatEditShowsTitle(page, tourTitle);
    await page.screenshot({
      path: "/opt/cursor/artifacts/tour-creation-draft-flat-edit-reload.png",
      fullPage: true,
    });
  });
});
