/**
 * BQC — Tour creation wizard map UX (preview + expanded dialog).
 */
import { expect, test } from "@playwright/test";

import { prepareDenaliTourWizard } from "../../test/fixtures/tour-creation-publication-fixture";
import {
  clickExpandedWizardMap,
  closeWizardMap,
  expandLocationZone,
  expectGatheringMapSection,
  expectLocationZoneDeferredMap,
  expectWizardMapPreview,
  expectWizardStepNavigationIntact,
  expectWizardTitlePreserved,
  navigateToDenaliLogisticsStep,
  openWizardMap,
} from "../../test/fixtures/tour-creation-wizard-map-fixture";
import { DENALI_COMPOSITE_TEST_IDS } from "@app-tour/workspace-denali/host/ui/logic/denali-location-types";

const GATHERING_MAP_KEY = "gathering-0";
const START_ZONE_KEY = "startPoint";

test.describe("tour-creation-wizard-map.spec.ts — wizard map UX", () => {
  test.setTimeout(300_000);

  test("TC-MAP-01 desktop: gathering map preview opens, interacts, closes, wizard state intact", async ({
    page,
  }) => {
    const title = `TC-MAP-01 Desktop ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    await navigateToDenaliLogisticsStep(page, title);

    await expectGatheringMapSection(page);
    await expectWizardMapPreview(page, GATHERING_MAP_KEY);
    await openWizardMap(page, GATHERING_MAP_KEY);

    await clickExpandedWizardMap(page, GATHERING_MAP_KEY);
    await expect(page.getByTestId(`denali-location-${GATHERING_MAP_KEY}-coords-badge`)).toBeVisible({
      timeout: 30_000,
    });

    const coordsBeforeClose = await page
      .getByTestId(`denali-location-${GATHERING_MAP_KEY}-coords-badge`)
      .innerText();

    await closeWizardMap(page, GATHERING_MAP_KEY);
    await expect(page.getByTestId(`denali-wizard-map-experience-${GATHERING_MAP_KEY}`)).toHaveAttribute(
      "data-wizard-map-expanded",
      "false"
    );
    await expect(page.getByTestId(`denali-location-${GATHERING_MAP_KEY}-coords-badge`)).toHaveText(
      coordsBeforeClose
    );

    await openWizardMap(page, GATHERING_MAP_KEY);
    await expect(page.getByTestId(`denali-location-${GATHERING_MAP_KEY}-coords-badge`)).toHaveText(
      coordsBeforeClose
    );
    await closeWizardMap(page, GATHERING_MAP_KEY);

    await expectWizardStepNavigationIntact(page);
    await expectWizardTitlePreserved(page, title);
  });

  test("TC-MAP-02 mobile: gathering map fullscreen dialog is usable at 390×844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const title = `TC-MAP-02 Mobile ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    await navigateToDenaliLogisticsStep(page, title);

    await expectWizardMapPreview(page, GATHERING_MAP_KEY);
    await openWizardMap(page, GATHERING_MAP_KEY);

    const dialog = page.getByTestId(`denali-wizard-map-dialog-${GATHERING_MAP_KEY}`);
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.height).toBeGreaterThan(700);

    await clickExpandedWizardMap(page, GATHERING_MAP_KEY);
    await closeWizardMap(page, GATHERING_MAP_KEY);
    await expectWizardTitlePreserved(page, title);
  });

  test("TC-MAP-03 location zones defer map until expanded", async ({ page }) => {
    const title = `TC-MAP-03 Zones ${Date.now()}`;
    await prepareDenaliTourWizard(page);
    await navigateToDenaliLogisticsStep(page, title);

    await expect(page.getByTestId(DENALI_COMPOSITE_TEST_IDS.locationZones)).toBeVisible({
      timeout: 30_000,
    });
    await expectLocationZoneDeferredMap(page, START_ZONE_KEY);
    await expandLocationZone(page, START_ZONE_KEY);
    await expectWizardMapPreview(page, START_ZONE_KEY);
    await openWizardMap(page, START_ZONE_KEY);
    await closeWizardMap(page, START_ZONE_KEY);
  });
});
