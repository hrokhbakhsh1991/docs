/**
 * Denali multi-day itinerary — operator wizard E2E helpers (SMK-P9-ITIN-02)
 */
import { expect, type Page } from "@playwright/test";

import { navigateOperatorToNewTour } from "./operator-tour-navigation-fixture";

import { DENALI_DATETIME_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-datetime-test-ids";
import { DENALI_ITINERARY_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-itinerary-test-ids";
import { DENALI_COMPOSITE_TEST_IDS } from "@app-tour/workspace-denali/host/ui/logic/denali-location-types";
import { DENALI_PROGRAM_CONTENT_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-program-content-test-ids";
import { DENALI_SEARCHABLE_SELECT_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-searchable-select-test-ids";
import { DENALI_TOUR_KIND_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-tour-kind-test-ids";
import { WIZARD_STEP_SHELL_TEST_IDS } from "../../src/wizard/wizard-step-shell-logic";

export const OPERATOR_SMOKE_DESTINATION_LABEL = "Smoke Summit";

export const DENALI_FLAT_EDIT_SECTION_TEST_ID = (stepId: string) =>
  `operator-tour-edit-section-${stepId}`;

export async function clearOperatorWizardDraftIfPresent(page: Page): Promise<void> {
  const clearBtn = page.getByTestId("wizard-clear-draft");
  if (!(await clearBtn.isVisible().catch(() => false))) {
    return;
  }
  await clearBtn.click();
  const confirmBtn = page.getByTestId("wizard-clear-draft-confirm-confirm");
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
  await confirmBtn.click();
  await expect(clearBtn).toHaveAttribute("aria-busy", "true", { timeout: 10_000 });
  await expect(clearBtn).not.toHaveAttribute("aria-busy", "true", { timeout: 60_000 });
  await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible({ timeout: 60_000 });
  await settleOperatorWizardDraftSync(page);
}

export async function jumpToWizardStep(page: Page, stepId: string): Promise<void> {
  const step = page.locator(`[data-wizard-step="${stepId}"]`);
  if (await step.isVisible().catch(() => false)) {
    return;
  }
  const progress = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.progressStep(stepId));
  await expect(progress).toBeEnabled({ timeout: 15_000 });
  await progress.click();
  await expect(step).toBeVisible({ timeout: 30_000 });
}

function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fillDenaliDatetimeField(
  page: Page,
  testId: string,
  dateOffsetDays: number,
  hour: string,
  minute: string
): Promise<void> {
  const host = page.getByTestId(testId);
  await expect(host).toBeVisible({ timeout: 30_000 });
  await host.locator("[data-operator-date-picker]").click();
  const calendar = page.getByTestId("localized-calendar");
  await expect(calendar).toBeVisible({ timeout: 10_000 });
  await calendar.getByRole("button", { name: isoDateFromToday(dateOffsetDays), exact: true }).click();

  await host.locator("[data-operator-time-picker]").click();
  const picker = page.locator("[data-operator-wizard-time-picker]");
  await expect(picker).toBeVisible({ timeout: 10_000 });
  await picker.getByRole("listbox").nth(0).locator(`[data-time-option="${hour}"]`).click();
  await picker.getByRole("listbox").nth(1).locator(`[data-time-option="${minute}"]`).click();
  await picker.getByRole("button", { name: /تأیید|confirm/i }).click();
}

export async function resetOperatorWizardToBasic(page: Page): Promise<void> {
  await navigateOperatorToNewTour(page);
  const wizard = page.locator("[data-workspace-wizard]");
  await expect(wizard).toBeVisible({ timeout: 90_000 });
  await clearOperatorWizardDraftIfPresent(page);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await page.locator('[data-wizard-step="denali_basic"]').isVisible().catch(() => false)) {
      return;
    }
    const back = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.back);
    if (!(await back.isEnabled().catch(() => false))) {
      break;
    }
    await back.click();
  }

  const basicProgress = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.progressStep("denali_basic"));
  if (await basicProgress.isEnabled().catch(() => false)) {
    await basicProgress.click();
  }
  await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible({ timeout: 30_000 });
}

export async function fillDenaliMultiDayWizardBasics(
  page: Page,
  title: string,
  destinationLabel = OPERATOR_SMOKE_DESTINATION_LABEL
): Promise<void> {
  await resetOperatorWizardToBasic(page);
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.tourKind).waitFor({ state: "visible" });
  const mountain = page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain"));
  const multiDay = page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("multi_day"));
  if ((await mountain.getAttribute("aria-pressed")) !== "true") {
    await mountain.click();
    await settleOperatorWizardDraftSync(page);
  }
  await expect(mountain).toHaveAttribute("aria-pressed", "true");
  await multiDay.click();
  await expect(multiDay).toHaveAttribute("aria-pressed", "true");
  await settleOperatorWizardDraftSync(page);

  const titleField = page.getByRole("textbox", { name: "title" });
  if (await titleField.isVisible().catch(() => false)) {
    await titleField.fill(title);
  } else {
    await page.getByRole("textbox", { name: /نام تور|title/i }).fill(title);
  }

  await settleOperatorWizardDraftSync(page);
  const destination = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.destination);
  await expect(destination).toBeVisible();
  const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
  if (await searchableTrigger.isVisible().catch(() => false)) {
    await searchableTrigger.click();
    await destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.search).fill(destinationLabel);
    await destination.getByRole("option", { name: destinationLabel }).click();
  } else {
    const destinationSelect = destination.getByRole("combobox");
    await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
    await destinationSelect.selectOption({ label: destinationLabel });
  }
  await settleOperatorWizardDraftSync(page);

  const peakHeight = page.getByRole("textbox", {
    name: /ارتفاع قله|peakHeight|Peak height/i,
  });
  if (await peakHeight.isEnabled().catch(() => false)) {
    await peakHeight.fill("5671");
    await settleOperatorWizardDraftSync(page);
  }

  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.start, 1, "08", "00");
  await settleOperatorWizardDraftSync(page);
  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.end, 3, "18", "00");
  await settleOperatorWizardDraftSync(page);

  const capacity = page.getByRole("textbox", { name: /حداکثر ظرفیت|capacity max|capacityMax/i });
  await expect(capacity).toBeVisible({ timeout: 15_000 });
  await capacity.fill("12");
  await settleOperatorWizardDraftSync(page);

  await clickWizardNextToStep(page, "denali_photos");
}

async function settleOperatorWizardDraftSync(page: Page): Promise<void> {
  const indicator = page.getByTestId("draft-sync-indicator");
  await expect
    .poll(() => indicator.getAttribute("data-status"), { timeout: 30_000 })
    .toMatch(/^(?:IDLE|SAVED)$/);
}

async function clickWizardNextToStep(page: Page, expectedStepId: string): Promise<void> {
  await settleOperatorWizardDraftSync(page);
  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  await expect(next).toBeEnabled({ timeout: 30_000 });
  await next.click();
  await expect(page.locator(`[data-wizard-step="${expectedStepId}"]`)).toBeVisible({
    timeout: 30_000,
  });
}

async function fillWizardNumericField(
  page: Page,
  label: RegExp,
  value: string
): Promise<void> {
  const input = page.getByRole("textbox", { name: label });
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(value);
}

export async function advanceWizardToStep(page: Page, stepId: string, maxNext = 8): Promise<void> {
  const step = page.locator(`[data-wizard-step="${stepId}"]`);
  if (await step.isVisible().catch(() => false)) {
    return;
  }
  for (let attempt = 0; attempt < maxNext; attempt += 1) {
    if (await step.isVisible().catch(() => false)) {
      return;
    }
    await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next).click();
  }
  await expect(step).toBeVisible({ timeout: 15_000 });
}

export async function fillDenaliWizardPhotosMinimal(page: Page): Promise<void> {
  await expect(page.locator("[data-wizard-step=\"denali_photos\"]")).toBeVisible({
    timeout: 30_000,
  });
  const shortDescription = page.getByTestId(DENALI_PROGRAM_CONTENT_TEST_IDS.shortDescription);
  if (await shortDescription.isVisible().catch(() => false)) {
    await shortDescription.fill("برنامه تست");
  } else {
    const fallback = page.getByRole("textbox", {
      name: /خلاصه|shortDescription|short description/i,
    });
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.fill("برنامه تست");
    }
  }
  await clickWizardNextToStep(page, "denali_program");
}

export async function fillDenaliWizardProgramMinimal(page: Page): Promise<void> {
  await expect(page.locator("[data-wizard-step=\"denali_program\"]")).toBeVisible({
    timeout: 30_000,
  });
  const difficulty = page.getByTestId("denali-difficulty-slider");
  if (await difficulty.isVisible().catch(() => false)) {
    await difficulty.fill("6");
  }
  await fillWizardNumericField(
    page,
    /مدت تقریبی پیاده|Approximate hiking hours|hikingHoursApprox/i,
    "8"
  );

  const itinerary = page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary);
  if (await itinerary.isVisible().catch(() => false)) {
    const days = itinerary.locator(
      "section[data-testid^=\"denali-composite-itinerary-day-\"]"
    );
    for (let index = 0; index < (await days.count()); index += 1) {
      const day = days.nth(index);
      await day.getByRole("textbox", { name: /عنوان روز|Day title/i }).fill(`روز ${index + 1} تست`);
      await day
        .getByRole("textbox", { name: /^عنوان$|^Title$/i })
        .first()
        .fill(`فعالیت روز ${index + 1}`);
    }
  }
  await clickWizardNextToStep(page, "denali_logistics");
}

async function fillDenaliWizardLogisticsMinimal(page: Page): Promise<void> {
  const transport = page.getByTestId("denali-composite-transport");
  await expect(transport).toBeVisible({ timeout: 30_000 });
  await transport.getByRole("combobox").selectOption("none");
  await clickWizardNextToStep(page, "denali_pricing");
}

async function fillDenaliWizardPricingMinimal(page: Page): Promise<void> {
  await fillWizardNumericField(page, /حداقل سن|minimumAge|Minimum age/i, "18");
  const fitness = page
    .getByTestId("denali-composite-pricing-participants")
    .getByRole("combobox", { name: /سطح آمادگی|Fitness level/i });
  if (await fitness.isVisible().catch(() => false)) {
    await fitness.selectOption("medium");
  }
  await clickWizardNextToStep(page, "denali_legal");
}

export async function fillDenaliMultiDayWizardThroughLegal(
  page: Page,
  title: string
): Promise<void> {
  await fillDenaliMultiDayWizardBasics(page, title);
  await fillDenaliWizardPhotosMinimal(page);
  await fillDenaliWizardProgramMinimal(page);
  await fillDenaliWizardLogisticsMinimal(page);
  await fillDenaliWizardPricingMinimal(page);
  await settleOperatorWizardDraftSync(page);
}

export async function fillDenaliMultiDayWizardThroughReview(
  page: Page,
  title: string
): Promise<void> {
  await fillDenaliMultiDayWizardThroughLegal(page, title);
  await clickWizardNextToStep(page, "review");
}

export async function submitDenaliWizardDraftCreate(page: Page): Promise<string> {
  const create = page
    .locator("[data-wizard-footer]")
    .getByRole("button", { name: /Create tour|ساخت تور/i });
  await expect(create).toBeEnabled({ timeout: 30_000 });
  const createdRedirect = page.waitForURL(/\/tours\?created=/, { timeout: 60_000 });
  await create.click();
  await createdRedirect;
  const tourId = new URL(page.url()).searchParams.get("created")?.trim() ?? "";
  expect(tourId.length).toBeGreaterThan(0);
  return tourId;
}
