import { expect, test } from "@playwright/test";

import { USERS_DIRECTORY_TEST_IDS } from "../../src/features/users/users-directory-types";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

test("T12 invite dialog remains usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loginOperatorOwner(page);
  await page.goto("/users", { waitUntil: "networkidle" });
  await page.getByTestId(USERS_DIRECTORY_TEST_IDS.inviteButton).click();

  const dialog = page.getByTestId(USERS_DIRECTORY_TEST_IDS.inviteModal);
  await expect(dialog).toBeVisible();
  const metrics = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(320);
  await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.invitePhone)).toBeVisible();
  await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.inviteSend)).toBeDisabled();
  await page
    .getByRole("button", { name: /انصراف|cancel/i })
    .first()
    .click();
  await expect(dialog).toBeHidden();
  await page.screenshot({ path: "test-results/t12-users-invite-320.png", fullPage: true });
});
