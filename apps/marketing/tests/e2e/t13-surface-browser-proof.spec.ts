import { expect, test } from "@playwright/test";

test("T13 Denali surface routing stays host-canonical", async ({ page }) => {
  const marketingResponse = await page.goto("http://denali.localhost:3002/tours", {
    waitUntil: "domcontentloaded",
  });
  expect(marketingResponse?.status()).toBe(200);
  await expect(page).toHaveURL(
    /http:\/\/(denali\.localhost:3002|portal\.denali\.localhost:3003)\/tours$/
  );
  await expect(page.locator("body")).not.toContainText("Something went wrong");
  await page.screenshot({ path: "test-results/t13-portal-from-marketing.png", fullPage: true });

  const portalLoginResponse = await page.goto(
    "http://denali.portal.localhost:3003/login?portalReturn=%2Fme%2Fregistrations",
    { waitUntil: "domcontentloaded" }
  );
  expect(portalLoginResponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login\?portalReturn=%2Fme%2Fregistrations$/);
  await expect(page.locator("body")).not.toContainText("Something went wrong");

  const adminResponse = await page.goto("http://admin.operator.localhost:3000/dashboard", {
    waitUntil: "domcontentloaded",
  });
  expect(adminResponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator("body")).not.toContainText("Something went wrong");
});
