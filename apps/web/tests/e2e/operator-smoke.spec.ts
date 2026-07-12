/**
 * Phase 9.8 — operator smoke E2E (SMK-P9-*)
 * Authority: docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_CREATE_TEST_IDS } from "../../src/features/bookings/bookings-create-types";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { SETTINGS_HUB_TEST_IDS } from "../../src/features/settings/settings-module-types";
import { FINANCE_OVERVIEW_TEST_IDS } from "../../src/finance/finance-reports-logic";
import { FINANCE_PREPAYMENTS_TEST_IDS } from "../../src/finance/finance-prepayments-logic";
import { RECONCILIATION_TRIAGE_TEST_IDS } from "../../src/finance/reconciliation-triage-logic";
import { INVITE_ACCEPT_TEST_IDS } from "../../src/features/users/invite-accept-logic";
import { USERS_DIRECTORY_TEST_IDS } from "../../src/features/users/users-directory-types";
import { WIZARD_TEMPLATE_PREFILL_TEST_IDS } from "../../src/tours/wizard-template-prefill-logic";
import { TOURS_LIST_TEST_IDS } from "../../src/features/tours/query-model";
import { typeLoginPhone } from "../../test/fixtures/operator-login-ui";
import { OPERATOR_LOGIN_TEST_IDS } from "../../src/features/auth/operator-login-copy";
import { OPERATOR_WELCOME_TEST_IDS } from "../../src/admin/onboarding/operator-welcome-types";
import {
  loginOperatorOwner,
  loginOperatorWithPhone,
  OPERATOR_ADMIN_MOBILE,
  OPERATOR_ADMIN_DISPLAY_NAME,
  OPERATOR_SMOKE_ADMIN_USER_ID,
  OPERATOR_INVITEE_MOBILE,
  OPERATOR_MEMBER_DISPLAY_NAME,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const UNAUTHORIZED_LOGIN_MOBILE = "+15559999999";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";

test.describe("operator-smoke.spec.ts — Phase 9.8 E2E", () => {
  test("SMK-P9-01 owner OTP login reaches dashboard", async ({ page }) => {
    await loginOperatorOwner(page);
    await expect(page.getByTestId("operator-dashboard-grid")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("dashboard-widget-finance")).toBeVisible({ timeout: 15_000 });
  });

  test("SMK-P9-WELCOME owner login shows welcome-back dialog once per login", async ({ page }) => {
    await loginOperatorOwner(page);
    const dialog = page.getByTestId(OPERATOR_WELCOME_TEST_IDS.dialog);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(OPERATOR_WELCOME_TEST_IDS.dismissCta).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("operator-dashboard-grid")).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test("SMK-P9-DENALI-THEME workspace skin applies green primary on operator shell", async ({
    page,
  }) => {
    await loginOperatorOwner(page);
    await expect(page.getByTestId("operator-dashboard-grid")).toBeVisible({ timeout: 15_000 });

    await expect(page.locator("body")).toHaveAttribute("data-workspace-plugin", "denali");

    const primary = await page.locator("body").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--primary").trim().toLowerCase()
    );
    expect(primary).toBe("#059669");

    const cta = page.getByTestId("operator-new-tour-cta");
    await expect(cta).toBeVisible();
    const buttonBg = await cta.evaluate((el) => {
      const button = el.querySelector("button");
      if (!(button instanceof HTMLElement)) {
        return "";
      }
      return getComputedStyle(button).backgroundColor;
    });
    expect(buttonBg).toBe("rgb(15, 118, 110)");

    // Mirror OperatorThemeToggleButton.applyThemeMode — headless click on the toggle is flaky.
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      const tenantRoot = document.querySelector("[data-tenant-theme]");
      const platformRoot = tenantRoot?.parentElement;
      if (platformRoot instanceof HTMLElement) {
        platformRoot.classList.remove("theme-light", "theme-dark");
        platformRoot.classList.add("theme-dark");
      }
    });

    const darkPrimary = await page.locator("body").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--primary").trim().toLowerCase()
    );
    expect(darkPrimary).toBe("#5eead4");
    expect(darkPrimary).not.toBe("#5b9fd4");

    const tenantDarkPrimary = await page.locator("[data-tenant-theme]").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--color-primary").trim().toLowerCase()
    );
    expect(tenantDarkPrimary).toBe("#5eead4");

    const darkButtonBg = await cta.evaluate((el) => {
      const button = el.querySelector("button");
      if (!(button instanceof HTMLElement)) {
        return "";
      }
      return getComputedStyle(button).backgroundColor;
    });
    expect(darkButtonBg).toBe("rgb(94, 234, 212)");
  });

  test("SMK-P9-WIZARD-THEME bridge shell + teal primary on /tours/new", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("wizard-bridge-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-workspace-wizard]")).toHaveAttribute("data-plugin-id", "denali");

    const primary = await page.locator("body").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--color-primary").trim().toLowerCase()
    );
    expect(primary).toBe("#059669");

    const continueBtn = page.getByTestId("workspace-wizard-step-next");
    await expect(continueBtn).toBeVisible();
    expect(await continueBtn.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(15, 118, 110)"
    );

    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      const tenantRoot = document.querySelector("[data-tenant-theme]");
      const platformRoot = tenantRoot?.parentElement;
      if (platformRoot instanceof HTMLElement) {
        platformRoot.classList.remove("theme-light", "theme-dark");
        platformRoot.classList.add("theme-dark");
      }
    });

    const wizardPrimary = await page.locator("[data-new-tour-wizard]").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--color-primary").trim().toLowerCase()
    );
    expect(wizardPrimary).toBe("#5eead4");

    expect(await continueBtn.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(94, 234, 212)"
    );
  });

  test("SMK-P9-02 wizard create → tour in list", async ({ page }) => {
    const tourTitle = `SMK-P9-02 Tour ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page);

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 120_000 });
    await page.getByRole("textbox", { name: "title" }).fill(tourTitle);
    await page.getByRole("button", { name: "Create tour" }).click();
    await expect(page.locator("[data-tour-created]")).toBeVisible({ timeout: 30_000 });

    await page.goto("/tours");
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.page)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.list)).toContainText(tourTitle, {
      timeout: 15_000,
    });
  });

  test("SMK-P9-06 leader review alias → shared inbox shell", async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/leader/review", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/bookings/, { timeout: 15_000 });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.leaderAlias)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-P9-07 manual booking create → pending queue", async ({ page }) => {
    const guestLabel = "SMK-P9-07 Guest";

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    const toursReady = page.waitForResponse(
      (response) => response.url().includes("/api/tours") && response.ok()
    );
    await page.goto("/bookings/new", { waitUntil: "domcontentloaded" });
    await toursReady;
    await expect(page.getByTestId(BOOKINGS_CREATE_TEST_IDS.page)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(BOOKINGS_CREATE_TEST_IDS.tourSelect)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId(BOOKINGS_CREATE_TEST_IDS.tourSelect).selectOption({
      label: "North Ridge Trek",
    });
    await page.getByTestId(BOOKINGS_CREATE_TEST_IDS.guestInput).fill(guestLabel);
    await page.getByTestId(BOOKINGS_CREATE_TEST_IDS.departureInput).fill("2026-12-15");
    await page.getByTestId(BOOKINGS_CREATE_TEST_IDS.submitButton).click();

    await expect(page).toHaveURL(/\/bookings/, { timeout: 15_000 });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toContainText(
      guestLabel
    );
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toContainText(
      /pending|در انتظار/i
    );
  });

  test("SMK-P9-04 pending booking → approve", async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings");
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toBeVisible();

    await page.getByRole("button", { name: /Ali Rezaei/i }).click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible();
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/approve") &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
    await approveResponse;

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toContainText(
      /approved|تأییدشده/i,
      { timeout: 15_000 }
    );
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toContainText(
      /approved|تأییدشده/i,
      { timeout: 15_000 }
    );
  });

  test("SMK-P9-03 invite → accept → directory shows member", async ({ page, browser }) => {
    let inviteToken = "";

    page.on("response", async (response) => {
      if (
        response.url().includes("/api/users/invite") &&
        response.request().method() === "POST" &&
        response.ok()
      ) {
        const body = (await response.json()) as { inviteToken?: string };
        if (typeof body.inviteToken === "string") {
          inviteToken = body.inviteToken;
        }
      }
    });

    await loginOperatorOwner(page);
    await page.goto("/users");
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.page)).toBeVisible();

    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.inviteButton).click();
    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.invitePhone).fill(OPERATOR_INVITEE_MOBILE);
    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.inviteSend).click();

    await expect.poll(() => inviteToken.length > 0, { timeout: 15_000 }).toBe(true);

    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.tabPending).click();
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.pendingList)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.pendingList)).toContainText(
      OPERATOR_INVITEE_MOBILE,
      { timeout: 15_000 }
    );

    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    await loginOperatorWithPhone(inviteePage, OPERATOR_INVITEE_MOBILE, { inviteToken });
    await expect(inviteePage.getByTestId("operator-dashboard-grid")).toBeVisible({
      timeout: 15_000,
    });
    await inviteeContext.close();

    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.tabActive).click();
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.list)).toContainText(
      OPERATOR_INVITEE_MOBILE
    );

    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.tabPending).click();
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.empty)).toContainText(
      "No pending invites"
    );
  });

  test("SMK-P9-USERS-04 admin OTP login blocked from owner panel (DEC-P9-018)", async ({
    page,
  }) => {
    const otpRes = await page.request.post("/api/auth/request-otp", {
      data: { phone: OPERATOR_ADMIN_MOBILE },
    });
    expect(otpRes.ok()).toBeTruthy();
    const otpBody = (await otpRes.json()) as { challenge_id?: string };
    expect(typeof otpBody.challenge_id).toBe("string");

    const loginRes = await page.request.post("/api/auth/login-web-session", {
      data: {
        phone: OPERATOR_ADMIN_MOBILE,
        otp: "1234",
        challenge_id: otpBody.challenge_id,
      },
    });
    expect(loginRes.status()).toBe(403);
    const loginBody = (await loginRes.json()) as { error?: { code?: string } };
    expect(loginBody.error?.code).toBe("AUTH_OWNER_PANEL_ONLY");
  });

  test("SMK-P9-USERS-03 ownership transfer panel lists admin candidate (R5 E2E)", async ({
    page,
  }) => {
    await loginOperatorOwner(page);
    await page.goto("/users");
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.tableDesktop)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("tr").filter({ hasText: OPERATOR_ADMIN_DISPLAY_NAME })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.ownershipTransfer)).toBeVisible({
      timeout: 15_000,
    });

    const select = page.getByTestId(USERS_DIRECTORY_TEST_IDS.ownershipTransferSelect);
    await expect(select.locator(`option[value="${OPERATOR_SMOKE_ADMIN_USER_ID}"]`)).toHaveCount(1, {
      timeout: 15_000,
    });
    await select.selectOption(OPERATOR_SMOKE_ADMIN_USER_ID);
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.ownershipTransferSubmit)).toBeEnabled();
  });

  test("SMK-P9-USERS-02 bulk suspend selected member (R8 E2E)", async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
    await loginOperatorOwner(page);
    await page.goto("/users");
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.tableDesktop)).toBeVisible({
      timeout: 15_000,
    });

    const memberRow = page.locator("tr").filter({ hasText: OPERATOR_MEMBER_DISPLAY_NAME });
    await memberRow.getByTestId(USERS_DIRECTORY_TEST_IDS.rowSelect).check();
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.bulkToolbar)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(USERS_DIRECTORY_TEST_IDS.bulkSuspend).click();

    await expect(memberRow.getByTestId(USERS_DIRECTORY_TEST_IDS.rowStatusSuspended)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-P9-USERS-01 owner suspends seeded admin row (R1 E2E)", async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
    await loginOperatorOwner(page);
    await page.goto("/users");
    await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.tableDesktop)).toBeVisible({
      timeout: 15_000,
    });

    const adminRow = page.locator("tr").filter({ hasText: OPERATOR_ADMIN_DISPLAY_NAME });
    await adminRow.getByTestId(USERS_DIRECTORY_TEST_IDS.rowSuspend).click();

    await expect(adminRow.getByTestId(USERS_DIRECTORY_TEST_IDS.rowStatusSuspended)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-P9-LOGIN-01 unauthorized phone stays on phone step with field error", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await expect(page.getByTestId(OPERATOR_LOGIN_TEST_IDS.hydrated)).toBeAttached();
    await typeLoginPhone(page, UNAUTHORIZED_LOGIN_MOBILE);
    const otpRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/request-otp") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    const otpResponse = await otpRequest;
    expect(otpResponse.status()).toBe(403);
    await expect(page.getByTestId(OPERATOR_LOGIN_TEST_IDS.phoneError)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-otp-segment-input]")).toHaveCount(0);
  });

  test("SMK-P9-LOGIN-02 authorized phone advances to OTP segment input", async ({ page }) => {
    await page.goto("/auth/login");
    await typeLoginPhone(page, OPERATOR_OWNER_MOBILE);
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    await expect(page.locator("[data-otp-segment-input]")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(OPERATOR_LOGIN_TEST_IDS.otpError)).toHaveCount(0);
  });

  test("SMK-P9-LOGIN-04 full UI login with dev OTP reaches dashboard", async ({ page }) => {
    await page.goto("/auth/login");
    await typeLoginPhone(page, OPERATOR_OWNER_MOBILE);
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    await expect(page.locator("[data-otp-segment-input]")).toBeVisible({ timeout: 15_000 });
    const loginRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/login-web-session") &&
        response.request().method() === "POST"
    );
    await page.locator('[data-otp-cell="0"]').fill("1");
    await page.locator('[data-otp-cell="1"]').fill("2");
    await page.locator('[data-otp-cell="2"]').fill("3");
    await page.locator('[data-otp-cell="3"]').fill("4");
    const loginResponse = await loginRequest;
    expect(loginResponse.ok()).toBeTruthy();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByTestId("operator-dashboard-grid")).toBeVisible({ timeout: 15_000 });
  });

  test("SMK-P9-LOGIN-05 change phone returns to phone step", async ({ page }) => {
    await page.goto("/auth/login");
    await typeLoginPhone(page, OPERATOR_OWNER_MOBILE);
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    await expect(page.locator("[data-otp-segment-input]")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /change mobile|تغییر شماره/i }).click();
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("[data-otp-segment-input]")).toHaveCount(0);
  });

  test("SMK-P9-LOGIN-03 wrong OTP shows inline field error", async ({ page }) => {
    await page.goto("/auth/login");
    await typeLoginPhone(page, OPERATOR_OWNER_MOBILE);
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    await expect(page.locator("[data-otp-segment-input]")).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-otp-cell="0"]').fill("0");
    await page.locator('[data-otp-cell="1"]').fill("0");
    await page.locator('[data-otp-cell="2"]').fill("0");
    await page.locator('[data-otp-cell="3"]').fill("0");
    await expect(page.getByTestId(OPERATOR_LOGIN_TEST_IDS.otpError)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-P9-LOGIN-06 empty phone shows phone field error", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByTestId(OPERATOR_LOGIN_TEST_IDS.hydrated)).toBeAttached();
    const phoneInput = page.locator("#phone");
    await phoneInput.click();
    await phoneInput.press("ControlOrMeta+a");
    await phoneInput.press("Backspace");
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    await expect(page.getByTestId(OPERATOR_LOGIN_TEST_IDS.phoneError)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-otp-segment-input]")).toHaveCount(0);
  });

  test("SMK-P9-LOGIN-07 resend OTP enabled after cooldown", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/auth/login");
    await typeLoginPhone(page, OPERATOR_OWNER_MOBILE);
    await page.getByRole("button", { name: /send code|ارسال رمز/i }).click();
    await expect(page.locator("[data-otp-segment-input]")).toBeVisible({ timeout: 15_000 });

    const resendButton = page.getByRole("button", { name: /resend|ارسال مجدد/i });
    await expect(resendButton).toBeDisabled();
    await expect(resendButton).toContainText(/resend in|ارسال مجدد تا/i);

    await expect
      .poll(
        async () => {
          const label = (await resendButton.textContent()) ?? "";
          return /^(Resend code|ارسال مجدد رمز)$/i.test(label.trim());
        },
        { timeout: 50_000, intervals: [500, 1000, 2000] }
      )
      .toBe(true);

    const otpRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/request-otp") &&
        response.request().method() === "POST"
    );
    await resendButton.click();
    const otpResponse = await otpRequest;
    expect(otpResponse.ok()).toBeTruthy();
  });

  test("SMK-P9-03 invite entry shows login banner", async ({ page }) => {
    await page.goto("/auth/login?invite=00000000-0000-4000-8000-000000000001");
    await expect(page.getByTestId(INVITE_ACCEPT_TEST_IDS.loginInviteBanner)).toBeVisible();
    await expect(page.locator("#phone")).toHaveValue(OPERATOR_OWNER_MOBILE);
  });

  test("SMK-P9-05 template seed → wizard prefill", async ({ page }) => {
    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { seedLabel: "SMK-P9-SEED" });

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedApplied)).toContainText(
      "SMK-P9-SEED",
      { timeout: 60_000 }
    );
    await expect(page.getByTestId(WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedPrefillField)).toHaveValue(
      "SMK-P9-SEED",
      { timeout: 15_000 }
    );
  });

  test("SMK-P9-08 settings equipment round-trip", async ({ page }) => {
    const itemName = `SMK-P9-08-${Date.now()}`;

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/settings/equipment");
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.equipmentPage)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#equipment-name").fill(itemName);
    await page.getByTestId(SETTINGS_HUB_TEST_IDS.equipmentCreate).click();
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.equipmentList)).toContainText(itemName, {
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.equipmentList)).toContainText(itemName, {
      timeout: 15_000,
    });
  });

  test("SMK-P9-10 profile settings save display name", async ({ page }) => {
    const displayName = `SMK-P9-10-${Date.now()}`;

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/settings/me");
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.profilePage)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(SETTINGS_HUB_TEST_IDS.profileDisplayName).fill(displayName);
    await page.getByTestId(SETTINGS_HUB_TEST_IDS.profileSave).click();
    await expect(page.getByText("Profile saved.")).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.profileDisplayName)).toHaveValue(
      displayName,
      { timeout: 15_000 }
    );
  });

  test("SMK-P9-09 finance command center overview loads", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/finance", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("finance-command-center")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.kpiStrip)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-P9-12 finance prepayments tab loads", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/finance?tab=prepayments", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("finance-command-center")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(FINANCE_PREPAYMENTS_TEST_IDS.panel)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page
        .getByTestId(FINANCE_PREPAYMENTS_TEST_IDS.list)
        .or(page.getByTestId(FINANCE_PREPAYMENTS_TEST_IDS.emptyState))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("SMK-P9-11 reconciliation triage page loads from settings hub", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/settings/reconciliation-triage", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(RECONCILIATION_TRIAGE_TEST_IDS.page)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page
        .getByTestId(RECONCILIATION_TRIAGE_TEST_IDS.emptyState)
        .or(page.getByTestId(RECONCILIATION_TRIAGE_TEST_IDS.findingsList))
    ).toBeVisible({ timeout: 15_000 });
  });
});
