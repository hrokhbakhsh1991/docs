/**
 * Operator tour wizard navigation — resilient against Fast Refresh / concurrent navigations.
 */
import { expect, type Page } from "@playwright/test";

import { OPERATOR_WELCOME_TEST_IDS } from "../../src/admin/onboarding/operator-welcome-types";
import { OPERATOR_NAV_TEST_IDS } from "../../src/admin/shell/operator-nav.types";

export async function dismissOperatorWelcomeIfPresent(page: Page): Promise<void> {
  const dialog = page.getByTestId(OPERATOR_WELCOME_TEST_IDS.dialog);
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByTestId(OPERATOR_WELCOME_TEST_IDS.dismissCta).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
}

export async function navigateOperatorToNewTour(page: Page): Promise<void> {
  const wizard = page.locator("[data-workspace-wizard]");
  if (await wizard.isVisible().catch(() => false)) {
    return;
  }

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await dismissOperatorWelcomeIfPresent(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 60_000 });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ERR_ABORTED") || attempt === 2) {
        const newTourCta = page.getByTestId(OPERATOR_NAV_TEST_IDS.newTourCta);
        if (await newTourCta.isVisible().catch(() => false)) {
          await newTourCta.click();
          break;
        }
        throw error;
      }
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
  }

  await expect(wizard).toBeVisible({ timeout: 90_000 });
}
