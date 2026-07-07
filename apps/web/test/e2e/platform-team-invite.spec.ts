/**
 * P1 §J internal — platform team invite UI E2E.
 */
import { expect, test } from "@playwright/test";

import { loginPlatformOps } from "../fixtures/platform-ops-session";

function uniqueTeamInvitePhone(): string {
  return `+1555${Date.now().toString().slice(-7)}`;
}

test.describe("platform-team-invite.spec.ts — P1 §J internal", () => {
  test("owner invites support member via UI", async ({ page }) => {
    const phone = uniqueTeamInvitePhone();

    await loginPlatformOps(page);
    await page.goto("/platform/team", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('[data-testid="platform-team-invite-form"][data-client-ready="true"]')
    ).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("platform-team-invite-phone").fill(phone);
    await page.locator('select[name="role"]').selectOption("support");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/platform/team") &&
          response.request().method() === "POST" &&
          response.ok(),
        { timeout: 30_000 }
      ),
      page.getByTestId("platform-team-invite-submit").click(),
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByRole("cell", { name: phone })).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("row").filter({ hasText: phone }).getByRole("cell", { name: "support" })
    ).toBeVisible();
  });
});
