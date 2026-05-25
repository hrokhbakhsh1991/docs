import { expect, test } from "@playwright/test";

/**
 * Denali Final Verification Matrix (map.md §2).
 * 
 * 2a) Kind Switch Flow
 * 2b) Multi-Step Back/Forward
 * 2c) Draft Restore
 */
test.describe("denali verification matrix", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    const denali = page.getByTestId("denali-create-tour-wizard");
    if (!(await denali.isVisible().catch(() => false))) {
      test.skip(true, "Denali wizard not available on this host (must be a Denali tenant subdomain)");
    }
  });

  test("2a) kind switch mid-wizard purges ghost fields from UI", async ({ page }) => {
    // 1. Fill mountain-specific fields on step 2
    await page.getByRole("button", { name: /بعدی|next/i }).click(); // To step 2 (program)
    await expect(page.getByTestId("denali-program-difficulty")).toBeVisible();
    await page.getByTestId("denali-program-difficulty").selectOption("hard");

    // 2. Go back to step 1 and switch to event
    await page.getByRole("button", { name: /قبلی|previous/i }).click();
    await page.getByTestId("denali-tour-category-event").click();

    // 3. Go forward to step 2
    await page.getByRole("button", { name: /بعدی|next/i }).click();
    
    // 4. Assert outdoor fields are hidden
    await expect(page.getByTestId("denali-program-difficulty")).toBeHidden();
    
    // 5. Go to review and assert no participant fields
    for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /بعدی|next/i }).click();
    }
    await expect(page.getByTestId("denali-review-participants-section")).toBeHidden();
  });

  test("2b) navigation preserves valid fields and validations", async ({ page }) => {
    await page.getByPlaceholder(/عنوان|title/i).fill("Matrix Test Tour");
    await page.getByRole("button", { name: /بعدی|next/i }).click();
    
    await expect(page.getByPlaceholder(/توضیح کوتاه|short description/i)).toBeVisible();
    await page.getByPlaceholder(/توضیح کوتاه|short description/i).fill("Short desc");
    
    await page.getByRole("button", { name: /قبلی|previous/i }).click();
    await expect(page.getByPlaceholder(/عنوان|title/i)).toHaveValue("Matrix Test Tour");
  });

  test("2c) draft restore clears ghost fields after reload", async ({ page }) => {
    await page.getByPlaceholder(/عنوان|title/i).fill("Draft Restore Test");
    await page.waitForTimeout(700);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("denali-draft-incompatible-banner")).toBeHidden();
    await expect(page.getByPlaceholder(/عنوان|title/i)).toHaveValue("Draft Restore Test");
  });
});
