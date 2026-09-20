/**
 * Tour creation wizard map UX helpers (preview + expanded dialog).
 */
import { expect, type Page } from "@playwright/test";

import { DENALI_COMPOSITE_TEST_IDS } from "@app-tour/workspace-denali/host/ui/logic/denali-location-types";
import { WIZARD_STEP_SHELL_TEST_IDS } from "../../src/wizard/wizard-step-shell-logic";
import {
  fillDenaliMultiDayWizardBasics,
  fillDenaliWizardPhotosMinimal,
  fillDenaliWizardProgramMinimal,
} from "./denali-itinerary-wizard-fixture";

export async function navigateToDenaliLogisticsStep(page: Page, title: string): Promise<void> {
  await fillDenaliMultiDayWizardBasics(page, title);
  await fillDenaliWizardPhotosMinimal(page);
  await fillDenaliWizardProgramMinimal(page);
  await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
    timeout: 30_000,
  });
}

export async function expectWizardMapPreview(page: Page, testIdKey: string): Promise<void> {
  const experience = page.getByTestId(`denali-wizard-map-experience-${testIdKey}`);
  await experience.scrollIntoViewIfNeeded();
  await expect(experience).toBeVisible({ timeout: 30_000 });
  await expect(experience).toHaveAttribute("data-wizard-map-expanded", "false");
  await expect
    .poll(async () => page.getByTestId(`denali-location-${testIdKey}-map-preview`).count())
    .toBeGreaterThan(0);
  await expect(page.getByTestId(`denali-location-${testIdKey}-map-preview`)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(`denali-wizard-map-open-${testIdKey}`)).toBeVisible();
}

export async function openWizardMap(page: Page, testIdKey: string): Promise<void> {
  const openButton = page.getByTestId(`denali-wizard-map-open-${testIdKey}`);
  await openButton.scrollIntoViewIfNeeded();
  await openButton.click();
  const dialog = page.getByTestId(`denali-wizard-map-dialog-${testIdKey}`);
  await expect(dialog).toHaveAttribute("open", "", { timeout: 15_000 });
  await expect(page.getByTestId(`denali-location-${testIdKey}-map-expanded`)).toBeVisible({
    timeout: 60_000,
  });
}

export async function closeWizardMap(page: Page, testIdKey: string): Promise<void> {
  await page.getByTestId(`denali-wizard-map-close-${testIdKey}`).click();
  await expect(page.getByTestId(`denali-wizard-map-dialog-${testIdKey}`)).toBeHidden({
    timeout: 15_000,
  });
}

export async function expectGatheringMapSection(page: Page): Promise<void> {
  const section = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.gatheringPoints);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible({
    timeout: 30_000,
  });
}

export async function expectLocationZoneDeferredMap(
  page: Page,
  zoneKey: string
): Promise<void> {
  const zone = page.getByTestId(`denali-location-zone-${zoneKey}`);
  await expect(zone).toHaveAttribute("data-location-zone-open", "false");
  await expect(page.getByTestId(`denali-wizard-map-experience-${zoneKey}`)).toHaveCount(0);
}

export async function expandLocationZone(page: Page, zoneKey: string): Promise<void> {
  const zone = page.getByTestId(`denali-location-zone-${zoneKey}`);
  await zone.locator("summary").click();
  await expect(zone).toHaveAttribute("data-location-zone-open", "true", { timeout: 10_000 });
  await expect(page.getByTestId(`denali-wizard-map-experience-${zoneKey}`)).toBeVisible({
    timeout: 15_000,
  });
}

export async function clickExpandedWizardMap(page: Page, testIdKey: string): Promise<void> {
  const map = page.getByTestId(`denali-location-${testIdKey}-map-expanded`);
  await expect(map).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => {
      const className = await map.getAttribute("class");
      return className?.includes("leaflet-container") === true;
    }, { timeout: 60_000 })
    .toBe(true);
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

export async function expectWizardTitlePreserved(page: Page, title: string): Promise<void> {
  const basicStep = page.locator('[data-wizard-step="denali_basic"]');
  if (!(await basicStep.isVisible().catch(() => false))) {
    const basicProgress = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.progressStep("denali_basic"));
    await expect(basicProgress).toBeEnabled({ timeout: 15_000 });
    await basicProgress.click();
    await expect(basicStep).toBeVisible({ timeout: 30_000 });
  }
  const titleField = page.getByRole("textbox", { name: /نام تور|title/i }).first();
  await expect(titleField).toHaveValue(title);
}

export async function expectWizardStepNavigationIntact(page: Page): Promise<void> {
  const logisticsStep = page.locator('[data-wizard-step="denali_logistics"]');
  if (!(await logisticsStep.isVisible().catch(() => false))) {
    const logisticsProgress = page.getByTestId(
      WIZARD_STEP_SHELL_TEST_IDS.progressStep("denali_logistics")
    );
    await expect(logisticsProgress).toBeEnabled({ timeout: 15_000 });
    await logisticsProgress.click();
    await expect(logisticsStep).toBeVisible({ timeout: 30_000 });
  }
  const back = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.back);
  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  await expect(back).toBeVisible();
  await expect(next).toBeVisible();
}
