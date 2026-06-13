/**
 * Denali multi-day itinerary — operator wizard E2E helpers (SMK-P9-ITIN-02)
 */
import { expect, type Page } from "@playwright/test";

import { DENALI_DATETIME_TEST_IDS } from "../../src/wizard/denali/denali-datetime-test-ids";
import { DENALI_COMPOSITE_TEST_IDS } from "../../src/wizard/denali/denali-location-types";
import { DENALI_TOUR_KIND_TEST_IDS } from "../../src/wizard/denali/denali-tour-kind-test-ids";
import { WIZARD_STEP_SHELL_TEST_IDS } from "../../src/wizard/wizard-step-shell-logic";

export const OPERATOR_SMOKE_DESTINATION_LABEL = "Smoke Summit (Smoke Alps)";

export const DENALI_FLAT_EDIT_SECTION_TEST_ID = (stepId: string) =>
  `operator-tour-edit-section-${stepId}`;

const OPERATOR_SMOKE_WORKSPACE_ID = "ws-operator-smoke";
const DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard";
const DENALI_CREATE_TOUR_DRAFT_KEY = "denali-create";

export async function clearOperatorCreateTourDraftViaApi(page: Page): Promise<void> {
  const response = await page.request.delete(
    `/api/workspaces/${OPERATOR_SMOKE_WORKSPACE_ID}/drafts/${DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE}/${DENALI_CREATE_TOUR_DRAFT_KEY}`
  );
  expect([200, 204, 404]).toContain(response.status());
}

export async function clearOperatorWizardDraftIfPresent(page: Page): Promise<void> {
  const clearBtn = page.getByTestId("wizard-clear-draft");
  if (!(await clearBtn.isVisible().catch(() => false))) {
    return;
  }
  await expect(clearBtn).toBeEnabled({ timeout: 30_000 });
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await clearBtn.click();

  const syncIndicator = page.getByTestId("draft-sync-indicator");
  if (await syncIndicator.isVisible().catch(() => false)) {
    const retryBtn = page.getByTestId("draft-sync-retry");
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
    }
    await expect(syncIndicator).not.toHaveAttribute("data-status", "SYNCING", { timeout: 30_000 });
  }
}

async function navigateWizardToBasicStep(page: Page): Promise<void> {
  const basicStep = page.locator('[data-wizard-step="denali_basic"]');
  if (await basicStep.isVisible().catch(() => false)) {
    return;
  }

  const basicProgress = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.progressStep("denali_basic"));
  if (await basicProgress.isEnabled().catch(() => false)) {
    await basicProgress.click();
    await expect(basicStep).toBeVisible({ timeout: 30_000 });
    return;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await basicStep.isVisible().catch(() => false)) {
      return;
    }
    const back = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.back);
    if (!(await back.isEnabled().catch(() => false))) {
      break;
    }
    await back.click();
  }

  if (await basicProgress.isEnabled().catch(() => false)) {
    await basicProgress.click();
  }
  await expect(basicStep).toBeVisible({ timeout: 30_000 });
}

export async function resetOperatorWizardToBasic(page: Page): Promise<void> {
  await clearOperatorCreateTourDraftViaApi(page);
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 120_000 });
  await settleOperatorWizardDraftSync(page);

  const basicStep = page.locator('[data-wizard-step="denali_basic"]');
  if (!(await basicStep.isVisible().catch(() => false))) {
    await clearOperatorWizardDraftIfPresent(page);
    await navigateWizardToBasicStep(page);
  }

  await expect(basicStep).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.tourKind)).toBeVisible({ timeout: 30_000 });
}

async function settleOperatorWizardDraftSync(page: Page): Promise<void> {
  const syncIndicator = page.getByTestId("draft-sync-indicator");
  if (!(await syncIndicator.isVisible().catch(() => false))) {
    return;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await expect(syncIndicator).not.toHaveAttribute("data-status", "SYNCING", { timeout: 30_000 });
    const retryBtn = page.getByTestId("draft-sync-retry");
    if (!(await retryBtn.isVisible().catch(() => false))) {
      return;
    }
    await retryBtn.click();
  }
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

async function pickWizardDate(
  page: Page,
  fieldTestId: string,
  dateButtonName: string,
  isoDate: string
): Promise<void> {
  const field = page.getByTestId(fieldTestId);
  await field.getByRole("button", { name: dateButtonName }).click();
  const calendar = page.getByTestId("localized-calendar");
  await expect(calendar).toBeVisible({ timeout: 15_000 });

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const day = calendar.getByRole("button", { name: isoDate, exact: true });
    if (await day.isVisible().catch(() => false)) {
      await day.click();
      return;
    }
    await calendar.getByRole("button", { name: /next month|ماه بعد/i }).click();
  }

  throw new Error(`Could not select calendar date ${isoDate}`);
}

async function pickWizardTime(page: Page, fieldTestId: string, time: string): Promise<void> {
  const [hours, minutes] = time.split(":");
  const field = page.getByTestId(fieldTestId);
  await field.getByRole("button", { name: /ساعت|pick time|pickTime/i }).click();
  const picker = page.locator("[data-denali-wizard-time-picker]");
  await expect(picker).toBeVisible({ timeout: 15_000 });
  await picker
    .getByRole("listbox", { name: /hour|ساعت/i })
    .locator(`[data-time-option="${hours}"]`)
    .click();
  await picker
    .getByRole("listbox", { name: /minute|دقیقه/i })
    .locator(`[data-time-option="${minutes}"]`)
    .click();
  await picker.getByRole("button").last().click();
}

export async function fillDenaliMultiDayWizardBasics(page: Page, title: string): Promise<void> {
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
  const destinationSelect = destination.getByRole("combobox");
  await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
  await destinationSelect.selectOption({ label: OPERATOR_SMOKE_DESTINATION_LABEL });

  await pickWizardDate(page, DENALI_DATETIME_TEST_IDS.start, "شروع برنامه", "2026-07-01");
  await pickWizardTime(page, DENALI_DATETIME_TEST_IDS.start, "08:00");
  await pickWizardDate(page, DENALI_DATETIME_TEST_IDS.end, "پایان برنامه", "2026-07-03");
  await pickWizardTime(page, DENALI_DATETIME_TEST_IDS.end, "18:00");

  await page.getByRole("textbox", { name: /حداکثر ظرفیت|capacityMax/i }).fill("12");
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
