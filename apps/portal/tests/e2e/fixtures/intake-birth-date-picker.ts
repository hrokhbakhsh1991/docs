import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

type JalaliPickTarget = {
  readonly yearLabel: string;
  readonly monthLabel: string;
};

const JALALI_PICK_TARGETS: Record<string, JalaliPickTarget> = {
  "1990-01-15": { yearLabel: "۱۳۶۸", monthLabel: "دی" },
  "1990-05-20": { yearLabel: "۱۳۶۹", monthLabel: "اردیبهشت" },
  "1992-03-20": { yearLabel: "۱۳۷۱", monthLabel: "اسفند" },
};

async function navigateToJalaliMonth(
  popover: Locator,
  calendar: Locator,
  target: JalaliPickTarget
): Promise<void> {
  await calendar.locator('button[aria-label="انتخاب سال"]').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(calendar).toHaveAttribute("data-operator-wizard-calendar-view", "years", {
    timeout: 10_000,
  });

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const yearBtn = popover.getByRole("button", { name: target.yearLabel, exact: true });
    if (await yearBtn.isVisible().catch(() => false)) {
      break;
    }
    await calendar.locator('[aria-label="سال‌های قبل"]').evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
  }
  await popover.getByRole("button", { name: target.yearLabel, exact: true }).click({ force: true });
  await expect(calendar).toHaveAttribute("data-operator-wizard-calendar-view", "months");
  await popover
    .getByRole("button", { name: target.monthLabel, exact: true })
    .click({ force: true });
  await expect(calendar).toHaveAttribute("data-operator-wizard-calendar-view", "days");
}

export async function pickIntakeBirthDate(
  page: Page,
  root: Locator,
  isoDate: string
): Promise<void> {
  const picker = root.locator('[data-intake-field="birthDate"]').first();
  await expect(picker).toHaveAttribute("data-operator-date-picker", "true");
  await picker.click();

  const popover = page.locator("[data-operator-wizard-calendar-popover]");
  await expect(popover).toBeVisible();
  const calendar = popover.locator("[data-operator-wizard-calendar]");
  await expect(calendar).toBeVisible();

  const day = popover.locator(`button[aria-label="${isoDate}"]`).first();
  if (!(await day.isVisible({ timeout: 2_000 }).catch(() => false))) {
    const target = JALALI_PICK_TARGETS[isoDate];
    if (target === undefined) {
      throw new Error(`No Jalali navigation target configured for ${isoDate}`);
    }
    await navigateToJalaliMonth(popover, calendar, target);
  }

  await day.waitFor({ state: "visible", timeout: 15_000 });
  await day.click({ force: true });
  await expect(picker).toContainText(/۱۳۶[۰-۹]|136[0-9]/);
}
