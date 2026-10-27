/**
 * Denali multi-day itinerary — operator wizard E2E helpers (SMK-P9-ITIN-02)
 */
import { expect, type Page } from "@playwright/test";

import { toAsciiDigits } from "../../src/i18n/format-localized-digits";
import { navigateOperatorToNewTour } from "./operator-tour-navigation-fixture";

import { DENALI_DATETIME_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-datetime-test-ids";
import { DENALI_ITINERARY_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-itinerary-test-ids";
import { DENALI_COMPOSITE_TEST_IDS } from "@app-tour/workspace-denali/host/ui/logic/denali-location-types";
import { DENALI_PROGRAM_CONTENT_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-program-content-test-ids";
import { DENALI_SEARCHABLE_SELECT_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-searchable-select-test-ids";
import { DENALI_TOUR_KIND_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-tour-kind-test-ids";
import { WIZARD_STEP_SHELL_TEST_IDS } from "../../src/wizard/wizard-step-shell-logic";

export const OPERATOR_SMOKE_DESTINATION_LABEL = "Smoke Summit";
/** ED-PEAK-LOCK-01 — Smoke Summit `altitudeM` from operator smoke catalog seed (tenant …014). */
export const OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M = 4200;

/** Denali club dev catalog (tenant …003) — Persian destination labels from seed-operator-smoke-catalog. */
export const DENALI_DEV_DESTINATION_LABELS = ["دماوند", "توچال", "علم‌کوه"] as const;
export const DENALI_DEV_DEFAULT_DESTINATION_LABEL = DENALI_DEV_DESTINATION_LABELS[0];

const DESTINATION_LOCKED_PEAK_HEIGHT_BY_LABEL: Readonly<Record<string, number>> = {
  [OPERATOR_SMOKE_DESTINATION_LABEL]: OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M,
  دماوند: 5_610,
  توچال: 3_962,
  علم‌کوه: 4_850,
};

export function resolveLockedPeakHeightForDestination(label: string): number {
  const height = DESTINATION_LOCKED_PEAK_HEIGHT_BY_LABEL[label.trim()];
  if (height === undefined) {
    throw new Error(`Unknown destination label for locked peak height: ${label}`);
  }
  return height;
}

export const WIZARD_DESTINATION_LABEL_CANDIDATES = [
  OPERATOR_SMOKE_DESTINATION_LABEL,
  ...DENALI_DEV_DESTINATION_LABELS,
] as const;

export type DenaliWizardDestination = {
  readonly id: string;
  readonly name: string;
  readonly altitudeM: number;
};

export async function resolveDenaliWizardDestination(
  page: Page,
  requestedLabel?: string
): Promise<DenaliWizardDestination> {
  const response = await page.request.get("/api/settings/resources/locations");
  expect(response.ok(), `destination lookup failed (${response.status()})`).toBeTruthy();
  const body = (await response.json()) as {
    destinations?: readonly {
      id?: string;
      name?: string;
      locationType?: string;
      altitudeM?: number | null;
      isActive?: boolean;
    }[];
  };
  const peaks = (body.destinations ?? []).filter(
    (item): item is typeof item & { id: string; name: string; altitudeM: number } =>
      item.isActive === true &&
      item.locationType === "peak" &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.altitudeM === "number" &&
      Number.isFinite(item.altitudeM)
  );
  const selected = requestedLabel
    ? peaks.find((item) => item.name === requestedLabel)
    : (WIZARD_DESTINATION_LABEL_CANDIDATES.flatMap((candidate) =>
        peaks.filter((item) => item.name === candidate)
      )[0] ?? peaks[0]);
  expect(
    selected,
    requestedLabel
      ? `active peak destination ${requestedLabel} must exist in this tenant`
      : "the current tenant must expose at least one active peak destination"
  ).toBeTruthy();
  return { id: selected!.id, name: selected!.name, altitudeM: selected!.altitudeM };
}

export const DENALI_FLAT_EDIT_SECTION_TEST_ID = (stepId: string) =>
  `operator-tour-edit-section-${stepId}`;

export type DenaliWizardPricingE2EOptions = {
  readonly paymentCollection?: "free" | "paid";
  readonly registrationApproval?: "manual" | "auto";
  readonly basePriceToman?: string;
  readonly prepaymentEnabled?: boolean;
  readonly prepaymentPercent?: number;
};

export type DenaliWizardTransportE2EOptions = {
  readonly mode?:
    | "organizer_vehicle"
    | "bus"
    | "minibus"
    | "train"
    | "airplane"
    | "shared_cars"
    | "none";
  readonly allowPersonalCar?: boolean;
  readonly dongAmountToman?: string;
  readonly seatPreference?: string;
};

export async function clearOperatorWizardDraftIfPresent(page: Page): Promise<void> {
  const clearBtn = page.getByTestId("wizard-clear-draft");
  if (!(await clearBtn.isVisible().catch(() => false))) {
    return;
  }
  await clearBtn.click();
  const confirmBtn = page.getByTestId("wizard-clear-draft-confirm-confirm");
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
  const clearResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname.includes("/api/workspaces/") &&
      new URL(response.url()).pathname.includes("/drafts/"),
    { timeout: 30_000 }
  );
  await confirmBtn.click();
  const response = await clearResponse;
  // A stale client-side draft can outlive its server record after a previous
  // browser run. Treat the server's not-found response as already cleared;
  // the step assertion below still verifies that the wizard reset completed.
  expect(
    response.ok() || response.status() === 404,
    `wizard draft clear failed (${response.status()})`
  ).toBeTruthy();
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
  await calendar
    .getByRole("button", { name: isoDateFromToday(dateOffsetDays), exact: true })
    .click();

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
    if (
      await page
        .locator('[data-wizard-step="denali_basic"]')
        .isVisible()
        .catch(() => false)
    ) {
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
  destinationLabel?: string,
  capacityMax = 12,
  resetToBasic = true
): Promise<void> {
  const selectedDestination = await resolveDenaliWizardDestination(page, destinationLabel);
  if (resetToBasic) {
    await resetOperatorWizardToBasic(page);
  }
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

  const titleField = page.getByRole("textbox", { name: /نام تور|tour name|^title$/i });
  await expect(titleField).toBeVisible({ timeout: 30_000 });
  await titleField.fill(title);

  await settleOperatorWizardDraftSync(page);
  const destination = page.getByTestId(DENALI_COMPOSITE_TEST_IDS.destination);
  await expect(destination).toBeVisible();
  const searchableTrigger = destination.getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger);
  if (await searchableTrigger.isVisible().catch(() => false)) {
    await searchableTrigger.click();
    await destination
      .getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.search)
      .fill(selectedDestination.name);
    await destination
      .getByTestId(DENALI_SEARCHABLE_SELECT_TEST_IDS.option(selectedDestination.id))
      .click();
  } else {
    const destinationSelect = destination.getByRole("combobox");
    await expect(destinationSelect).toBeEnabled({ timeout: 60_000 });
    await destinationSelect.selectOption({ value: selectedDestination.id });
  }
  await settleOperatorWizardDraftSync(page);

  const peakMetricHost = page.locator(
    '[data-catalog-metric-path="tripDetails.overview.peakHeight"]'
  );
  await expect(peakMetricHost).toHaveAttribute("data-catalog-metric-locked", "true", {
    timeout: 15_000,
  });
  const peakHeight = page.getByRole("textbox", {
    name: /ارتفاع قله|peakHeight|Peak height/i,
  });
  await expect(peakHeight).toBeDisabled();
  await expect
    .poll(async () => toAsciiDigits(await peakHeight.inputValue()))
    .toBe(String(selectedDestination.altitudeM));

  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.start, 1, "08", "00");
  await settleOperatorWizardDraftSync(page);
  await fillDenaliDatetimeField(page, DENALI_DATETIME_TEST_IDS.end, 3, "18", "00");
  await settleOperatorWizardDraftSync(page);

  const capacity = page.getByRole("textbox", {
    name: /حداکثر ظرفیت|maximum capacity|capacity max|capacityMax/i,
  });
  await expect(capacity).toBeVisible({ timeout: 15_000 });
  await capacity.fill(String(capacityMax));
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

async function fillWizardNumericField(page: Page, label: RegExp, value: string): Promise<void> {
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
  await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible({
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
  await expect(page.locator('[data-wizard-step="denali_program"]')).toBeVisible({
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
    const dayCount = await itinerary
      .getByTestId(DENALI_ITINERARY_TEST_IDS.nav)
      .locator("button")
      .count();
    for (let index = 0; index < dayCount; index += 1) {
      const dayNumber = index + 1;
      await itinerary.getByTestId(DENALI_ITINERARY_TEST_IDS.dayNav(dayNumber)).click();
      const day = itinerary.getByTestId(DENALI_ITINERARY_TEST_IDS.day(dayNumber));
      await day.getByRole("textbox", { name: /عنوان روز|Day title/i }).fill(`روز ${dayNumber} تست`);
      await day
        .getByRole("textbox", { name: /^عنوان$|^Title$/i })
        .first()
        .fill(`فعالیت روز ${dayNumber}`);
    }
  }
  await clickWizardNextToStep(page, "denali_logistics");
}

async function fillDenaliWizardLogisticsMinimal(
  page: Page,
  options: DenaliWizardTransportE2EOptions = {}
): Promise<void> {
  const transport = page.getByTestId("denali-composite-transport");
  await expect(transport).toBeVisible({ timeout: 30_000 });
  await transport.getByRole("combobox").selectOption(options.mode ?? "none");
  if (options.allowPersonalCar !== undefined) {
    const personalCar = transport.getByRole("checkbox", {
      name: /اجازه استفاده از ماشین شخصی|allow personal car/i,
    });
    if (options.allowPersonalCar) {
      await personalCar.check();
    } else {
      await personalCar.uncheck();
    }
  }
  if (options.dongAmountToman !== undefined) {
    const dongAmount = transport.getByRole("textbox", {
      name: /مبلغ دنگ|carpool share amount/i,
    });
    await expect(dongAmount).toBeVisible({ timeout: 15_000 });
    await dongAmount.fill(options.dongAmountToman);
  }
  if (options.seatPreference !== undefined) {
    const seatPreference = transport.getByRole("textbox", {
      name: /ترجیح صندلی|seat preference/i,
    });
    await expect(seatPreference).toBeVisible({ timeout: 15_000 });
    await seatPreference.fill(options.seatPreference);
  }
  await clickWizardNextToStep(page, "denali_pricing");
}

async function fillDenaliWizardPricingMinimal(
  page: Page,
  options: DenaliWizardPricingE2EOptions = {}
): Promise<void> {
  if (
    (options.prepaymentEnabled !== undefined || options.prepaymentPercent !== undefined) &&
    options.paymentCollection !== "paid"
  ) {
    throw new Error("Prepayment options require paymentCollection: 'paid'.");
  }
  if (options.prepaymentPercent !== undefined && options.prepaymentEnabled !== true) {
    throw new Error("prepaymentPercent requires prepaymentEnabled: true.");
  }

  await fillWizardNumericField(page, /حداقل سن|minimumAge|Minimum age/i, "18");
  const fitness = page
    .getByTestId("denali-composite-pricing-participants")
    .getByRole("combobox", { name: /سطح آمادگی|Fitness level/i });
  if (await fitness.isVisible().catch(() => false)) {
    await fitness.selectOption("medium");
  }

  if (
    options.paymentCollection !== undefined ||
    options.registrationApproval !== undefined ||
    options.prepaymentEnabled !== undefined ||
    options.prepaymentPercent !== undefined
  ) {
    const payment = page.getByTestId("denali-composite-pricing-payment");
    await expect(payment).toBeVisible({ timeout: 30_000 });
    if (options.paymentCollection !== undefined) {
      const paidToggle = payment.getByRole("checkbox", { name: /تور پولی|Paid tour/i });
      if (options.paymentCollection === "paid") {
        await paidToggle.check();
        await fillWizardNumericField(
          page,
          /قیمت به ازای هر نفر|Price per person/i,
          options.basePriceToman ?? "500000"
        );
        if (options.prepaymentEnabled !== undefined) {
          const prepaymentToggle = payment.getByRole("checkbox", {
            name: /امکان ثبت‌نام با پیش‌پرداخت|Allow registration with prepayment/i,
          });
          if (options.prepaymentEnabled) {
            await prepaymentToggle.check();
            await fillWizardNumericField(
              page,
              /درصد پیش‌پرداخت از مبلغ کل|Prepayment percent of total amount/i,
              String(options.prepaymentPercent ?? 30)
            );
          } else {
            await prepaymentToggle.uncheck();
          }
        }
      } else {
        await paidToggle.uncheck();
      }
    }
    if (options.registrationApproval !== undefined) {
      await payment
        .getByRole("combobox", { name: /روش تأیید ثبت‌نام|Registration approval/i })
        .selectOption(options.registrationApproval);
    }
  }
  await settleOperatorWizardDraftSync(page);
  await clickWizardNextToStep(page, "denali_legal");
}

export async function fillDenaliMultiDayWizardThroughLegal(
  page: Page,
  title: string,
  destinationLabel: string | undefined = undefined,
  pricingOptions: DenaliWizardPricingE2EOptions = {},
  capacityMax = 12,
  resetToBasic = true,
  transportOptions: DenaliWizardTransportE2EOptions = {}
): Promise<void> {
  await fillDenaliMultiDayWizardBasics(page, title, destinationLabel, capacityMax, resetToBasic);
  await fillDenaliWizardPhotosMinimal(page);
  await fillDenaliWizardProgramMinimal(page);
  await fillDenaliWizardLogisticsMinimal(page, transportOptions);
  await fillDenaliWizardPricingMinimal(page, pricingOptions);
  await settleOperatorWizardDraftSync(page);
}

export async function fillDenaliMultiDayWizardThroughReview(
  page: Page,
  title: string,
  destinationLabel: string | undefined = undefined,
  pricingOptions: DenaliWizardPricingE2EOptions = {},
  capacityMax = 12,
  resetToBasic = true,
  transportOptions: DenaliWizardTransportE2EOptions = {}
): Promise<void> {
  await fillDenaliMultiDayWizardThroughLegal(
    page,
    title,
    destinationLabel,
    pricingOptions,
    capacityMax,
    resetToBasic,
    transportOptions
  );
  await clickWizardNextToStep(page, "review");
}

export async function submitDenaliWizardDraftCreate(page: Page, title: string): Promise<string> {
  const create = page
    .locator("[data-wizard-footer]")
    .getByRole("button", { name: /Create tour|ساخت تور/i });
  await expect(create).toBeEnabled({ timeout: 30_000 });
  await create.click();
  const listSearch = page.getByTestId("operator-tours-search");
  await expect(listSearch).toBeVisible({ timeout: 60_000 });
  await listSearch.fill(title);
  const createdTourRow = page.getByRole("row").filter({ hasText: title });
  const createdTourCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  const createdTourSurface = createdTourRow.or(createdTourCard).first();
  await expect(createdTourSurface).toBeVisible({ timeout: 60_000 });
  const editHref = await createdTourSurface
    .locator('a[href*="/tours/"][href$="/edit"]')
    .getAttribute("href");
  const createdTourId = editHref?.match(
    /\/tours\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/edit/i
  )?.[1];
  expect(createdTourId, `created tour edit link missing or invalid: ${editHref}`).toBeTruthy();
  return createdTourId!;
}
