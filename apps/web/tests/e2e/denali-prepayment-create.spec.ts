import { expect, test, type Page } from "@playwright/test";

import { loginOperatorOwner, resolveOperatorWorkspaceId } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import {
  clearOperatorWizardDraftIfPresent as clearOperatorWizardDraftIfPresentFixture,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";

const OPERATOR_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
const OPERATOR_DESTINATION_LABELS = ["دماوند", "Smoke Summit", "توچال", "علم‌کوه"] as const;

const WIZARD_STEP_SHELL_TEST_IDS = {
  back: "workspace-wizard-step-back",
  next: "workspace-wizard-step-next",
  progressStep: (stepId: string) => `workspace-wizard-step-${stepId}`,
} as const;

const DENALI_TOUR_KIND_TEST_IDS = {
  tourKind: "denali-composite-tour-kind",
  category: (category: string) => `denali-tour-kind-category-${category}`,
  duration: (duration: string) => `denali-tour-kind-duration-${duration}`,
} as const;

const DENALI_COMPOSITE_TEST_IDS = {
  destination: "denali-composite-destination",
} as const;

const DENALI_SEARCHABLE_SELECT_TEST_IDS = {
  trigger: "denali-searchable-select-trigger",
  search: "denali-searchable-select-search",
} as const;

const DENALI_DATETIME_TEST_IDS = {
  start: "denali-composite-datetime-start",
  end: "denali-composite-datetime-end",
} as const;

function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

async function fillWizardNumericField(page: Page, labelRegex: RegExp, value: string): Promise<void> {
  const input = page.getByRole("textbox", { name: labelRegex });
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(value);
}

async function fillWizardNumericFieldIfEditable(
  page: Page,
  labelRegex: RegExp,
  value: string
): Promise<void> {
  const input = page.getByRole("textbox", { name: labelRegex });
  await expect(input).toBeVisible({ timeout: 15_000 });
  if (!(await input.isEditable().catch(() => false))) {
    return;
  }
  await input.fill(value);
}

async function fillDenaliDatetimeField(
  page: Page,
  testId: string,
  isoDateLabel: string,
  hourStr: string,
  minuteStr: string
): Promise<void> {
  const host = page.getByTestId(testId);
  await expect(host).toBeVisible();
  await host.locator("[data-operator-date-picker]").click();
  const calendar = page.locator('[data-testid="localized-calendar"]');
  await expect(calendar).toBeVisible({ timeout: 10_000 });

  const dayButton = calendar.locator(`button[aria-label^="${isoDateLabel}"]`).first();
  if (await dayButton.count()) {
    await dayButton.click();
  } else {
    await calendar.getByRole("button", { name: /امروز|today/i }).click();
  }

  await host.locator(".operator-wizard-datetime__control button").last().click();
  const picker = page.locator("[data-operator-wizard-time-picker]");
  await expect(picker).toBeVisible({ timeout: 10_000 });

  await picker.locator(`[data-time-option="${hourStr}"]`).first().click();
  await picker
    .locator(".operator-time-picker__column")
    .last()
    .locator(`[data-time-option="${minuteStr}"]`)
    .click();

  await page.keyboard.press("Escape");
}

async function resetOperatorWizardToBasic(page: Page): Promise<void> {
  await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 90_000 });
  await clearOperatorWizardDraftIfPresentFixture(page);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await page.locator('[data-wizard-step="denali_basic"]').isVisible().catch(() => false)) {
      return;
    }
    const back = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.back);
    await back.waitFor({ state: "attached", timeout: 5_000 }).catch(() => {});
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

async function fillDenaliSingleDayWizardBasics(page: Page, title: string): Promise<void> {
  await resetOperatorWizardToBasic(page);
  await page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.tourKind).waitFor({ state: "visible" });

  const mountain = page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain"));
  const singleDay = page.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("single_day"));
  if ((await mountain.getAttribute("aria-pressed")) !== "true") {
    await mountain.click();
    await settleOperatorWizardDraftSync(page);
  }
  await expect(mountain).toHaveAttribute("aria-pressed", "true");
  await singleDay.click();
  await expect(singleDay).toHaveAttribute("aria-pressed", "true");
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

  const pickFirstAvailableDestination = async () => {
    const nativeSelect = destination.locator("select").first();
    if (await nativeSelect.isVisible().catch(() => false)) {
      const options = await nativeSelect.locator("option").all();
      for (const option of options) {
        const value = await option.getAttribute("value");
        if (value != null && value.trim().length > 4) {
          await nativeSelect.selectOption(value);
          return;
        }
      }
      throw new Error("destination select has no usable option");
    }

    const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
    if (!(await searchableTrigger.isVisible().catch(() => false))) {
      throw new Error("destination picker is unavailable");
    }
    await searchableTrigger.click();
    const searchInput = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.search);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    for (const label of OPERATOR_DESTINATION_LABELS) {
      await searchInput.fill(label);
      const option = destination.getByRole("option", { name: label });
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        return;
      }
    }

    await searchInput.fill("");
    const firstOption = destination.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 10_000 });
    await firstOption.click();
  };

  const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
  if (await searchableTrigger.isVisible().catch(() => false)) {
    await pickFirstAvailableDestination();
  } else {
    const destinationSelect = destination.getByRole("combobox");
    await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
    let selected = false;
    for (const label of OPERATOR_DESTINATION_LABELS) {
      const result = await destinationSelect.selectOption({ label }).catch(() => []);
      if (result.length > 0) {
        selected = true;
        break;
      }
    }
    if (!selected) {
      await pickFirstAvailableDestination();
    }
  }
  await settleOperatorWizardDraftSync(page);

  const startDate = isoDateFromToday(7);
  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.start, startDate, "08", "00");

  const endFieldHost = page.getByTestId(DENALI_DATETIME_TEST_IDS.end);
  if (await endFieldHost.isVisible().catch(() => false)) {
    await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.end, startDate, "18", "00");
  }
  await settleOperatorWizardDraftSync(page);

  await fillWizardNumericField(page, /حداکثر ظرفیت|capacityMax/i, "12");
  await fillWizardNumericFieldIfEditable(page, /ارتفاع قله|peakHeight/i, "5610");
  await settleOperatorWizardDraftSync(page);

  await clickWizardNextToStep(page, "denali_photos");
}

async function fillDenaliWizardPhotosMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({ timeout: 30_000 });
  const fallback = page.getByRole("textbox", {
    name: /خلاصه|shortDescription|short description/i,
  });
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.fill("برنامه تست پیش‌پرداخت");
  }
  await clickWizardNextToStep(page, "denali_program");
}

async function fillDenaliWizardProgramMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_program"]')).toBeVisible({ timeout: 30_000 });
  const difficultySlider = page.getByTestId("denali-difficulty-slider");
  if (await difficultySlider.isVisible().catch(() => false)) {
    await difficultySlider.fill("6");
  }
  await fillWizardNumericField(
    page,
    /مدت تقریبی پیاده|Approximate hiking hours|hikingHoursApprox/i,
    "8"
  );
  await clickWizardNextToStep(page, "denali_logistics");
}

async function fillDenaliWizardLogisticsMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
    timeout: 30_000,
  });
  const transport = page.getByTestId("denali-composite-transport");
  await expect(transport).toBeVisible({ timeout: 15_000 });
  await transport.getByRole("combobox").selectOption("none");
  await clickWizardNextToStep(page, "denali_pricing");
}

async function fillDenaliWizardPricingWithPrepayment(
  page: Page,
  options: { readonly enabled: boolean; readonly percent?: string }
): Promise<void> {
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

  const prepaymentToggle = page.getByRole("checkbox", {
    name: /امکان ثبت‌نام با پیش‌پرداخت|Allow registration with prepayment/i,
  });
  await expect(prepaymentToggle).toBeVisible({ timeout: 15_000 });

  const prepaymentPercentInput = page.getByRole("textbox", {
    name: /درصد پیش‌پرداخت از مبلغ کل|Prepayment percent of total amount/i,
  });

  if (options.enabled) {
    await prepaymentToggle.check();
    await expect(prepaymentPercentInput).toBeVisible({ timeout: 15_000 });
    await prepaymentPercentInput.fill(options.percent ?? "30");
  } else {
    await expect(prepaymentPercentInput).toBeHidden();
    await prepaymentToggle.uncheck().catch(() => {});
    await expect(prepaymentPercentInput).toBeHidden();
  }

  await settleOperatorWizardDraftSync(page);
  await clickWizardNextToStep(page, "denali_legal");
}

async function fillDenaliWizardLegalMinimal(page: Page): Promise<void> {
  await expect(page.locator('[data-wizard-step="denali_legal"]')).toBeVisible({ timeout: 30_000 });
  await clickWizardNextToStep(page, "review");
}

async function submitDenaliWizardDraftCreate(page: Page): Promise<string> {
  const createButton = page
    .locator("[data-wizard-footer]")
    .getByRole("button", { name: /Create tour|ساخت تور/i });
  await expect(createButton).toBeEnabled({ timeout: 30_000 });
  await createButton.click();

  const created = page.locator("[data-tour-created]");
  await expect(created).toBeVisible({ timeout: 60_000 });
  const text = (await created.textContent()) ?? "";
  const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(match?.[0]).toBeTruthy();
  return match![0];
}

async function fetchSavedPricing(page: Page, tourId: string): Promise<Record<string, unknown>> {
  const response = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  expect(
    response.ok(),
    `GET /api/tours/${tourId} failed: ${response.status()} ${await response.text()}`
  ).toBeTruthy();
  const body = (await response.json()) as {
    canonical?: { data?: { pricing?: Record<string, unknown> } };
  };
  return body.canonical?.data?.pricing ?? {};
}

test.describe("denali-prepayment-create.spec.ts", () => {
  test.setTimeout(240_000);

  test("creates tours with and without prepayment and persists the pricing policy", async ({
    page,
  }) => {
    await loginOperatorOwner(page);
    await resolveOperatorWorkspaceId(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    const prepaymentTitle = `Prepay Enabled ${Date.now()}`;
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 90_000 });
    await fillDenaliSingleDayWizardBasics(page, prepaymentTitle);
    await fillDenaliWizardPhotosMinimal(page);
    await fillDenaliWizardProgramMinimal(page);
    await fillDenaliWizardLogisticsMinimal(page);
    await fillDenaliWizardPricingWithPrepayment(page, { enabled: true, percent: "30" });
    await fillDenaliWizardLegalMinimal(page);
    const prepaymentTourId = await submitDenaliWizardDraftCreate(page);
    const prepaymentPricing = await fetchSavedPricing(page, prepaymentTourId);
    expect(prepaymentPricing.prepaymentEnabled).toBe(true);
    expect(prepaymentPricing.prepaymentPercent).toBe(30);

    const noPrepaymentTitle = `Prepay Disabled ${Date.now()}`;
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 90_000 });
    await fillDenaliSingleDayWizardBasics(page, noPrepaymentTitle);
    await fillDenaliWizardPhotosMinimal(page);
    await fillDenaliWizardProgramMinimal(page);
    await fillDenaliWizardLogisticsMinimal(page);
    await fillDenaliWizardPricingWithPrepayment(page, { enabled: false });
    await fillDenaliWizardLegalMinimal(page);
    const noPrepaymentTourId = await submitDenaliWizardDraftCreate(page);
    const noPrepaymentPricing = await fetchSavedPricing(page, noPrepaymentTourId);
    expect(noPrepaymentPricing.prepaymentEnabled).toBe(false);
    expect("prepaymentPercent" in noPrepaymentPricing).toBe(false);
  });
});
