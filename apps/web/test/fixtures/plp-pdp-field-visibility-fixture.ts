/**
 * PLP/PDP field-visibility journey helpers (Denali exposure → marketing catalog).
 */
import { expect, type Locator, type Page } from "@playwright/test";

import { DENALI_WORKSPACE_SURFACES_TEST_IDS } from "@app-tour/workspace-denali/host/exposure";
import { SETTINGS_HUB_TEST_IDS } from "../../src/features/settings/settings-module-types";
import { loginDenaliOperatorOwner } from "../../tests/e2e/fixtures/authenticate-denali-operator-for-engagement";

const EXPOSURE_FIELD_CHECKLIST_ROOT = "exposure-field-checklist";

export const DENALI_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";
export const DENALI_SMOKE_PUBLISHED_TOUR_TITLE = "North Ridge Trek";

export const MARKETING_SMOKE_BASE_URL =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://denali.localhost:3002";

export const DESTINATION_FIELD_ID = "denali.destination";
export const DESTINATION_FIELD_LABEL = /مقصد|Destination/i;

export type ExposureSurfaceKey = "public_list" | "public_details";

export async function openDenaliExposureSettings(page: Page): Promise<void> {
  await loginDenaliOperatorOwner(page);
  await page.goto("/settings/exposure", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.exposurePage)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId("exposure-catalog-error")).toHaveCount(0);
  await expect(page.getByTestId(DENALI_WORKSPACE_SURFACES_TEST_IDS.panel)).toBeVisible({
    timeout: 120_000,
  });

  const surfacesResponse = await page.request.get("/api/workspaces/denali/exposure/surfaces");
  expect(surfacesResponse.ok(), await surfacesResponse.text()).toBeTruthy();

  await expect(
    page.locator(
      `[data-testid="${DENALI_WORKSPACE_SURFACES_TEST_IDS.surface}"][data-surface="public_list"]`,
    ),
  ).toBeVisible({
    timeout: 60_000,
  });
}

export function surfaceSection(page: Page, surface: ExposureSurfaceKey): Locator {
  return page.locator(
    `[data-testid="${DENALI_WORKSPACE_SURFACES_TEST_IDS.surface}"][data-surface="${surface}"]`,
  );
}

export async function expandSurfaceSection(
  page: Page,
  surface: ExposureSurfaceKey,
): Promise<void> {
  const details = page.locator(`details:has([data-surface="${surface}"])`);
  await expect(details).toBeVisible({ timeout: 30_000 });
  const isOpen = await details.evaluate((element) => element.hasAttribute("open"));
  if (!isOpen) {
    await details.locator("summary").click();
  }
}

export async function enableSurfaceCustomize(
  page: Page,
  surface: ExposureSurfaceKey,
): Promise<void> {
  await expandSurfaceSection(page, surface);
  const section = surfaceSection(page, surface);
  await expect(section).toBeVisible({ timeout: 30_000 });
  const customize = section.locator(`#denali-surface-customize-${surface}`);
  if (!(await customize.isChecked())) {
    await customize.check();
  }
  await expect(section.getByTestId(EXPOSURE_FIELD_CHECKLIST_ROOT)).toBeVisible({
    timeout: 15_000,
  });
}

export async function inheritSurfaceDefaults(
  page: Page,
  surface: ExposureSurfaceKey,
): Promise<void> {
  await expandSurfaceSection(page, surface);
  const section = surfaceSection(page, surface);
  const customize = section.locator(`#denali-surface-customize-${surface}`);
  if (await customize.isChecked()) {
    await customize.uncheck();
  }
  await saveExposureSurface(page, surface);
}

export async function setSurfaceFieldChecked(
  page: Page,
  surface: ExposureSurfaceKey,
  fieldLabel: RegExp,
  checked: boolean,
): Promise<void> {
  await enableSurfaceCustomize(page, surface);
  const section = surfaceSection(page, surface);
  const fieldCheckbox = section.getByRole("checkbox", { name: fieldLabel });
  await expect(fieldCheckbox).toBeVisible({ timeout: 15_000 });
  if (checked) {
    await fieldCheckbox.check();
  } else {
    await fieldCheckbox.uncheck();
  }
}

export async function saveExposureSurface(
  page: Page,
  surface: ExposureSurfaceKey,
): Promise<void> {
  const section = surfaceSection(page, surface);
  const saveButton = section.getByRole("button", { name: /ذخیره|Save/i });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });
  await saveButton.click();
  await expect(section.getByText(/ذخیره شد|saved/i)).toBeVisible({ timeout: 30_000 });
}

export async function hideDestinationOnSurface(
  page: Page,
  surface: ExposureSurfaceKey,
): Promise<void> {
  await openDenaliExposureSettings(page);
  await setSurfaceFieldChecked(page, surface, DESTINATION_FIELD_LABEL, false);
  await saveExposureSurface(page, surface);
}

export async function restoreDestinationOnSurface(
  page: Page,
  surface: ExposureSurfaceKey,
): Promise<void> {
  await openDenaliExposureSettings(page);
  await inheritSurfaceDefaults(page, surface);
}

export async function openMarketingCatalogList(page: Page): Promise<void> {
  await page.goto(`${MARKETING_SMOKE_BASE_URL}/tours`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
}

export async function openMarketingTourDetail(page: Page, tourId = DENALI_SMOKE_PUBLISHED_TOUR_ID): Promise<void> {
  await page.goto(`${MARKETING_SMOKE_BASE_URL}/tours/${tourId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
}

export function smokeTourCard(page: Page): Locator {
  return page
    .locator("[data-marketing-catalog-card]")
    .filter({ hasText: DENALI_SMOKE_PUBLISHED_TOUR_TITLE })
    .first();
}
