/**
 * Denali multi-day itinerary — operator wizard E2E helpers (SMK-P9-ITIN-02)
 */
import { expect, type Page } from "@playwright/test";

import {
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
} from "@app-tour/workspace-denali/draft";

import { DENALI_DATETIME_TEST_IDS } from "../../src/wizard/denali/denali-datetime-test-ids";
import { DENALI_COMPOSITE_TEST_IDS } from "../../src/wizard/denali/denali-location-types";
import { DENALI_ITINERARY_TEST_IDS } from "../../src/wizard/denali/denali-itinerary-test-ids";
import { DENALI_TOUR_KIND_TEST_IDS } from "../../src/wizard/denali/denali-tour-kind-test-ids";
import { WIZARD_STEP_SHELL_TEST_IDS } from "../../src/wizard/wizard-step-shell-logic";

import { resolveOperatorWorkspaceId } from "./operator-owner-session";

export const OPERATOR_SMOKE_DESTINATION_LABEL = "Smoke Summit (Smoke Alps)";

export const DENALI_FLAT_EDIT_SECTION_TEST_ID = (stepId: string) =>
  `operator-tour-edit-section-${stepId}`;

export async function clearOperatorCreateTourDraftViaApi(page: Page): Promise<void> {
  const workspaceId = await resolveOperatorWorkspaceId(page);
  const url = `/api/workspaces/${encodeURIComponent(workspaceId)}/drafts/${DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE}/${DENALI_CREATE_TOUR_DRAFT_KEY}`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await page.request.delete(url);
    if ([200, 204, 404].includes(response.status())) {
      return;
    }
    if (response.status() !== 502) {
      expect([200, 204, 404]).toContain(response.status());
      return;
    }
    await page.waitForTimeout(500 * (attempt + 1));
  }

  const last = await page.request.delete(url);
  expect([200, 204, 404]).toContain(last.status());
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
  await expect(page.locator("[data-workspace-wizard-loading]")).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 30_000 });
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

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await syncIndicator.getAttribute("data-status", { timeout: 5_000 }).catch(() => null);
    if (status !== "SYNCING" && status !== "CONFLICT_RESOLVING") {
      return;
    }
    const retryBtn = page.getByTestId("draft-sync-retry");
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
    }
    await page.waitForTimeout(400);
  }

  await expect(syncIndicator).not.toHaveAttribute("data-status", "SYNCING", { timeout: 15_000 });
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

function wizardFieldInput(page: Page, fieldPath: string) {
  const escaped = fieldPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const fieldRoot = page
    .locator(`[data-field-path="${escaped}"], [data-canonical-path="${escaped}"]`)
    .first();
  return fieldRoot.locator("input, textarea").first();
}

async function fillWizardNumericField(
  page: Page,
  label: RegExp,
  value: string
): Promise<void> {
  const field = page.getByRole("textbox", { name: label });
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(value, { delay: 25 });
  await field.blur();
}

async function ensureWizardDateTime(
  page: Page,
  fieldTestId: string,
  dateButtonName: string,
  isoDate: string,
  time: string
): Promise<void> {
  const field = page.getByTestId(fieldTestId);
  const dateBtn = field.getByRole("button", { name: dateButtonName });
  const dateLabel = (await dateBtn.innerText()).trim();
  if (
    dateLabel.includes("انتخاب تاریخ") ||
    dateLabel.toLowerCase().includes("select date") ||
    dateLabel.length === 0
  ) {
    await pickWizardDate(page, fieldTestId, dateButtonName, isoDate);
  }

  const timeBtn = field.getByRole("button", { name: /ساعت|pick time|pickTime/i });
  const timeLabel = (await timeBtn.innerText()).trim();
  if (
    timeLabel.includes("انتخاب ساعت") ||
    timeLabel.toLowerCase().includes("pick time") ||
    timeLabel.length === 0
  ) {
    await pickWizardTime(page, fieldTestId, time);
  }
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
  await expect(picker).not.toBeVisible({ timeout: 15_000 });
}

async function readWizardStepValidationIssues(page: Page): Promise<string[]> {
  const issues = page.locator("[data-validation-issue]");
  if ((await issues.count()) > 0) {
    return issues.allTextContents();
  }
  const stepBanner = page.locator(".workspace-wizard__step-validation");
  if (await stepBanner.isVisible().catch(() => false)) {
    const text = (await stepBanner.innerText()).trim();
    if (text.length > 0) {
      return [text];
    }
  }
  return [];
}

export async function fillDenaliMultiDayWizardBasics(page: Page, title: string): Promise<void> {
  await navigateWizardToBasicStep(page);
  await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.tourKind).waitFor({ state: "visible" });
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain")).click();
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("multi_day")).click();

  const titleInput = wizardFieldInput(page, "basicInfo.title");
  if (!(await titleInput.isVisible().catch(() => false))) {
    await page.getByRole("textbox", { name: /نام تور|Tour name/i }).fill(title);
  } else {
    await titleInput.fill(title);
  }

  const destination = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.destination);
  await expect(destination).toBeVisible();
  const destinationSelect = destination.getByRole("combobox");
  await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
  const smokeLabel = OPERATOR_SMOKE_DESTINATION_LABEL;
  const smokeOption = destinationSelect.locator("option", { hasText: smokeLabel });
  if ((await smokeOption.count()) > 0) {
    await destinationSelect.selectOption({ label: smokeLabel });
  } else {
    const firstActive = destinationSelect.locator("option:not([disabled])").first();
    await expect(firstActive).toHaveCount(1, { timeout: 15_000 });
    const value = await firstActive.getAttribute("value");
    expect(value).toBeTruthy();
    await destinationSelect.selectOption(value!);
  }

  await ensureWizardDateTime(page, DENALI_DATETIME_TEST_IDS.start, "شروع برنامه", "2026-07-01", "08:00");
  await ensureWizardDateTime(page, DENALI_DATETIME_TEST_IDS.end, "پایان برنامه", "2026-07-03", "18:00");

  await fillWizardNumericField(page, /حداکثر ظرفیت|capacityMax/i, "12");
  await fillWizardNumericField(page, /ارتفاع قله|peakHeight/i, "5610");

  await settleOperatorWizardDraftSync(page);

  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  try {
    await expect(next).toBeEnabled({ timeout: 30_000 });
  } catch {
    const validationIssues = await readWizardStepValidationIssues(page);
    throw new Error(
      `basic step blocked before photos: ${validationIssues.join(" | ") || "Continue disabled after basic fill"}`
    );
  }
  await next.click();
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({ timeout: 15_000 });
}

async function waitForWizardNextReady(page: Page): Promise<void> {
  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  const syncIndicator = page.getByTestId("draft-sync-indicator");

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await next.isEnabled().catch(() => false)) {
      return;
    }
    if (await syncIndicator.isVisible().catch(() => false)) {
      const status = await syncIndicator.getAttribute("data-status", { timeout: 5_000 }).catch(() => null);
      if (status === "SYNCING" || status === "CONFLICT_RESOLVING") {
        const retryBtn = page.getByTestId("draft-sync-retry");
        if (await retryBtn.isVisible().catch(() => false)) {
          await retryBtn.click();
        }
      }
    }
    await page.waitForTimeout(400);
  }

  const validationIssues = await readWizardStepValidationIssues(page);
  if (validationIssues.length > 0) {
    throw new Error(`wizard Continue blocked: ${validationIssues.join(" | ")}`);
  }

  await expect(next).toBeEnabled({ timeout: 10_000 });
}

async function readVisibleWizardStepId(page: Page): Promise<string | null> {
  const steps = page.locator("[data-wizard-step]");
  const count = await steps.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = steps.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate.getAttribute("data-wizard-step");
    }
  }
  return null;
}

export async function advanceWizardToStep(page: Page, stepId: string, maxNext = 6): Promise<void> {
  const step = page.locator(`[data-wizard-step="${stepId}"]`);
  if (await step.isVisible().catch(() => false)) {
    return;
  }
  const progress = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.progressStep(stepId));
  if (await progress.isEnabled().catch(() => false)) {
    await progress.click();
    await expect(step).toBeVisible({ timeout: 30_000 });
    return;
  }
  for (let attempt = 0; attempt < maxNext; attempt += 1) {
    if (await step.isVisible().catch(() => false)) {
      return;
    }
    const beforeStepId = await readVisibleWizardStepId(page);
    await waitForWizardNextReady(page);
    await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next).click();
    if (await step.isVisible({ timeout: 4_000 }).catch(() => false)) {
      return;
    }
    const afterStepId = await readVisibleWizardStepId(page);
    if (afterStepId === beforeStepId) {
      const validationIssues = await readWizardStepValidationIssues(page);
      throw new Error(
        `wizard stalled on ${afterStepId ?? "unknown"} before ${stepId}: ${
          validationIssues.join(" | ") || "no validation banner"
        }`
      );
    }
  }
  await expect(step).toBeVisible({ timeout: 15_000 });
}

export async function fillDenaliWizardPhotosMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({ timeout: 30_000 });
  const shortDescription = page.getByTestId("denali-composite-program-short-description");
  if (await shortDescription.isVisible().catch(() => false)) {
    await shortDescription.fill("برنامه چندروزه تست دود");
  } else {
    const fallback = page.getByRole("textbox", {
      name: /خلاصه|shortDescription|short description/i,
    });
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.fill("برنامه چندروزه تست دود");
    }
  }
  await settleOperatorWizardDraftSync(page);

  await waitForWizardNextReady(page);
  await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next).click();
  const programStep = page.locator('[data-wizard-step="denali_program"]');
  const reachedProgram = await programStep.isVisible({ timeout: 12_000 }).catch(() => false);
  if (!reachedProgram) {
    const validationIssues = await readWizardStepValidationIssues(page);
    throw new Error(
      `photos step blocked before program: ${validationIssues.join(" | ") || "no validation banner"}`
    );
  }
}

async function clickWizardNextToStep(page: Page, expectedStepId: string, blockedLabel: string): Promise<void> {
  await settleOperatorWizardDraftSync(page);
  await waitForWizardNextReady(page);
  await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next).click();
  const step = page.locator(`[data-wizard-step="${expectedStepId}"]`);
  const reached = await step.isVisible({ timeout: 12_000 }).catch(() => false);
  if (!reached) {
    const validationIssues = await readWizardStepValidationIssues(page);
    throw new Error(
      `${blockedLabel}: ${validationIssues.join(" | ") || "no validation banner"}`
    );
  }
}

export async function fillDenaliWizardLogisticsMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
    timeout: 30_000,
  });
  const transport = page.getByTestId("denali-composite-transport");
  await expect(transport).toBeVisible({ timeout: 15_000 });
  await transport.getByRole("combobox").selectOption("none");
  await clickWizardNextToStep(page, "denali_pricing", "logistics step blocked before pricing");
}

export async function fillDenaliWizardPricingMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_pricing"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("denali-composite-pricing-participants")).toBeVisible({
    timeout: 15_000,
  });
  await fillWizardNumericField(page, /حداقل سن|minimumAge|Minimum age/i, "18");
  const fitnessSelect = page
    .getByTestId("denali-composite-pricing-participants")
    .getByRole("combobox", { name: /سطح آمادگی|Fitness level/i });
  await expect(fitnessSelect).toBeVisible({ timeout: 15_000 });
  await fitnessSelect.selectOption("medium");
  await settleOperatorWizardDraftSync(page);
  await clickWizardNextToStep(page, "denali_legal", "pricing step blocked before legal");
}

export async function fillDenaliWizardLegalMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_legal"]')).toBeVisible({ timeout: 30_000 });
  await settleOperatorWizardDraftSync(page);
}

/** Full multi-day path through published tenant template (ends on legal). */
export async function fillDenaliMultiDayWizardThroughLegal(page: Page, title: string): Promise<void> {
  await fillDenaliMultiDayWizardBasics(page, title);
  await fillDenaliWizardPhotosMinimal(page);
  await fillDenaliWizardProgramMinimal(page);
  await fillDenaliWizardLogisticsMinimal(page);
  await fillDenaliWizardPricingMinimal(page);
  await fillDenaliWizardLegalMinimal(page);
}

/** Layer C review step — create footer renders on last step (INV-WIZ-002). */
export async function fillDenaliMultiDayWizardThroughReview(page: Page, title: string): Promise<void> {
  await fillDenaliMultiDayWizardThroughLegal(page, title);
  await clickWizardNextToStep(page, "review", "legal step blocked before review");
  await expect(page.locator("[data-wizard-footer]").getByRole("button", { name: /Create tour|ساخت تور/i })).toBeVisible({
    timeout: 15_000,
  });
}

async function fillItineraryDayMinimal(
  page: Page,
  dayNumber: number,
  dayTitle: string,
  segmentTitle: string
): Promise<void> {
  const day = page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(dayNumber));
  await expect(day).toBeVisible({ timeout: 15_000 });
  await day.getByRole("textbox", { name: /عنوان روز|Day title/i }).fill(dayTitle);
  await day.getByRole("textbox", { name: /^عنوان$|^Title$/i }).first().fill(segmentTitle);
}

export async function submitDenaliWizardDraftCreate(page: Page): Promise<void> {
  const createButton = page
    .locator("[data-wizard-footer]")
    .getByRole("button", { name: /Create tour|ساخت تور/i });
  await expect(createButton).toBeEnabled({ timeout: 30_000 });
  await createButton.click();

  const created = page.locator("[data-tour-created]");
  const submitError = page.locator("[data-tour-create-error]");
  const settled = await Promise.race([
    created.waitFor({ state: "visible", timeout: 60_000 }).then(() => "created" as const),
    submitError.waitFor({ state: "visible", timeout: 60_000 }).then(() => "error" as const),
  ]).catch(() => "timeout" as const);

  if (settled === "created") {
    return;
  }

  const validationIssues = await readWizardStepValidationIssues(page);
  const submitMessage =
    settled === "error" ? (await submitError.textContent())?.trim() : undefined;
  throw new Error(
    `wizard submit failed: ${submitMessage ?? "timeout"} — ${
      validationIssues.join(" | ") || "no validation banner"
    }`
  );
}

/** Required program fields for mountain multi-day (rule matrix + full template). */
export async function fillDenaliWizardProgramMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_program"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary)).toBeVisible({
    timeout: 30_000,
  });

  const difficultySlider = page.getByTestId("denali-difficulty-slider");
  await expect(difficultySlider).toBeVisible({ timeout: 15_000 });
  await difficultySlider.fill("6");

  await fillWizardNumericField(
    page,
    /مدت تقریبی پیاده|Approximate hiking hours|hikingHoursApprox/i,
    "8"
  );

  const dayCount = await page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary).locator("[data-testid^='denali-itinerary-day-']").count();
  for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
    await fillItineraryDayMinimal(page, dayNumber, `روز ${dayNumber} تست`, `فعالیت روز ${dayNumber}`);
  }

  await clickWizardNextToStep(page, "denali_logistics", "program step blocked before logistics");
}
