import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

export async function gotoPortalRegistration(page: Page, tourId: string): Promise<void> {
  await page.goto(`/catalog/${tourId}/register`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
    timeout: 120_000,
  });
}

export async function fillCatalogOtp(page: Page, code: string): Promise<void> {
  const otpStep = page.locator("[data-public-registration-otp]");
  await otpStep.waitFor({ state: "visible", timeout: 60_000 });
  const input = otpStep.locator("#otp");
  await input.click();
  await input.fill("");
  await input.pressSequentially(code.replace(/\D/g, ""), { delay: 15 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/public-auth/verify-otp"),
      { timeout: 90_000 }
    ),
    page.locator('[data-action="verify-otp"]').click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `verify-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}

/** Reliable phone entry for portal LocalizedNumericInput (fa locale). */
export async function fillRegistrationPhone(page: Page, phone: string): Promise<void> {
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

/** Send OTP and assert portal BFF request-otp succeeds before UI advances. */
export async function requestRegistrationOtp(page: Page, phone: string): Promise<void> {
  await fillRegistrationPhone(page, phone);
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

export async function completeCatalogRegistrationIntake(
  page: Page,
  input: {
    readonly fullName: string;
    readonly partySize?: string;
    readonly nationalId?: string;
    /**
     * Required for `registrantTarget="other"` (Denali validates MOBILE_REQUIRED/INVALID).
     * Usually you reuse the OTP phone.
     */
    readonly phone?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
    readonly registrantTarget?: "self" | "other";
    /**
     * For `registrantTarget="other"`: how many other-guest cards should exist before submit.
     * Defaults to `1`.
     */
    readonly guestCount?: number;
    /**
     * Optional UX test hook for `registrantTarget="other"`.
     * If set, we will add up to `guestCount` then remove down to this number before filling fields.
     * Defaults to `undefined` (no remove).
     */
    readonly removeGuestsTo?: number;

    /**
     * Default `true`.
     * - `true`: expect UI to transition to success screen.
     * - `false`: expect partial failure UI (`data-denali-submit-results`) instead.
     */
    readonly expectSuccess?: boolean;
  }
): Promise<void> {
  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(input.fullName);
    await page.locator('[data-action="profile-continue"]').click();
  }

  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 120_000,
  });

  const registrantTarget = input.registrantTarget ?? "self";

  const fillIntakeFieldInRootIfVisible = async (
    root: Locator,
    fieldId: string,
    value: string
  ): Promise<void> => {
    const inputEl = root.locator(`[data-intake-field="${fieldId}"]`).first();
    if (await inputEl.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await inputEl.fill(value);
    }
  };

  const selectNoPersonalCarAndPayDong = async (
    cardRoot: Locator
  ): Promise<void> => {
    // Prefer radios inside `[data-public-registration-transport]` when the opt-in
    // already revealed the follow-up fieldset; otherwise fall back to name prefix.
    const transportRoot = cardRoot.locator("[data-public-registration-transport]");
    const scope = (await transportRoot.count()) > 0 ? transportRoot : cardRoot;
    const hasPersonalCarRadios = scope.locator(
      'input[type="radio"][name^="hasPersonalCar-"]'
    );
    if ((await hasPersonalCarRadios.count()) > 0) {
      // Convention: we render "has car" then "no car"; pick the second.
      await hasPersonalCarRadios.nth(1).click();
    }

    const paysDongRadios = cardRoot.locator('input[type="radio"][name^="paysDong-"]');
    if ((await paysDongRadios.count()) > 0) {
      // Convention: first option is "pay dong: yes".
      await paysDongRadios.first().click();
    }
  };

  if (registrantTarget === "other") {
    // Prefer role-based toggle so React controlled checkbox receives a real click.
    const selfCheckbox = page.getByRole("checkbox", {
      name: /برای خودم|For myself/i,
    });
    await selfCheckbox.waitFor({ state: "visible", timeout: 30_000 });

    const selfCard = page.locator("[data-denali-self-guest-card]");
    // Retry toggle: Next cold-compile / controlled-input drift can swallow a single click.
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
    await expect(selfCard).toHaveCount(0, { timeout: 15_000 });

    const guestCards = page.locator("[data-denali-other-guest-card]");
    const addGuestButton = page.getByRole("button", {
      name: /افزودن مهمان|Add guest/i,
    });
    const removeGuestButton = page.getByRole("button", {
      name: /حذف مهمان|Remove guest/i,
    });

    // Auto-seed may already create the first card; otherwise click Add once.
    if ((await guestCards.count()) === 0) {
      await addGuestButton.first().click();
    }
    await expect(guestCards.first()).toBeVisible({ timeout: 30_000 });

    const desiredGuestCount = input.guestCount ?? 1;
    const removeGuestsTo = input.removeGuestsTo;

    {
      const startingCount = await guestCards.count();
      const maxAdditional = Math.max(0, desiredGuestCount - startingCount);
      for (let i = 0; i < maxAdditional; i++) {
        await addGuestButton.last().click();
        await expect(guestCards).toHaveCount(startingCount + i + 1, { timeout: 30_000 });
      }
    }

    if (typeof removeGuestsTo === "number" && removeGuestsTo >= 1) {
      const startingCount = await guestCards.count();
      const maxRemovals = Math.max(0, startingCount - removeGuestsTo);
      for (let i = 0; i < maxRemovals; i++) {
        await removeGuestButton.last().click();
        await expect(guestCards).toHaveCount(startingCount - i - 1, { timeout: 30_000 });
      }
      await expect(guestCards).toHaveCount(removeGuestsTo, { timeout: 30_000 });
    }

    const remainingCount = await guestCards.count();
    for (let i = 0; i < remainingCount; i++) {
      const card = guestCards.nth(i);
      await fillIntakeFieldInRootIfVisible(card, "fullName", input.fullName);
      if (input.phone) {
        await fillIntakeFieldInRootIfVisible(card, "phone", input.phone);
      }
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
      await fillIntakeFieldInRootIfVisible(card, "birthDate", input.birthDate ?? "1990-01-15");
      await fillIntakeFieldInRootIfVisible(card, "partySize", input.partySize ?? "2");

      await selectNoPersonalCarAndPayDong(card);
    }
  } else {
    // Self flow: there should be at most one intake card; filling at page scope is fine.
    await fillIntakeFieldInRootIfVisible(page, "fullName", input.fullName);
    if (input.phone) {
      await fillIntakeFieldInRootIfVisible(page, "phone", input.phone);
    }
    await fillIntakeFieldInRootIfVisible(
      page,
      "nationalId",
      input.nationalId ?? "1234567890"
    );
    await fillIntakeFieldInRootIfVisible(
      page,
      "fatherName",
      input.fatherName ?? "Smoke Father"
    );
    await fillIntakeFieldInRootIfVisible(page, "birthDate", input.birthDate ?? "1990-01-15");
    await fillIntakeFieldInRootIfVisible(page, "partySize", input.partySize ?? "2");

    const intakeRoot = page.locator("[data-public-registration-intake]");
    await selectNoPersonalCarAndPayDong(intakeRoot);
  }

  const expectSuccess = input.expectSuccess ?? true;

  await page.locator('[data-action="intake-submit"]').click();

  if (expectSuccess) {
    await page.waitForSelector("[data-public-registration-success]", { timeout: 90_000 });
  } else {
    // Partial failure renders per-card errors.
    await page.waitForSelector("[data-denali-submit-results]", { timeout: 90_000 });
  }
}
