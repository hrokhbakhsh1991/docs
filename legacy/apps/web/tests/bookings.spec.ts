import { expect, test } from "@playwright/test";

test.describe.skip("bookings mock UI", () => {
  test("/bookings loads with seeded mock rows", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.locator("body")).toContainText("Bookings");
    await expect(page.locator("body")).toContainText("b-mock-1");
    await expect(page.locator("body")).toContainText("Alex Rivera");
    await expect(page.locator("body")).toContainText("City highlights walk");
  });

  test("navigates to booking detail and shows customer name", async ({ page }) => {
    await page.goto("/bookings");
    await page.getByTestId("booking-detail-link-b-mock-1").click();
    await expect(page).toHaveURL(/\/bookings\/b-mock-1$/);
    await expect(page.getByTestId("booking-customer-name")).toContainText("Alex Rivera");
    await expect(page.locator("body")).toContainText("alex@example.com");
    await expect(page.locator("body")).toContainText("Unpaid");
  });
});
