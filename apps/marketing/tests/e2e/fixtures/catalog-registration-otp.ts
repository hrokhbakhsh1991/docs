import { expect, type Locator, type Page } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

/**
 * Guest PDP buy path (Phase 6 / DL-49): click «ثبت‌نام», stay on `/tours/{id}`,
 * complete marketing OTP modal, reload as member, then continue to portal intake.
 */
export async function completeGuestPdpRegisterModalThenOpenPortalIntake(
  page: Page,
  input: {
    readonly phone: string;
    readonly fullName?: string;
    readonly email?: string;
  }
): Promise<void> {
  const fullName = input.fullName ?? "Marketing Smoke Guest";
  const email = input.email ?? `pdp-modal-${Date.now()}@smoke.local`;
  await expect(page.locator("[data-marketing-login-modal]")).toBeAttached();
  const registerLink = page
    .locator("[data-marketing-register][data-marketing-register-ready='true']")
    .first();
  await expect(registerLink).toBeVisible({ timeout: 60_000 });
  await registerLink.click();
  await expect(page).toHaveURL(/\/tours\/[^/?#]+/);
  await expect(page).not.toHaveURL(/\/catalog\//);
  await expect(page.locator("[data-marketing-login-unavailable]")).toHaveCount(0);
  await expect(
    page.locator(
      'dialog[open][data-marketing-login-modal-open="true"] [data-public-registration-phone][data-registration-ready]'
    )
  ).toBeVisible({ timeout: 15_000 });

  await submitCatalogPhoneForOtp(page, input.phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  const profileOrMember = page.locator(
    "[data-public-registration-profile], [data-marketing-member-authenticated]"
  );
  await expect(profileOrMember.first()).toBeVisible({ timeout: 60_000 });

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible()) {
    await page.locator("#displayName").fill(fullName);
    const emailInput = page.locator("#profileEmail");
    if (await emailInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await emailInput.fill(email);
    }
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      page.locator('[data-action="profile-continue"]').click(),
    ]);
  }

  await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('[data-marketing-login-modal-open="true"]')).toHaveCount(0);

  const continueLink = page.locator("[data-marketing-register]").first();
  await expect(continueLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/catalog\/[^/]+\/register/, { timeout: 60_000 }),
    continueLink.click(),
  ]);
}

/** Portal registration phone step — wait for client hydration before interacting. */
export async function fillCatalogPhone(page: Page, phone: string): Promise<void> {
  const phoneStep = page.locator(
    "[data-public-registration-phone][data-registration-ready]"
  );
  await phoneStep.waitFor({ state: "visible", timeout: 60_000 });
  const input = phoneStep.locator("#phone");
  await input.click();
  await input.fill("");
  await input.pressSequentially(phone, { delay: 15 });
  await expect(input).not.toHaveValue("");
}

export async function submitCatalogPhoneForOtp(page: Page, phone: string): Promise<void> {
  await fillCatalogPhone(page, phone);
  const sendCode = page.locator('[data-action="send-code"]');
  await expect(sendCode).toBeEnabled({ timeout: 15_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/public-auth/request-otp"),
      { timeout: 90_000 }
    ),
    sendCode.click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `request-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
  await expect(page.locator("[data-public-registration-otp]")).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * OtpSegmentInput auto-submits via onComplete — do not click verify (button stays
 * disabled as "Verifying…" and Playwright will hang on click).
 * Fill cells one-by-one: keyboard.type races requestAnimationFrame focus moves.
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

/** Reliable phone entry for portal LocalizedNumericInput (fa locale). */
export async function fillRegistrationPhone(page: Page, phone: string): Promise<void> {
  const input = page.locator("[data-public-registration-phone] input").first();
  await input.click();
  await input.fill("");
  await input.pressSequentially(phone, { delay: 15 });
  await expect(input).not.toHaveValue("");
}

/** Send OTP and assert portal BFF request-otp succeeds before UI advances. */
export async function requestRegistrationOtp(page: Page, phone: string): Promise<void> {
  await fillRegistrationPhone(page, phone);
  const sendCode = page.locator('[data-action="send-code"]');
  await expect(sendCode).toBeEnabled({ timeout: 15_000 });

  const otpResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/public-auth/request-otp") &&
      response.request().method() === "POST",
    { timeout: 90_000 }
  );
  await sendCode.click();
  const response = await otpResponse;
  const body = await response.text();
  expect(
    response.ok(),
    `request-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}

async function fillIntakeFieldInRootIfVisible(
  root: Locator,
  fieldId: string,
  value: string
): Promise<void> {
  const inputEl = root
    .locator(
      `input[data-intake-field="${fieldId}"], textarea[data-intake-field="${fieldId}"], [data-intake-field="${fieldId}"] input`
    )
    .first();
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

/**
 * Complete portal intake after OTP. Aligned with apps/portal fixture:
 * Denali self + transport radios (`hasPersonalCar-self`), then wait for success
 * (not only POST — native constraint validation can swallow submit with no fetch).
 */
export async function completeCatalogRegistrationIntake(
  page: Page,
  input: {
    readonly email: string;
    readonly fullName: string;
    readonly partySize?: string;
    readonly nationalId?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
    readonly phone?: string;
    readonly registrantTarget?: "self" | "other";
    readonly expectSuccess?: boolean;
  }
): Promise<void> {
  // Chromium 3PCD partitions CORS Set-Cookie to the marketing site. Portal
  // register is a new top-level site and may show OTP again (first-party set).
  const portalAuthGate = page.locator(
    "dialog[open] [data-public-registration-phone][data-registration-ready], [data-public-registration-profile], [data-public-registration-intake][data-registration-ready]"
  );
  await portalAuthGate.first().waitFor({ state: "visible", timeout: 120_000 });

  for (let otpPass = 0; otpPass < 2; otpPass++) {
    const portalOtpPhone = page.locator(
      "dialog[open] [data-public-registration-phone][data-registration-ready]"
    );
    if (!input.phone || !(await portalOtpPhone.isVisible().catch(() => false))) {
      break;
    }
    await submitCatalogPhoneForOtp(page, input.phone);
    await fillCatalogOtp(page, CATALOG_DEV_OTP);
    await portalAuthGate.first().waitFor({ state: "visible", timeout: 120_000 });
  }

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(input.fullName);
    const emailInput = page.locator("#profileEmail, #email").first();
    if (await emailInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await emailInput.fill(input.email);
    }
    await page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true });
  }

  await page.locator("[data-public-registration-intake][data-registration-ready]").waitFor({
    state: "visible",
    timeout: 120_000,
  });

  const registrantTarget = input.registrantTarget ?? "self";
  const intakeRoot = page.locator("[data-public-registration-intake]");

  if (registrantTarget === "other") {
    const selfCheckbox = page.locator("[data-denali-registrant-self-toggle] input");
    if (await selfCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const selfCard = page.locator("[data-denali-self-guest-card]");
      for (let attempt = 0; attempt < 3; attempt++) {
        const checked = await selfCheckbox.isChecked().catch(() => false);
        const selfVisible = (await selfCard.count()) > 0;
        if (!checked && !selfVisible) break;
        if (await selfCheckbox.isEnabled()) {
          await selfCheckbox.click({ force: true });
        }
        try {
          await expect(selfCard).toHaveCount(0, { timeout: 5_000 });
          break;
        } catch {
          // retry
        }
      }
    }

    const guestCards = page.locator("[data-denali-other-guest-card]");
    const addGuestButton = page.locator("[data-denali-add-guest]");
    if ((await guestCards.count()) === 0 && (await addGuestButton.count()) > 0) {
      await addGuestButton.first().click();
    }
    if ((await guestCards.count()) > 0) {
      const card = guestCards.first();
      await fillIntakeFieldInRootIfVisible(card, "fullName", input.fullName);
      if (input.phone) {
        await fillIntakeFieldInRootIfVisible(card, "phone", input.phone);
      }
      await fillIntakeFieldInRootIfVisible(card, "email", input.email);
      await fillIntakeFieldInRootIfVisible(
        card,
        "nationalId",
        input.nationalId ?? "1234567890"
      );
      await fillIntakeFieldInRootIfVisible(
        card,
        "fatherName",
        input.fatherName ?? "Smoke Father"
      );
      await fillIntakeFieldInRootIfVisible(
        card,
        "birthDate",
        input.birthDate ?? "1990-01-15"
      );
      await fillIntakeFieldInRootIfVisible(card, "partySize", input.partySize ?? "2");
      await selectNoPersonalCarAndPayDong(card);
    }
  } else {
    // Ensure Denali "for myself" stays selected when the toggle is present.
    const selfCheckbox = page.locator("[data-denali-registrant-self-toggle] input");
    if (await selfCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
      if (!(await selfCheckbox.isChecked())) {
        await selfCheckbox.click({ force: true });
      }
      await expect(page.locator("[data-denali-self-guest-card]")).toBeVisible({
        timeout: 15_000,
      });
    }

    await fillIntakeFieldInRootIfVisible(intakeRoot, "fullName", input.fullName);
    if (input.phone) {
      await fillIntakeFieldInRootIfVisible(intakeRoot, "phone", input.phone);
    }
    await fillIntakeFieldInRootIfVisible(intakeRoot, "email", input.email);
    await fillIntakeFieldInRootIfVisible(
      intakeRoot,
      "nationalId",
      input.nationalId ?? "1234567890"
    );
    await fillIntakeFieldInRootIfVisible(
      intakeRoot,
      "fatherName",
      input.fatherName ?? "Smoke Father"
    );
    await fillIntakeFieldInRootIfVisible(
      intakeRoot,
      "birthDate",
      input.birthDate ?? "1990-01-15"
    );
    await fillIntakeFieldInRootIfVisible(
      intakeRoot,
      "partySize",
      input.partySize ?? "2"
    );

    const partySizeInput = page.getByLabel(/Party size|تعداد نفرات/);
    if (await partySizeInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await partySizeInput.fill(input.partySize ?? "2");
    }

    await selectNoPersonalCarAndPayDong(intakeRoot);
  }

  const expectSuccess = input.expectSuccess ?? true;
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

  if (expectSuccess) {
    await page.waitForSelector("[data-public-registration-success]", { timeout: 90_000 });
  }
}
