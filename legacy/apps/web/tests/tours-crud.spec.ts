import { expect, test } from "@playwright/test";

test.describe.skip("tours mock CRUD", () => {
  test("creates a tour and shows it on the list", async ({ page }) => {
    const name = `Playwright Tour ${Date.now()}`;
    await page.goto("/tours/new");

    await page.getByTestId("tour-field-name").fill(name);
    await page.getByTestId("tour-field-description").fill("Smoke-test description.");
    await page.getByTestId("tour-field-price").fill("125.5");
    await page.getByTestId("tour-field-status").selectOption("active");

    await page.getByTestId("tour-form-submit").click();

    await expect(page).toHaveURL(/\/tours$/);
    await expect(page.locator("body")).toContainText(name);
  });

  test("opens edit page for a seeded tour and saves changes", async ({ page }) => {
    await page.goto("/tours/mock-1/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Edit tour" })).toBeVisible();

    const edited = `Edited Walk ${Date.now()}`;
    await page.getByTestId("tour-field-name").fill(edited);
    await page.getByTestId("tour-form-submit").click();

    await expect(page).toHaveURL(/\/tours$/);
    await expect(page.locator("body")).toContainText(edited);
  });

  test("delete confirms in modal and removes tour", async ({ page }) => {
    await page.goto("/tours");

    await expect(page.locator("body")).toContainText("Weekend escape");

    await page.getByTestId("tour-delete-mock-2").click();
    await expect(page.getByRole("dialog", { name: "Delete tour?" })).toBeVisible();

    await page.getByTestId("tour-delete-confirm").click();

    await expect(page.locator("body")).not.toContainText("Weekend escape");
  });
});
