import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { pickIntakeBirthDate } from "./intake-birth-date-picker";

export const CATALOG_DEV_OTP = "1234";

/** Next dev HMR can invalidate response bodies before .text() — status is enough for smoke. */
function assertAuthBffOk(response: { ok(): boolean; status(): number }, label: string): void {
  expect(response.ok(), `${label} failed (${response.status()})`).toBeTruthy();
}

export async function gotoPortalRegistration(page: Page, tourId: string): Promise<void> {
  await page.goto(`/catalog/${tourId}/register`, { waitUntil: "domcontentloaded" });
  // Guest path: OTP phone inside dialog[open] (PCMS-UX-MODAL-04). Resume: intake.
  // Do not toBeVisible on the <dialog> itself — Preflight 0×0 box until L2 flex frame.
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
  const phone = page.locator("[data-public-registration-phone][data-registration-ready]");
  if (await phone.isVisible().catch(() => false)) {
    return;
  }
}

export async function fillCatalogOtp(page: Page, code: string): Promise<void> {
  const otpStep = page.locator("[data-public-registration-otp]");
  await otpStep.waitFor({ state: "visible", timeout: 60_000 });
  const digits = code.replace(/\D/g, "");
  // Wait before typing — OtpSegmentInput auto-submits onComplete; cell-by-cell
  // fill avoids rAF focus races from keyboard.type across maxLength=1 inputs.
  const responsePromise = page.waitForResponse(
    (res) => res.request().method() === "POST" && res.url().includes("/api/public-auth/verify-otp"),
    { timeout: 90_000 }
  );
  for (let i = 0; i < digits.length; i++) {
    const cell = otpStep.locator(`[data-otp-cell="${i}"]`);
    await cell.click();
    await cell.fill(digits[i]!);
  }
  const response = await responsePromise;
  assertAuthBffOk(response, "verify-otp");
}

/** Reliable phone entry for portal LocalizedNumericInput (fa locale). */
export async function fillRegistrationPhone(page: Page, phone: string): Promise<void> {
  const phoneStep = page.locator("[data-public-registration-phone][data-registration-ready]");
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
        res.request().method() === "POST" && res.url().includes("/api/public-auth/request-otp"),
      { timeout: 90_000 }
    ),
    sendCode.click(),
  ]);
  assertAuthBffOk(response, "request-otp");
  await expect(page.locator("[data-public-registration-otp]")).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * Guest PDP buy path (Phase 6 / DL-49): marketing «ثبت‌نام» opens OTP modal,
 * reload as member, then continue CTA lands portal `/catalog/{id}/register`.
 */
export async function completeGuestPdpRegisterModalThenOpenPortalIntake(
  page: Page,
  input: {
    readonly phone: string;
    readonly fullName?: string;
    readonly email?: string;
  }
): Promise<void> {
  const fullName = input.fullName ?? "Denali Probe Guest";
  const email = input.email ?? `pdp-modal-${Date.now()}@smoke.local`;
  await expect(page.locator("[data-marketing-login-modal]")).toBeAttached();
  const registerLink = page
    .locator("[data-marketing-register][data-marketing-register-ready='true']")
    .first();
  await expect(registerLink).toBeVisible();
  await registerLink.click();
  await expect(page).toHaveURL(/\/tours\/[^/?#]+/);
  await expect(page).not.toHaveURL(/\/catalog\//);
  await expect(
    page.locator(
      'dialog[open][data-marketing-login-modal-open="true"] [data-public-registration-phone][data-registration-ready]'
    )
  ).toBeVisible({ timeout: 15_000 });

  await requestRegistrationOtp(page, input.phone);
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
    await page.locator('[data-action="profile-continue"]').click();
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
    await page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true });
  }

  await page.locator("[data-public-registration-intake][data-registration-ready]").waitFor({
    state: "visible",
    timeout: 120_000,
  });

  const registrantTarget = input.registrantTarget ?? "self";

  const fillIntakeFieldInRootIfVisible = async (
    root: Locator,
    fieldId: string,
    value: string
  ): Promise<void> => {
    if (fieldId === "birthDate") {
      const picker = root.locator('[data-intake-field="birthDate"]').first();
      if (await picker.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await pickIntakeBirthDate(page, root, value);
        return;
      }
    }
    const inputEl = root
      .locator(
        `input[data-intake-field="${fieldId}"], textarea[data-intake-field="${fieldId}"], [data-intake-field="${fieldId}"] input`
      )
      .first();
    if (await inputEl.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await inputEl.fill(value);
    }
  };

  const selectNoPersonalCarAndPayDong = async (cardRoot: Locator): Promise<void> => {
    // Prefer radios inside `[data-public-registration-transport]` when the opt-in
    // already revealed the follow-up fieldset; otherwise fall back to name prefix.
    const transportRoot = cardRoot.locator("[data-public-registration-transport]");
    const scope = (await transportRoot.count()) > 0 ? transportRoot : cardRoot;
    const hasPersonalCarRadios = scope.locator('input[type="radio"][name^="hasPersonalCar-"]');
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
    const selfCheckbox = page.locator("[data-denali-registrant-self-toggle] input");
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
    const addGuestButton = page.locator("[data-denali-add-guest]");
    const removeGuestButton = page.locator("[data-denali-remove-guest]");

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
      await fillIntakeFieldInRootIfVisible(card, "nationalId", input.nationalId ?? "0012345679");
      await fillIntakeFieldInRootIfVisible(card, "fatherName", input.fatherName ?? "Smoke Father");
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
    await fillIntakeFieldInRootIfVisible(page, "nationalId", input.nationalId ?? "0012345679");
    await fillIntakeFieldInRootIfVisible(page, "fatherName", input.fatherName ?? "Smoke Father");
    await fillIntakeFieldInRootIfVisible(page, "birthDate", input.birthDate ?? "1990-01-15");
    await fillIntakeFieldInRootIfVisible(page, "partySize", input.partySize ?? "2");

    const intakeRoot = page.locator("[data-public-registration-intake]");
    await selectNoPersonalCarAndPayDong(intakeRoot);
  }

  const expectSuccess = input.expectSuccess ?? true;

  await page.locator('[data-action="intake-submit"]').click({ noWaitAfter: true });

  if (expectSuccess) {
    await page.waitForSelector("[data-public-registration-success]", { timeout: 90_000 });
  } else {
    // Partial failure renders per-card errors.
    await page.waitForSelector("[data-denali-submit-results]", { timeout: 90_000 });
  }
}
