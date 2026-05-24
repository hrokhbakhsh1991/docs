import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Smoke: map.md altitude / multi-day itinerary / gear DOM testids (no live API required).
 * Run: `PW_BASE_URL=http://denali.localhost:3000 pnpm run build:smoke && PW_BASE_URL=http://denali.localhost:3000 playwright test -c playwright.smoke.config.ts tests/smoke/13-denali-wizard-map-fields-dom.spec.ts`
 */
async function setNativeSelectValue(locator: Locator, value: string): Promise<void> {
  await locator.evaluate(
    (select: HTMLSelectElement, v: string) => {
      select.value = v;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

async function requireDenaliWizard(page: Page): Promise<Locator> {
  const denali = page.getByTestId("denali-create-tour-wizard");
  if (!(await denali.isVisible().catch(() => false))) {
    test.skip(true, "Denali wizard not available on this host");
  }
  return denali;
}

test.describe("denali map fields DOM (altitude, itinerary, gear)", () => {
  test("mountain single-day program step exposes altitude testid", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res!.status()).toBeLessThan(500);

    const w = await requireDenaliWizard(page);
    await setNativeSelectValue(w.getByTestId("denali-basics-category"), "mountain");
    await setNativeSelectValue(w.getByTestId("denali-basics-duration"), "single_day");
    await page.getByRole("button", { name: /بعدی|next/i }).click();

    await expect(w.getByTestId("denali-step-program")).toBeVisible({ timeout: 15_000 });
    await expect(w.getByTestId("denali-program-altitude")).toBeVisible({ timeout: 10_000 });
    await expect(w.getByTestId("denali-daily-itinerary")).toBeHidden();
  });

  test("mountain multi-day program step exposes daily itinerary testids", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res!.status()).toBeLessThan(500);

    const w = await requireDenaliWizard(page);
    await setNativeSelectValue(w.getByTestId("denali-basics-category"), "mountain");
    await setNativeSelectValue(w.getByTestId("denali-basics-duration"), "multi_day");
    await page.getByRole("button", { name: /بعدی|next/i }).click();

    await expect(w.getByTestId("denali-step-program")).toBeVisible({ timeout: 15_000 });
    await expect(w.getByTestId("denali-daily-itinerary")).toBeVisible({ timeout: 15_000 });
    await expect(w.locator('[data-testid^="denali-itinerary-day-"]').first()).toBeVisible();
    await expect(w.getByTestId("denali-program-altitude")).toBeVisible();
  });

  test("logistics step mounts gear section without crashing", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res!.status()).toBeLessThan(500);

    await requireDenaliWizard(page);
    const next = page.getByRole("button", { name: /بعدی|next/i });
    for (let i = 0; i < 2; i += 1) {
      await next.click();
    }

    await expect(page.getByTestId("denali-step-logistics")).toBeVisible({ timeout: 15_000 });
    const w = page.getByTestId("denali-create-tour-wizard");
    const gearList = w.getByTestId("denali-gear-list");
    const gearLoading = w.getByText(/در حال بارگذاری|loading/i);
    const gearEmpty = w.getByText(/تجهیز|equipment/i);

    const hasList = await gearList.isVisible().catch(() => false);
    const hasLoading = await gearLoading.isVisible().catch(() => false);
    const hasEmptyHint = await gearEmpty.isVisible().catch(() => false);
    expect(hasList || hasLoading || hasEmptyHint).toBeTruthy();
  });

  test("review step exposes summary error panel testid", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res!.status()).toBeLessThan(500);

    await requireDenaliWizard(page);
    const next = page.getByRole("button", { name: /بعدی|next/i });
    for (let i = 0; i < 5; i += 1) {
      await next.click();
    }

    const w = page.getByTestId("denali-create-tour-wizard");
    await expect(w.getByTestId("denali-step-review")).toBeVisible({ timeout: 15_000 });
    await expect(w.getByTestId("denali-summary-error")).toHaveCount(0);
  });
});
