import { expect, test, type Page } from "@playwright/test";

import { resolveTestPlatformBaseUrl } from "@/lib/test/smoke-platform-url";

import {
  advanceDenaliWizardToStep,
  applyDenaliWizardIntegrationPatch,
  denaliWizardNextButton,
  fillDenaliMountainBasicsForNavigation,
  fillDenaliTitle,
  installDenaliVerificationMatrixSetup,
  requireDenaliWizard,
  waitForDenaliWizardAuthHydrated,
} from "../../src/features/tours/__tests__/smoke/tour-wizard-smoke-helpers";

async function tabToNextAndSubmit(page: Page): Promise<void> {
  const next = denaliWizardNextButton(page);
  for (let i = 0; i < 30; i += 1) {
    const focused = await next.evaluate((el: HTMLElement) => el === document.activeElement).catch(() => false);
    if (focused) break;
    await page.keyboard.press("Tab");
  }
  await expect(next).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press("Enter");
}

async function expectActiveElementMatches(page: Page, selectors: readonly string[]): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate((candidateSelectors) => {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) {
            return false;
          }
          return candidateSelectors.some((selector) => active.matches(selector));
        }, selectors),
      { timeout: 10_000 },
    )
    .toBe(true);
}

test.describe("denali ux integrity", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? resolveTestPlatformBaseUrl();
    await installDenaliVerificationMatrixSetup(page, context, { baseURL });
    await page.goto("/tours/new", { waitUntil: "networkidle" });
    await waitForDenaliWizardAuthHydrated(page);

    const available = await requireDenaliWizard(page)
      .then(() => true)
      .catch(() => false);
    if (!available) {
      test.skip(true, "Denali wizard is unavailable for this host/context.");
    }
  });

  test("keyboard-only navigation keeps focus on first field per step", async ({ page }) => {
    await fillDenaliTitle(page, "Denali UX Keyboard");
    await fillDenaliMountainBasicsForNavigation(page);

    await tabToNextAndSubmit(page);
    await expect(page.getByTestId("denali-step-photos")).toBeVisible({ timeout: 15_000 });
    await expectActiveElementMatches(page, ['[data-field-path="programNature.shortDescription"]']);

    await tabToNextAndSubmit(page);
    await expect(page.getByTestId("denali-step-program")).toBeVisible({ timeout: 15_000 });
    await expectActiveElementMatches(page, ['[data-testid="denali-program-difficulty-slider"]']);

    await tabToNextAndSubmit(page);
    await expect(page.getByTestId("denali-step-logistics")).toBeVisible({ timeout: 15_000 });
    await expectActiveElementMatches(page, [
      '[data-field-path="transport.transportMode"]',
      '[data-testid="denali-transport-mode"]',
    ]);

    await tabToNextAndSubmit(page);
    await expect(page.getByTestId("denali-step-pricing")).toBeVisible({ timeout: 15_000 });
    await expectActiveElementMatches(page, [
      '[data-testid="denali-pricing-requires-payment"] input',
      '[data-testid="denali-pricing-base-price"]',
      '[data-testid="denali-pricing-requires-payment"]',
    ]);
  });

  test("review summary navigates to step 2 invalid field and highlights it", async ({ page }) => {
    await applyDenaliWizardIntegrationPatch(page);
    await advanceDenaliWizardToStep(page, "denali-step-review");
    await expect(page.getByTestId("denali-step-review")).toBeVisible({ timeout: 20_000 });

    await applyDenaliWizardIntegrationPatch(page, {
      programNature: { shortDescription: "" },
    } as Parameters<typeof applyDenaliWizardIntegrationPatch>[1]);

    const summary = page.getByTestId("denali-summary-error");
    await expect(summary).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("denali-validation-step-denali_photos")).toBeVisible();

    const link = page.getByTestId("denali-validation-field-link-programNature-shortDescription");
    await expect(link).toBeVisible();
    await link.click();

    await expect(page.getByTestId("denali-step-photos")).toBeVisible({ timeout: 15_000 });

    const field = page.locator('[data-field-path="programNature.shortDescription"]');
    await expect(field).toBeVisible({ timeout: 10_000 });
    await expect(field).toBeFocused({ timeout: 10_000 });

    await expect
      .poll(
        () =>
          field.evaluate((el) => {
            const fieldShell = el.closest('[class*="field"]');
            return fieldShell?.getAttribute("data-denali-focus") === "true";
          }),
        { timeout: 10_000 },
      )
      .toBe(true);
  });
});
