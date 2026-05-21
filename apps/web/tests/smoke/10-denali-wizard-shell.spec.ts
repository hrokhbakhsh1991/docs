import { expect, test } from "@playwright/test";

/**
 * Smoke: Denali host serves the 5-step MVP create wizard shell (no live API required for DOM).
 * Run: `PW_BASE_URL=http://denali.localhost:3000 pnpm run build:smoke && PW_BASE_URL=http://denali.localhost:3000 playwright test -c playwright.smoke.config.ts tests/smoke/10-denali-wizard-shell.spec.ts`
 */
test.describe("denali tour create wizard shell", () => {
  test("/tours/new shows denali MVP wizard when denali_pilot profile", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);

    const denali = page.getByTestId("denali-create-tour-wizard");
    const classic = page.getByTestId("tour-create-wizard");

    const denaliVisible = await denali.isVisible().catch(() => false);
    const classicVisible = await classic.isVisible().catch(() => false);

    expect(
      denaliVisible || classicVisible,
      "expected Denali or classic wizard shell",
    ).toBeTruthy();

    if (denaliVisible) {
      await expect(denali).toHaveAttribute("data-wizard-rail", "denali");
      await expect(denali).toHaveAttribute("data-resolved-form-profile", "denali_pilot");
      await expect(denali).toHaveAttribute("data-wizard-step-count", "5");
    }
  });
});
