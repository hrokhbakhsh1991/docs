/**
 * PR23 UX2 — browser visual QA matrix (operator smoke stack).
 *
 * Does NOT implement D3-B/D3-C. Uses existing operator Playwright + loginOperatorOwner.
 * @see docs/phase-20/p7/appendices/FINANCE_UX_CONSOLIDATION_PR23_UX1.md
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { FINANCE_EXCEPTIONS_TEST_IDS } from "../../src/finance/finance-exceptions-logic";
import { FINANCE_OUTSTANDING_TEST_IDS } from "../../src/finance/finance-outstanding-logic";
import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import { FINANCE_RECEIPTS_TEST_IDS } from "../../src/finance/finance-receipts-logic";
import { FINANCE_OVERVIEW_TEST_IDS } from "../../src/finance/finance-reports-logic";
import { FINANCE_REFUNDS_TEST_IDS } from "../../src/finance/finance-refunds-logic";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
  resolveOperatorRequestHostname,
} from "../../test/fixtures/operator-owner-session";

const ARTIFACT_DIR = path.join(
  process.cwd(),
  "test-results",
  "finance-ux2-browser-qa"
);

const VIEWPORTS = {
  desktop1440: { width: 1440, height: 900 },
  desktop1280: { width: 1280, height: 800 },
  mobile390: { width: 390, height: 844 },
  mobile375: { width: 375, height: 812 },
} as const;

type AppLocale = "en" | "fa";

async function loginUx2Operator(page: Page): Promise<void> {
  await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, {
    skipDashboard: true,
    skipAbilityPreflight: true,
  });
}

async function setOperatorLocale(page: Page, locale: AppLocale): Promise<void> {
  const domain = await resolveOperatorRequestHostname(page);
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: locale,
      domain,
      path: "/",
    },
  ]);
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `horizontal overflow: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`
  ).toBeLessThanOrEqual(clientWidth + 2);
}

async function openFinanceOverview(page: Page): Promise<void> {
  await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.getByTestId("finance-command-center")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.panel)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.needsActionSection)).toBeVisible({
    timeout: 60_000,
  });
  // Refunds/queues cards mount only after overview fetch settles (!loading && !error).
  const refunds = page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.refundsAwaiting);
  const overviewAlert = page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.panel).getByRole("alert");
  await expect(refunds.or(overviewAlert)).toBeVisible({ timeout: 90_000 });
  if (await overviewAlert.isVisible().catch(() => false)) {
    const message = await overviewAlert.innerText();
    throw new Error(`Finance overview failed to load: ${message}`);
  }
  await expect(refunds).toBeVisible({ timeout: 5_000 });
}

async function assertNeedsActionHierarchy(page: Page): Promise<void> {
  const needs = page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.needsActionSection);
  await expect(needs).toBeVisible();
  await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.refundsAwaiting)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.collectionQueues)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.attentionSection)).toBeVisible();

  const order = await page.evaluate((ids) => {
    const needsEl = document.querySelector(`[data-testid="${ids.needs}"]`);
    if (!needsEl) {
      return null;
    }
    const children = [
      ...needsEl.querySelectorAll(
        `[data-testid="${ids.refunds}"], [data-testid="${ids.queues}"], [data-testid="${ids.exceptions}"]`
      ),
    ];
    return children.map((el) => el.getAttribute("data-testid"));
  }, {
    needs: FINANCE_OVERVIEW_TEST_IDS.needsActionSection,
    refunds: FINANCE_OVERVIEW_TEST_IDS.refundsAwaiting,
    queues: FINANCE_OVERVIEW_TEST_IDS.collectionQueues,
    exceptions: FINANCE_EXCEPTIONS_TEST_IDS.panel,
  });

  expect(order, "Needs action child order").not.toBeNull();
  const refundIdx = order!.indexOf(FINANCE_OVERVIEW_TEST_IDS.refundsAwaiting);
  const queuesIdx = order!.indexOf(FINANCE_OVERVIEW_TEST_IDS.collectionQueues);
  expect(refundIdx).toBeGreaterThanOrEqual(0);
  expect(queuesIdx).toBeGreaterThan(refundIdx);

  // Quiet empty refunds OR list — never hide the card
  const empty = page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.refundsAwaitingEmpty);
  const listRows = page
    .getByTestId(FINANCE_OVERVIEW_TEST_IDS.refundsAwaiting)
    .locator("li");
  await expect(empty.or(listRows.first())).toBeVisible();
}

async function assertHelpCollapsedThenOpen(page: Page): Promise<void> {
  const help = page.getByTestId("finance-operator-help");
  await expect(help).toBeVisible();
  const openBefore = await help.evaluate((el) => (el as HTMLDetailsElement).open);
  expect(openBefore).toBe(false);
  await help.locator("summary").click();
  await expect(page.getByTestId("finance-operator-state-guide")).toBeVisible();
  const openAfter = await help.evaluate((el) => (el as HTMLDetailsElement).open);
  expect(openAfter).toBe(true);
}

async function assertOutstandingSurface(page: Page): Promise<void> {
  await page.goto("/finance?tab=outstanding", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(page.getByTestId("finance-command-center")).toBeVisible({
    timeout: 60_000,
  });
  // Capability resolve is async — click tab once visible so we don't race empty visibleTabs.
  const outstandingTab = page.getByRole("button", {
    name: /outstanding|مانده بدهی/i,
  });
  await expect(outstandingTab).toBeVisible({ timeout: 60_000 });
  await outstandingTab.click();
  await expect(page.getByTestId(FINANCE_OUTSTANDING_TEST_IDS.panel)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(FINANCE_OUTSTANDING_TEST_IDS.agingUnavailable)).toBeVisible();
  const agingText = await page
    .getByTestId(FINANCE_OUTSTANDING_TEST_IDS.agingUnavailable)
    .innerText();
  expect(agingText).not.toMatch(/not shipped/i);
  expect(agingText).not.toMatch(/\boverdue\b|\blate\b|\bمعوق\b|\bدیرکرد\b/i);
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/totalOutstanding|ageDays/);
}

async function assertTabLoads(page: Page, tab: string, testId: string): Promise<void> {
  await page.goto(`/finance?tab=${tab}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(page.getByTestId("finance-command-center")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 60_000 });
}

test.describe("PR23 UX2 Finance browser QA", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("matrix: FA desktop 1440 — Overview hierarchy + Help + tabs", async ({ page }) => {
    await setOperatorLocale(page, "fa");
    await page.setViewportSize(VIEWPORTS.desktop1440);
    await loginUx2Operator(page);

    await openFinanceOverview(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await assertNeedsActionHierarchy(page);
    await assertHelpCollapsedThenOpen(page);
    await expect(page.getByTestId(FINANCE_OVERVIEW_TEST_IDS.moneyOwedSection)).toBeVisible();
    await shot(page, "fa-desktop-overview");
    await assertNoHorizontalOverflow(page);

    await assertOutstandingSurface(page);
    await shot(page, "fa-desktop-outstanding");
    await assertNoHorizontalOverflow(page);

    await assertTabLoads(page, "payments", FINANCE_PAYMENTS_TEST_IDS.panel);
    await shot(page, "fa-desktop-payments");
    await assertTabLoads(page, "receipts", FINANCE_RECEIPTS_TEST_IDS.panel);
    await shot(page, "fa-desktop-receipts");
    await assertTabLoads(page, "refunds", FINANCE_REFUNDS_TEST_IDS.panel);
    await shot(page, "fa-desktop-refunds");

    const refundsBody = await page.locator("body").innerText();
    expect(refundsBody).toMatch(/درخواست‌شده|تأییدشده|تکمیل‌شده|ردشده|لغوشده/);
    expect(refundsBody).not.toMatch(/Requested \/ Approved/);
  });

  test("matrix: EN desktop 1280 — Overview + Help LTR", async ({ page }) => {
    await setOperatorLocale(page, "en");
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await loginUx2Operator(page);

    await openFinanceOverview(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await assertNeedsActionHierarchy(page);
    await assertHelpCollapsedThenOpen(page);
    await shot(page, "en-desktop-overview");
    await assertNoHorizontalOverflow(page);

    await assertOutstandingSurface(page);
    await shot(page, "en-desktop-outstanding");
  });

  test("matrix: FA mobile 390 — Overview density", async ({ page }) => {
    await setOperatorLocale(page, "fa");
    await page.setViewportSize(VIEWPORTS.mobile390);
    await loginUx2Operator(page);

    await openFinanceOverview(page);
    await assertNeedsActionHierarchy(page);
    await shot(page, "fa-mobile-overview");
    await assertNoHorizontalOverflow(page);

    await assertTabLoads(page, "refunds", FINANCE_REFUNDS_TEST_IDS.panel);
    await shot(page, "fa-mobile-refunds");
    await assertNoHorizontalOverflow(page);
  });

  test("matrix: EN mobile 375 — Overview + Refunds", async ({ page }) => {
    await setOperatorLocale(page, "en");
    await page.setViewportSize(VIEWPORTS.mobile375);
    await loginUx2Operator(page);

    await openFinanceOverview(page);
    await assertNeedsActionHierarchy(page);
    await shot(page, "en-mobile-overview");
    await assertNoHorizontalOverflow(page);

    await assertTabLoads(page, "refunds", FINANCE_REFUNDS_TEST_IDS.panel);
    await shot(page, "en-mobile-refunds");
    await assertNoHorizontalOverflow(page);
  });

  test("Journey C — cancelled-with-balance → Outstanding (when present)", async ({ page }) => {
    await setOperatorLocale(page, "en");
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await loginUx2Operator(page);
    await openFinanceOverview(page);

    const cancelled = page.locator(
      `[data-testid="${FINANCE_EXCEPTIONS_TEST_IDS.item}"][data-exception-type="CANCELLED_PAYMENT_WITH_BALANCE"]`
    );
    const count = await cancelled.count();
    test.info().annotations.push({
      type: "journey-c-data",
      description: `cancelled-with-balance rows=${count}`,
    });
    if (count === 0) {
      test.info().annotations.push({
        type: "note",
        description: "Journey C skipped — no CANCELLED_PAYMENT_WITH_BALANCE in smoke data",
      });
      return;
    }

    const link = cancelled.first().getByTestId(FINANCE_EXCEPTIONS_TEST_IDS.openOutstanding);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/tab=outstanding/);
    await expect(page).toHaveURL(/registrationId=/);
    await expect(page.getByTestId(FINANCE_OUTSTANDING_TEST_IDS.panel)).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "en-journey-c-outstanding");
  });

  test("Journey D — Payment→Refund deep-link amount hero", async ({ page }) => {
    await setOperatorLocale(page, "en");
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await loginUx2Operator(page);

    await page.goto("/finance?tab=payments", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.panel)).toBeVisible({
      timeout: 20_000,
    });

    const refundLink = page.getByRole("link", { name: /request refund/i }).first();
    if ((await refundLink.count()) > 0) {
      await refundLink.click();
      await expect(page).toHaveURL(/tab=refunds/);
      await expect(page.getByTestId(FINANCE_REFUNDS_TEST_IDS.amountHero)).toBeVisible({
        timeout: 10_000,
      });
      await shot(page, "en-journey-d-refund-from-payment");
      return;
    }

    // Prefill visual path without inventing a Paid payment
    await page.goto(
      "/finance?tab=refunds&registrationId=reg-ux2-qa&paymentId=pay-ux2-qa&amountMinor=2500000",
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.getByTestId(FINANCE_REFUNDS_TEST_IDS.panel)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(FINANCE_REFUNDS_TEST_IDS.amountHero)).toBeVisible();
    const hero = page.getByTestId(FINANCE_REFUNDS_TEST_IDS.amountHero);
    const input = page.locator("#refund-amount");
    const heroBox = await hero.boundingBox();
    const inputBox = await input.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(heroBox!.y).toBeLessThan(inputBox!.y);
    await shot(page, "en-journey-d-refund-prefill-hero");
  });

  test("Journey E — Complete refund CTA when Approved exists", async ({ page }) => {
    await setOperatorLocale(page, "en");
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await loginUx2Operator(page);

    await page.goto("/finance?tab=refunds", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(FINANCE_REFUNDS_TEST_IDS.panel)).toBeVisible({
      timeout: 20_000,
    });

    const completeBtn = page.getByTestId(FINANCE_REFUNDS_TEST_IDS.complete).first();
    if ((await completeBtn.count()) === 0) {
      test.info().annotations.push({
        type: "note",
        description: "Journey E skipped — no Complete-capable refund in smoke data",
      });
      await shot(page, "en-journey-e-no-completable-refund");
      return;
    }

    await completeBtn.click();
    await expect(page.getByTestId(FINANCE_REFUNDS_TEST_IDS.completeConfirm)).toBeVisible();
    await shot(page, "en-journey-e-confirm");
    await page
      .getByTestId(FINANCE_REFUNDS_TEST_IDS.completeConfirm)
      .getByRole("button", { name: /confirm complete/i })
      .click();
    await expect(page.getByTestId(FINANCE_REFUNDS_TEST_IDS.completeSuccess)).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, "en-journey-e-success");
    const success = page.getByTestId(FINANCE_REFUNDS_TEST_IDS.completeSuccess);
    const outstandingCta = success.getByTestId(FINANCE_REFUNDS_TEST_IDS.openOutstanding);
    const paymentsCta = success.getByTestId(FINANCE_REFUNDS_TEST_IDS.completeOpenPayments);
    if ((await outstandingCta.count()) > 0) {
      await expect(outstandingCta).toBeVisible();
    }
    if ((await paymentsCta.count()) > 0) {
      await expect(paymentsCta).toBeVisible();
    }
  });

  test("responsive sweep EN Overview widths", async ({ page }) => {
    await setOperatorLocale(page, "en");
    await loginUx2Operator(page);

    for (const [label, size] of Object.entries({
      w1440: VIEWPORTS.desktop1440,
      w1280: VIEWPORTS.desktop1280,
      w768: { width: 768, height: 900 },
      w430: { width: 430, height: 900 },
      w390: VIEWPORTS.mobile390,
      w375: VIEWPORTS.mobile375,
    })) {
      await page.setViewportSize(size);
      await openFinanceOverview(page);
      await assertNeedsActionHierarchy(page);
      await assertNoHorizontalOverflow(page);
      await shot(page, `en-responsive-${label}`);
    }
  });
});
