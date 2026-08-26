#!/usr/bin/env node
/**
 * Create a mountain single-day tour via Denali wizard (dev smoke).
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000";
/** Sync with Denali seed / `DENALI_DEV_OWNER_MOBILE` (override via env). */
const OWNER_MOBILE = process.env.OPERATOR_OWNER_MOBILE ?? "09174070937";
const OTP = "1234";
const TOUR_TITLE = `تور کوهنوردی یک‌روزه ${Date.now()}`;

async function loginViaBff(page) {
  const otpRes = await page.request.post(`${BASE}/api/auth/request-otp`, {
    data: { phone: OWNER_MOBILE },
  });
  if (!otpRes.ok()) throw new Error(`request-otp failed: ${otpRes.status()}`);
  const { challenge_id } = await otpRes.json();
  const loginRes = await page.request.post(`${BASE}/api/auth/login-web-session`, {
    data: { phone: OWNER_MOBILE, otp: OTP, challenge_id },
  });
  if (!loginRes.ok()) throw new Error(`login failed: ${loginRes.status()}`);
}

async function clearDraftIfPresent(page) {
  const clear = page.getByTestId("wizard-clear-draft");
  if (!(await clear.isVisible().catch(() => false))) return;
  await clear.click();
  await page.getByTestId("wizard-clear-draft-confirm-confirm").click();
  await page.waitForTimeout(2500);
}

function field(page, canonicalPath) {
  return page.locator(`[data-field-path="${canonicalPath}"]`);
}

async function fillTextField(page, canonicalPath, value) {
  const input = field(page, canonicalPath).locator("input, textarea").first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.fill(value);
  await input.blur();
}

async function pickStartDatetime(page) {
  const start = page.getByTestId("denali-composite-datetime-start");
  await start.waitFor({ state: "visible", timeout: 30_000 });

  await start.locator("[data-operator-date-picker]").click();
  const calendar = page.locator('[data-testid="localized-calendar"]');
  await calendar.waitFor({ state: "visible", timeout: 10_000 });
  const futureDay = calendar.locator('button[aria-label^="2026-07"]').first();
  if (await futureDay.count()) {
    await futureDay.click();
  } else {
    await calendar.getByRole("button", { name: /امروز|today/i }).click();
  }

  await start.locator(".operator-wizard-datetime__control button").last().click();
  const picker = page.locator("[data-operator-wizard-time-picker]");
  await picker.waitFor({ state: "visible", timeout: 10_000 });
  await picker.locator('[data-time-option="08"]').first().click();
  await picker.locator(".operator-time-picker__column").last().locator('[data-time-option="00"]').click();
  await page.keyboard.press("Escape");
}

async function clickNext(page) {
  const btn = page.getByTestId("workspace-wizard-step-next");
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  if (await btn.isDisabled()) {
    const alerts = await page.locator("[role='alert'], [data-tour-create-error]").allTextContents();
    throw new Error(`Next disabled — ${alerts.join(" | ") || "validation"}`);
  }
  await btn.click();
  await page.waitForTimeout(600);
}

async function pickDestination(page) {
  const destination = page.getByTestId("denali-composite-destination");
  await destination.waitFor({ state: "visible", timeout: 30_000 });

  const nativeSelect = destination.locator("select").first();
  if (await nativeSelect.isVisible().catch(() => false)) {
    const options = await nativeSelect.locator("option").all();
    for (const opt of options) {
      const val = await opt.getAttribute("value");
      if (val && val.length > 4) {
        await nativeSelect.selectOption(val);
        return;
      }
    }
    throw new Error("destination select has no usable option");
  }

  // Searchable combobox (Denali destination catalog)
  const combo = destination.getByRole("combobox").or(page.getByRole("combobox", { name: /مقصد/i }));
  await combo.click();
  const option = page.getByRole("option").first();
  await option.waitFor({ state: "visible", timeout: 30_000 });
  await option.click();
}

async function pickApproximateReturnTime(page) {
  const root = page.getByTestId("denali-composite-approximate-return-time");
  if (!(await root.isVisible().catch(() => false))) return;
  const openBtn = root.locator("button").first();
  await openBtn.click();
  const picker = page.locator("[data-operator-wizard-time-picker]");
  if (await picker.isVisible().catch(() => false)) {
    await picker.locator('[data-time-option="18"]').first().click();
    const confirm = page.getByRole("button", { name: /تأیید|confirm/i });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    else await page.keyboard.press("Escape");
  }
}

async function fillMountainDayBasics(page) {
  await page.getByTestId("denali-tour-kind-category-mountain").click();
  await page.getByTestId("denali-tour-kind-duration-single_day").click();
  await fillTextField(page, "title", TOUR_TITLE);

  await pickDestination(page);

  const peak = field(page, "tripDetails.overview.peakHeight").locator("input").first();
  if (await peak.isVisible().catch(() => false)) {
    const disabled = await peak.isDisabled().catch(() => false);
    if (!disabled) {
      await peak.fill("4200");
      await peak.blur();
    }
  }

  await pickStartDatetime(page);
  await pickApproximateReturnTime(page);
  await fillTextField(page, "capacityMax", "12");

  const socialAutoInfo = page.getByTestId("denali-social-media-telegram-auto-info");
  if (await socialAutoInfo.isVisible().catch(() => false)) {
    // Telegram default — group link is provisioned after publish; no manual input.
  } else {
    const social = field(page, "socialMediaLink").locator("input").first();
    if (await social.isVisible().catch(() => false)) {
      await social.fill("https://example.com/tour-group");
      await social.blur();
    }
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: BASE });
const page = await context.newPage();

try {
  await loginViaBff(page);
  console.log("✓ login");

  await page.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await clearDraftIfPresent(page);
  console.log("✓ wizard ready");

  await fillMountainDayBasics(page);
  await page.waitForTimeout(1500);
  await clickNext(page);
  console.log("✓ step denali_basic");

  await fillTextField(page, "program.shortDescription", "صعود یک‌روزه به ارتفاعات البرز با تیم حرفه‌ای.");
  await clickNext(page);
  console.log("✓ step denali_photos");

  await fillTextField(page, "program.difficultyLevel", "6");
  await fillTextField(page, "program.hikingHoursApprox", "8");
  const elev = field(page, "tripDetails.metrics.elevationGain").locator("input").first();
  if (await elev.isVisible().catch(() => false)) {
    await elev.fill("900");
    await elev.blur();
  }
  await clickNext(page);
  console.log("✓ step denali_program");

  const transport = page.getByTestId("denali-composite-transport").locator("select").first();
  await transport.waitFor({ state: "visible", timeout: 20_000 });
  await transport.selectOption({ index: 1 });
  await clickNext(page);
  console.log("✓ step denali_logistics");

  const minAge = field(page, "participants.minimumAge").locator("input").first();
  if (await minAge.isVisible().catch(() => false)) {
    const current = await minAge.inputValue().catch(() => "");
    if (!current.trim()) {
      await minAge.fill("18");
      await minAge.blur();
    }
  }
  await clickNext(page);
  console.log("✓ step denali_pricing");

  await clickNext(page);
  console.log("✓ step denali_legal");

  const submit = page.getByRole("button", { name: /ساخت تور/i });
  await submit.waitFor({ state: "visible", timeout: 15_000 });
  if (await submit.isDisabled()) {
    const err = await page.locator("[data-tour-create-error], [role='alert']").allTextContents();
    throw new Error(`Submit disabled: ${err.join(" | ")}`);
  }
  await submit.click();
  await page.waitForTimeout(8000);

  const created = page.locator("[data-tour-created]");
  const error = page.locator("[data-tour-create-error]");
  if (await created.isVisible().catch(() => false)) {
    console.log("✓", await created.innerText());
  } else if (await error.isVisible().catch(() => false)) {
    throw new Error(await error.innerText());
  } else {
    console.log("? url:", page.url());
    console.log((await page.locator("body").innerText()).slice(0, 600));
  }
} catch (error) {
  console.error("✗", error instanceof Error ? error.message : String(error));
  await page.screenshot({ path: "/tmp/denali-mountain-day-fail.png", fullPage: true }).catch(() => {});
  process.exit(1);
} finally {
  await browser.close();
}
