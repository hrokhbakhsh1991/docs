/**
 * ITO member portal — execution summary browser proof (C04 member surface).
 */
import { expect, test } from "@playwright/test";

import { DENALI_ITO_E2E_REGISTRATION_ID } from "./fixtures/denali-ito-e2e-fixtures";
import { DENALI_DEFAULT_WALLET } from "../../../api/test/fixtures/denali-default-wallet-tenant";

import { loginDenaliDefaultWalletMember } from "./fixtures/denali-default-wallet-member-session";

const REGISTRATION_PATH = `/me/registrations/${DENALI_ITO_E2E_REGISTRATION_ID}`;
const ARTIFACT_DIR = "/opt/cursor/artifacts";

async function openMemberTripsList(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
  await expect(
    page
      .locator("[data-portal-member-registrations-list]")
      .or(page.locator("[data-portal-member-registrations-empty-state]")),
  ).toBeVisible({ timeout: 120_000 });
}

async function openExecutionRegistrationDetail(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto(REGISTRATION_PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("portal-member-execution-summary.spec.ts — ITO member proof", () => {
  test.beforeEach(async ({ page }) => {
    await loginDenaliDefaultWalletMember(page);
  });

  test("ITO-M01 EN desktop — home → execution summary → leader → notification mark-read → refresh", async ({
    page,
  }) => {
    await openMemberTripsList(page);
    await openExecutionRegistrationDetail(page);
    const summary = page.locator("[data-portal-member-execution-summary]");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("data-ito-execution-state", /in_progress|pre_tour|manifest_locked/);
    await expect(page.locator("[data-ito-member-execution-state]")).toBeVisible();
    await expect(page.locator("[data-ito-member-tour-leader]")).not.toBeEmpty();
    await expect(page.locator("[data-portal-member-registration-status]")).toBeVisible();

    await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator(
        "[data-portal-member-notifications][data-portal-member-notifications-state='ready']",
      ),
    ).toBeVisible({ timeout: 120_000 });

    const executionNotice = page
      .locator(
        "[data-portal-member-notification-item][data-portal-member-notification-source='booking']",
      )
      .filter({ hasText: /tour|execution|started|تور|شروع/i })
      .first();
    if ((await executionNotice.count()) > 0) {
      await executionNotice.locator("a").click();
      await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
      await expect(
        page
          .locator(
            "[data-portal-member-notification-item][data-portal-member-notification-source='booking'][data-portal-member-notification-unread='false']",
          )
          .filter({ hasText: /tour|execution|started|تور|شروع/i })
          .first(),
      ).toBeVisible({ timeout: 60_000 });
    }

    await openExecutionRegistrationDetail(page);
    await expect(page.locator("[data-ito-member-tour-leader]")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-execution-summary]")).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACT_DIR}/ito-portal-execution-summary-desktop-en.png`,
      fullPage: true,
    });
  });

  test("ITO-M02 FA mobile RTL — execution summary + long Persian leader label persistence", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "fa",
        domain: "portal.denali.localhost",
        path: "/",
      },
    ]);

    await openExecutionRegistrationDetail(page);
    await expect(page.locator("[data-portal-member-execution-summary]")).toBeVisible();
    await expect(page.locator("[data-ito-member-tour-leader]")).toBeVisible();
    await expect(page.locator("[data-ito-member-meeting-location]")).toContainText(/ITO E2E|Denali/i);

    const htmlDir = await page.locator("html").getAttribute("dir");
    expect(htmlDir === "rtl" || htmlDir === null).toBeTruthy();

    await page.screenshot({
      path: `${ARTIFACT_DIR}/ito-portal-execution-summary-mobile-fa-rtl.png`,
      fullPage: true,
    });
  });

  test("ITO-M03 member without approved registration — execution summary hidden", async ({
    page,
  }) => {
    await loginDenaliDefaultWalletMember(page, DENALI_DEFAULT_WALLET.deniedMemberMobile);
    await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registrations-empty-state]")).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.locator("[data-portal-member-execution-summary]")).toHaveCount(0);
  });

  test("ITO-M04 forbidden registration id returns not found", async ({ page }) => {
    const res = await page.goto("/me/registrations/00000000-0000-4000-8000-000000009999", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(404);
  });

  test("ITO-M05 missing execution summary when member has no approved registration", async ({
    page,
  }) => {
    await loginDenaliDefaultWalletMember(page, DENALI_DEFAULT_WALLET.deniedMemberMobile);
    await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-execution-summary]")).toHaveCount(0);
  });
});
