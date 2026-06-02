import { expect, test } from "@playwright/test";

/**
 * Smoke: Denali pricing step owns participant fields; review shows read-only summary.
 */
test.describe("denali pricing participant section", () => {
  test("pricing step shows participant fields for default mountain_day wizard", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);

    const denali = page.getByTestId("workspace-tour-wizard");
    if (!(await denali.isVisible().catch(() => false))) {
      test.skip(true, "Denali wizard not available on this host");
    }

    const next = page.getByRole("button", { name: /بعدی|next/i });
    for (let i = 0; i < 3; i += 1) {
      await next.click();
    }

    await expect(page.getByTestId("denali-step-pricing")).toBeVisible();
    await expect(page.getByTestId("denali-pricing-requirements-section")).toBeVisible();
    await expect(page.getByTestId("denali-pricing-minimum-age")).toBeVisible();
    await expect(page.getByTestId("denali-pricing-fitness-level")).toBeVisible();
    await expect(page.getByTestId("denali-pricing-sports-insurance")).toBeVisible();
  });

  test("review step shows display-only participant summary", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);

    const denali = page.getByTestId("workspace-tour-wizard");
    if (!(await denali.isVisible().catch(() => false))) {
      test.skip(true, "Denali wizard not available on this host");
    }

    const next = page.getByRole("button", { name: /بعدی|next/i });
    for (let i = 0; i < 4; i += 1) {
      await next.click();
    }

    await expect(page.getByTestId("denali-step-review")).toBeVisible();
    await expect(page.getByTestId("denali-review-participants-display")).toBeVisible();
    await expect(page.getByTestId("denali-pricing-minimum-age")).toHaveCount(0);
  });
});
