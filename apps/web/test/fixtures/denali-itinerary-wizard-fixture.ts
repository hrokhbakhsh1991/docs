/**
 * Denali multi-day itinerary — operator wizard E2E helpers (SMK-P9-ITIN-02)
 */
import { expect, type Page } from "@playwright/test";

import { DENALI_DATETIME_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-datetime-test-ids";
import { DENALI_COMPOSITE_TEST_IDS } from "@app-tour/workspace-denali/host/ui/logic/denali-location-types";
import { DENALI_SEARCHABLE_SELECT_TEST_IDS } from "@app-tour/workspace-denali/host/ui/components/denali-searchable-select";
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
  await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible({ timeout: 60_000 });
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

function wizardFieldInput(page: Page, canonicalPath: string) {
  return page
    .locator(
      `[data-canonical-path="${canonicalPath}"] input, [data-canonical-path="${canonicalPath}"] textarea`
    )
    .first();
}

export async function resetOperatorWizardToBasic(page: Page): Promise<void> {
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

export async function fillDenaliMultiDayWizardBasics(page: Page, title: string): Promise<void> {
  await resetOperatorWizardToBasic(page);
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.tourKind).waitFor({ state: "visible" });
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain")).click();
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("multi_day")).click();

  const titleField = page.getByRole("textbox", { name: "title" });
  if (await titleField.isVisible().catch(() => false)) {
    await titleField.fill(title);
  } else {
    await page.getByRole("textbox", { name: /نام تور|title/i }).fill(title);
  }

  const destination = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.destination);
  await expect(destination).toBeVisible();
  const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
  if (await searchableTrigger.isVisible().catch(() => false)) {
    await searchableTrigger.click();
    await destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.search).fill(OPERATOR_SMOKE_DESTINATION_LABEL);
    await destination.getByRole("option", { name: OPERATOR_SMOKE_DESTINATION_LABEL }).click();
  } else {
    const destinationSelect = destination.getByRole("combobox");
    await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
    await destinationSelect.selectOption({ label: OPERATOR_SMOKE_DESTINATION_LABEL });
  }

  await page
    .getByTestId(DENALI_DATETIME_TEST_IDS.start)
    .locator("input")
    .fill("2026-07-01T08:00");
  await page
    .getByTestId(DENALI_DATETIME_TEST_IDS.end)
    .locator("input")
    .fill("2026-07-03T18:00");

  await wizardFieldInput(page, "capacityMax").fill("12");
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
