import { expect, test } from "@playwright/test";

import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const ids = {
  page: "payment-destination-settings-page",
  cardNumber: "payment-destination-card-number",
  cardHolderName: "payment-destination-card-holder-name",
  bankName: "payment-destination-bank-name",
  enabled: "payment-destination-enabled",
  save: "payment-destination-save",
  success: "payment-destination-success",
  error: "payment-destination-error",
} as const;

test("T05-CARD Denali owner can save payment destination", async ({ page }) => {
  test.setTimeout(240_000);
  await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
  await page.goto("/settings/payment-destination", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(ids.page)).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByTestId(ids.cardNumber)
  ).toBeVisible();
  await page.getByTestId(ids.enabled).check();
  await page.getByTestId(ids.cardNumber).fill("6037997512345678");
  await page
    .getByTestId(ids.cardHolderName)
    .fill("Denali Workspace");
  await page.getByTestId(ids.bankName).fill("Test Bank");
  await page.getByTestId(ids.save).click();
  await expect(page.getByTestId(ids.success)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId(ids.error)).toHaveCount(0);
});
