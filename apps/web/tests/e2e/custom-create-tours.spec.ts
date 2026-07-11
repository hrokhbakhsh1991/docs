import { expect, test, type Page } from "@playwright/test";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";

// Inline Test IDs to avoid importing React components
const WIZARD_STEP_SHELL_TEST_IDS = {
  nav: "workspace-wizard-step-nav",
  back: "workspace-wizard-step-back",
  next: "workspace-wizard-step-next",
  panel: "workspace-wizard-step-panel",
  progress: "workspace-wizard-step-progress",
  progressStep: (stepId: string) => `workspace-wizard-step-${stepId}`,
} as const;

const DENALI_TOUR_KIND_TEST_IDS = {
  tourKind: "denali-composite-tour-kind",
  summary: "denali-tour-kind-summary",
  picker: "denali-tour-kind-picker",
  category: (category: string) => `denali-tour-kind-category-${category}`,
  duration: (duration: string) => `denali-tour-kind-duration-${duration}`,
  eventVariant: (variant: string) => `denali-tour-kind-event-${variant}`,
} as const;

const DENALI_COMPOSITE_TEST_IDS = {
  destination: "denali-composite-destination",
  locationZones: "denali-composite-location-zones",
  gatheringPoints: "denali-composite-gathering-points",
  mapPreview: "denali-composite-map-preview",
} as const;

const DENALI_SEARCHABLE_SELECT_TEST_IDS = {
  root: "denali-searchable-select",
  trigger: "denali-searchable-select-trigger",
  panel: "denali-searchable-select-panel",
  search: "denali-searchable-select-search",
  option: (value: string) => `denali-searchable-select-option-${value}`,
} as const;

const DENALI_DATETIME_TEST_IDS = {
  start: "denali-composite-datetime-start",
  end: "denali-composite-datetime-end",
} as const;

const DENALI_ITINERARY_TEST_IDS = {
  itinerary: "denali-composite-itinerary",
  day: (dayNumber: number) => `denali-composite-itinerary-day-${dayNumber}`,
  segment: (dayNumber: number, segmentId: string) =>
    `denali-composite-itinerary-day-${dayNumber}-segment-${segmentId}`,
  addSegment: (dayNumber: number) => `denali-composite-itinerary-day-${dayNumber}-add-segment`,
} as const;

// For denali tenant, destinations are seeded in Persian: "دماوند", "توچال", "علم‌کوه"
const OPERATOR_SMOKE_DESTINATION_LABEL = "دماوند";

// Self-contained E2E helpers
async function clearOperatorWizardDraftIfPresent(page: Page): Promise<void> {
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

async function resetOperatorWizardToBasic(page: Page): Promise<void> {
  // Wait for initial network requests (BFF session / draft state) to complete
  await page.waitForLoadState("networkidle");
  
  await clearOperatorWizardDraftIfPresent(page);
  await page.waitForLoadState("networkidle");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await page.locator('[data-wizard-step="denali_basic"]').isVisible().catch(() => false)) {
      return;
    }
    const back = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.back);
    await back.waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
    if (!(await back.isEnabled().catch(() => false))) {
      break;
    }
    await back.click();
    await page.waitForLoadState("networkidle");
  }

  const basicProgress = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.progressStep("denali_basic"));
  if (await basicProgress.isEnabled().catch(() => false)) {
    await basicProgress.click();
    await page.waitForLoadState("networkidle");
  }
  await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible({ timeout: 30_000 });
}

async function fillWizardNumericField(page: Page, labelRegex: RegExp, value: string): Promise<void> {
  const input = page.getByRole("textbox", { name: labelRegex });
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(value);
}

async function settleOperatorWizardDraftSync(page: Page): Promise<void> {
  const syncIndicator = page.getByTestId("draft-sync-indicator");
  if (await syncIndicator.isVisible().catch(() => false)) {
    await expect(syncIndicator).toHaveAttribute("data-status", "SAVED", { timeout: 30_000 });
  }
}

async function waitForWizardNextReady(page: Page): Promise<void> {
  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  await expect(next).toBeEnabled({ timeout: 30_000 });
}

async function clickWizardNextToStep(page: Page, expectedStepId: string, blockedLabel: string): Promise<void> {
  await settleOperatorWizardDraftSync(page);
  await waitForWizardNextReady(page);
  await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next).click();
  const step = page.locator(`[data-wizard-step="${expectedStepId}"]`);
  await expect(step).toBeVisible({ timeout: 15_000 });
}

async function fillDenaliWizardPhotosMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({ timeout: 30_000 });
  const shortDescription = page.getByTestId("denali-composite-program-short-description");
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
  await settleOperatorWizardDraftSync(page);
  await waitForWizardNextReady(page);
  await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next).click();
  await expect(page.locator('[data-wizard-step="denali_program"]')).toBeVisible({ timeout: 15_000 });
}

async function fillDenaliWizardProgramMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_program"]')).toBeVisible({ timeout: 30_000 });
  
  const itinerary = page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary);
  const difficultySlider = page.getByTestId("denali-difficulty-slider");
  if (await difficultySlider.isVisible().catch(() => false)) {
    await difficultySlider.fill("6");
  }

  await fillWizardNumericField(
    page,
    /مدت تقریبی پیاده|Approximate hiking hours|hikingHoursApprox/i,
    "8"
  );

  if (await itinerary.isVisible().catch(() => false)) {
    const dayCount = await itinerary.locator("[data-testid^='denali-itinerary-day-']").count();
    for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
      const day = page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(dayNumber));
      await expect(day).toBeVisible({ timeout: 15_000 });
      await day.getByRole("textbox", { name: /عنوان روز|Day title/i }).fill(`روز ${dayNumber} تست`);
      await day.getByRole("textbox", { name: /^عنوان$|^Title$/i }).first().fill(`فعالیت روز ${dayNumber}`);
    }
  }

  await clickWizardNextToStep(page, "denali_logistics", "program step blocked before logistics");
}

async function fillDenaliWizardLogisticsMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
    timeout: 30_000,
  });
  const transport = page.getByTestId("denali-composite-transport");
  await expect(transport).toBeVisible({ timeout: 15_000 });
  await transport.getByRole("combobox").selectOption("none");
  await clickWizardNextToStep(page, "denali_pricing", "logistics step blocked before pricing");
}

async function fillDenaliWizardPricingMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_pricing"]')).toBeVisible({
    timeout: 30_000,
  });
  await fillWizardNumericField(page, /حداقل سن|minimumAge|Minimum age/i, "18");
  const fitnessSelect = page
    .getByTestId("denali-composite-pricing-participants")
    .getByRole("combobox", { name: /سطح آمادگی|Fitness level/i });
  if (await fitnessSelect.isVisible().catch(() => false)) {
    await fitnessSelect.selectOption("medium");
  }
  await clickWizardNextToStep(page, "denali_legal", "pricing step blocked before legal");
}

async function fillDenaliWizardLegalMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_legal"]')).toBeVisible({ timeout: 30_000 });
  await settleOperatorWizardDraftSync(page);
}

async function submitDenaliWizardDraftCreate(page: Page): Promise<void> {
  const createButton = page
    .locator("[data-wizard-footer]")
    .getByRole("button", { name: /Create tour|ساخت تور/i });
  await expect(createButton).toBeEnabled({ timeout: 30_000 });
  await createButton.click();

  const created = page.locator("[data-tour-created]");
  await expect(created).toBeVisible({ timeout: 60_000 });
}

// Interacts with the custom popover-based calendar + time picker components
async function fillDenaliDatetimeField(
  page: Page,
  testId: string,
  dayLabelPart: string,
  hourStr: string,
  minuteStr: string
): Promise<void> {
  const host = page.getByTestId(testId);
  await expect(host).toBeVisible();

  // 1. Set Date
  await host.locator("[data-denali-date-picker]").click();
  const calendar = page.locator('[data-testid="localized-calendar"]');
  await expect(calendar).toBeVisible({ timeout: 10_000 });
  
  const dayButton = calendar.locator(`button[aria-label^="${dayLabelPart}"]`).first();
  if (await dayButton.count()) {
    await dayButton.click();
  } else {
    await calendar.getByRole("button", { name: /امروز|today/i }).click();
  }

  // 2. Set Time (last button inside the control)
  await host.locator(".denali-wizard-datetime__control button").last().click();
  const picker = page.locator("[data-denali-wizard-time-picker]");
  await expect(picker).toBeVisible({ timeout: 10_000 });
  
  await picker.locator(`[data-time-option="${hourStr}"]`).first().click();
  await picker.locator(".denali-time-picker__column").last().locator(`[data-time-option="${minuteStr}"]`).click();
  
  // Close popover
  await page.keyboard.press("Escape");
}

async function fillDenaliSingleDayWizardBasics(page: Page, title: string): Promise<void> {
  await resetOperatorWizardToBasic(page);
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.tourKind).waitFor({ state: "visible" });
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain")).click();
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("single_day")).click();

  const titleField = page.getByRole("textbox", { name: "title" });
  if (await titleField.isVisible().catch(() => false)) {
    await titleField.fill(title);
  } else {
    await page.getByRole("textbox", { name: /نام تور|title/i }).fill(title);
  }

  // Destination select option matching database seed exactly
  const destination = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.destination);
  await expect(destination).toBeVisible();
  
  const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
  if (await searchableTrigger.isVisible().catch(() => false)) {
    await searchableTrigger.click();
    const searchInput = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.search);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(OPERATOR_SMOKE_DESTINATION_LABEL);
    const option = destination.getByRole("option", { name: OPERATOR_SMOKE_DESTINATION_LABEL });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
  } else {
    const destinationSelect = destination.getByRole("combobox");
    await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
    await destinationSelect.selectOption({ label: OPERATOR_SMOKE_DESTINATION_LABEL });
  }

  // Localized Datetime composite field inputs
  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.start, "2026-07-15", "08", "00");

  const endFieldHost = page.getByTestId(DENALI_DATETIME_TEST_IDS.end);
  if (await endFieldHost.isVisible().catch(() => false)) {
    await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.end, "2026-07-15", "18", "00");
  }

  await fillWizardNumericField(page, /حداکثر ظرفیت|capacityMax/i, "12");
  await fillWizardNumericField(page, /ارتفاع قله|peakHeight/i, "5610");

  await settleOperatorWizardDraftSync(page);

  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  await expect(next).toBeEnabled({ timeout: 30_000 });
  await next.click();
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({ timeout: 15_000 });
}

async function fillDenaliMultiDayWizardBasicsLocal(page: Page, title: string): Promise<void> {
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

  // Destination select option matching database seed exactly
  const destination = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.destination);
  await expect(destination).toBeVisible();
  
  const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
  if (await searchableTrigger.isVisible().catch(() => false)) {
    await searchableTrigger.click();
    const searchInput = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.search);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(OPERATOR_SMOKE_DESTINATION_LABEL);
    const option = destination.getByRole("option", { name: OPERATOR_SMOKE_DESTINATION_LABEL });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
  } else {
    const destinationSelect = destination.getByRole("combobox");
    await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
    await destinationSelect.selectOption({ label: OPERATOR_SMOKE_DESTINATION_LABEL });
  }

  // Localized Datetime composite field inputs
  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.start, "2026-07-15", "08", "00");
  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.end, "2026-07-18", "18", "00");

  await fillWizardNumericField(page, /حداکثر ظرفیت|capacityMax/i, "12");
  await fillWizardNumericField(page, /ارتفاع قله|peakHeight/i, "5610");

  await settleOperatorWizardDraftSync(page);

  const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
  await expect(next).toBeEnabled({ timeout: 30_000 });
  await next.click();
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({ timeout: 15_000 });
}

test.describe("Custom Tour Creation Spec", () => {
  test.setTimeout(240_000);

  test("Create one-day and multi-day mountain climbing tours", async ({ page }) => {
    const singleDayTitle = `Damavand One-Day Ascent ${Date.now()}`;
    const multiDayTitle = `Alam-Kuh Multi-Day Climb ${Date.now()}`;

    // Login using the +15550001001 number
    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    // 1. Create a One-Day Mountain Climbing Tour
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await fillDenaliSingleDayWizardBasics(page, singleDayTitle);
    await fillDenaliWizardPhotosMinimal(page);
    await fillDenaliWizardProgramMinimal(page);
    await fillDenaliWizardLogisticsMinimal(page);
    await fillDenaliWizardPricingMinimal(page);
    await fillDenaliWizardLegalMinimal(page);
    await submitDenaliWizardDraftCreate(page);
    
    console.log(`Successfully created one-day tour: ${singleDayTitle}`);

    // 2. Create a Multi-Day Mountain Climbing Tour
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await fillDenaliMultiDayWizardBasicsLocal(page, multiDayTitle);
    await fillDenaliWizardPhotosMinimal(page);
    await fillDenaliWizardProgramMinimal(page);
    await fillDenaliWizardLogisticsMinimal(page);
    await fillDenaliWizardPricingMinimal(page);
    await fillDenaliWizardLegalMinimal(page);
    await submitDenaliWizardDraftCreate(page);

    console.log(`Successfully created multi-day tour: ${multiDayTitle}`);
  });
});
