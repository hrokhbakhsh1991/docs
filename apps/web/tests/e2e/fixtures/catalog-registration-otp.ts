import { expect, type Locator, type Page } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

/**
 * OtpSegmentInput auto-submits via onComplete — do not click verify.
 * Fill cells one-by-one to avoid rAF focus races with keyboard.type.
 */
export async function fillCatalogOtp(page: Page, code: string): Promise<void> {
  const otpStep = page.locator("[data-public-registration-otp]");
  await otpStep.waitFor({ state: "visible", timeout: 60_000 });
  const digits = code.replace(/\D/g, "");

  const responsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" &&
      res.url().includes("/api/public-auth/verify-otp"),
    { timeout: 90_000 }
  );

  const firstCell = otpStep.locator('[data-otp-cell="0"]');
  if ((await firstCell.count()) > 0) {
    for (let i = 0; i < digits.length; i++) {
      const cell = otpStep.locator(`[data-otp-cell="${i}"]`);
      await cell.click();
      await cell.fill(digits[i]!);
    }
  } else {
    const input = otpStep.locator("#otp");
    await input.click({ force: true });
    await input.fill("");
    await input.pressSequentially(digits, { delay: 15 });
  }

  const response = await responsePromise;
  const body = await response.text();
  expect(
    response.ok(),
    `verify-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}

async function fillIntakeFieldInRootIfVisible(
  root: Locator,
  fieldId: string,
  value: string
): Promise<void> {
  const inputEl = root.locator(`[data-intake-field="${fieldId}"]`).first();
  await expect(inputEl).toBeVisible({ timeout: 30_000 });
  await inputEl.fill(value);
  await expect(inputEl).toHaveValue(value, { timeout: 5_000 });
}

async function fillIntakeFieldIfPresent(
  root: Locator,
  fieldId: string,
  value: string
): Promise<void> {
  const inputEl = root.locator(`[data-intake-field="${fieldId}"]`).first();
  if (await inputEl.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await inputEl.fill(value);
  }
}

async function selectNoPersonalCarAndPayDong(cardRoot: Locator): Promise<void> {
  const transportRoot = cardRoot.locator("[data-public-registration-transport]");
  const scope = (await transportRoot.count()) > 0 ? transportRoot : cardRoot;
  const hasPersonalCarRadios = scope.locator(
    'input[type="radio"][name^="hasPersonalCar-"]'
  );
  if ((await hasPersonalCarRadios.count()) > 0) {
    await hasPersonalCarRadios.nth(1).click();
  }
  const paysDongRadios = cardRoot.locator('input[type="radio"][name^="paysDong-"]');
  if ((await paysDongRadios.count()) > 0) {
    await paysDongRadios.first().click();
  }
}

export async function completeCatalogRegistrationIntake(
  page: Page,
  input: { readonly email: string; readonly fullName: string; readonly partySize?: string }
): Promise<void> {
  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(input.fullName);
    const emailInput = page.locator("#profileEmail, #email").first();
    if (await emailInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await emailInput.fill(input.email);
    }
    await page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true });
  }

  const intakeRoot = page.locator("[data-public-registration-intake]");
  await intakeRoot.waitFor({ state: "visible", timeout: 120_000 });

  // Urban requires these three; Denali may hide some when session already has them.
  await fillIntakeFieldIfPresent(intakeRoot, "fullName", input.fullName);
  await fillIntakeFieldIfPresent(intakeRoot, "email", input.email);
  await fillIntakeFieldIfPresent(intakeRoot, "partySize", input.partySize ?? "2");
  await fillIntakeFieldIfPresent(intakeRoot, "nationalId", "1234567890");
  await fillIntakeFieldIfPresent(intakeRoot, "fatherName", "Smoke Father");
  await fillIntakeFieldIfPresent(intakeRoot, "birthDate", "1990-01-15");

  // Urban schema always exposes partySize — assert when present so native
  // constraint validation cannot swallow submit with an empty required field.
  const partySize = intakeRoot.locator('[data-intake-field="partySize"]').first();
  if ((await partySize.count()) > 0) {
    await fillIntakeFieldInRootIfVisible(intakeRoot, "partySize", input.partySize ?? "2");
  }
  const email = intakeRoot.locator('[data-intake-field="email"]').first();
  if ((await email.count()) > 0) {
    await fillIntakeFieldInRootIfVisible(intakeRoot, "email", input.email);
  }
  const fullName = intakeRoot.locator('[data-intake-field="fullName"]').first();
  if ((await fullName.count()) > 0) {
    await fillIntakeFieldInRootIfVisible(intakeRoot, "fullName", input.fullName);
  }

  const partySizeInput = page.getByLabel(/Party size|تعداد نفرات/);
  if (await partySizeInput.isVisible({ timeout: 500 }).catch(() => false)) {
    await partySizeInput.fill(input.partySize ?? "2");
  }

  const selfCheckbox = page.getByRole("checkbox", {
    name: /برای خودم|For myself/i,
  });
  if (await selfCheckbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
    if (!(await selfCheckbox.isChecked())) {
      await selfCheckbox.click({ force: true });
    }
  }

  await selectNoPersonalCarAndPayDong(intakeRoot);

  const submit = page.locator('[data-action="intake-submit"]');
  await expect(submit).toBeEnabled({ timeout: 15_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/catalog/registrations"),
      { timeout: 90_000 }
    ),
    submit.click({ noWaitAfter: true }),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `catalog registration failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();

  await page.waitForSelector("[data-public-registration-success]", { timeout: 90_000 });
}
