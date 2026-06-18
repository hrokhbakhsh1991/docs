#!/usr/bin/env node
/**
 * One-off Denali draft resume/clear E2E probe against running dev servers.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000";
const OWNER_MOBILE = process.env.OPERATOR_OWNER_MOBILE ?? "+989121000001";
const OTP = "1234";
const DRAFT_TITLE = `E2E Draft ${Date.now()}`;

function toAsciiDigits(text) {
  const PERSIAN_DIGIT_START = 0x06f0;
  const ARABIC_INDIC_DIGIT_START = 0x0660;
  let result = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (code >= PERSIAN_DIGIT_START && code <= PERSIAN_DIGIT_START + 9) {
      result += String(code - PERSIAN_DIGIT_START);
      continue;
    }
    if (code >= ARABIC_INDIC_DIGIT_START && code <= ARABIC_INDIC_DIGIT_START + 9) {
      result += String(code - ARABIC_INDIC_DIGIT_START);
      continue;
    }
    result += character;
  }
  return result;
}

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

async function fillField(page, canonicalPath, value) {
  const input = page
    .locator(`[data-field-path="${canonicalPath}"] input, [data-field-path="${canonicalPath}"] textarea`)
    .first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.click();
  await input.fill(value);
  await input.blur();
}

async function ensureBasicStep(page) {
  const basic = page.locator('[data-wizard-step="denali_basic"]');
  if (await basic.isVisible().catch(() => false)) return;
  await page.getByTestId("workspace-wizard-step-denali_basic").click();
  await basic.waitFor({ state: "visible", timeout: 30_000 });
}

async function readTitle(page) {
  await ensureBasicStep(page);
  return page.locator('[data-field-path="title"] input').first().inputValue();
}

async function pauseForSync(page) {
  await page.waitForTimeout(2500);
  const saveBtn = page.getByTestId("wizard-save-draft");
  if (await saveBtn.isEnabled().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }
}

async function clearDraft(page) {
  await page.getByTestId("wizard-clear-draft").click();
  const confirm = page.getByTestId("wizard-clear-draft-confirm-confirm");
  await confirm.waitFor({ state: "visible", timeout: 10_000 });
  await confirm.click();
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="wizard-clear-draft"]');
      return btn instanceof HTMLButtonElement && !btn.disabled;
    },
    { timeout: 60_000 }
  );
  await pauseForSync(page);
}

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: BASE });
const page = await context.newPage();

try {
  await loginViaBff(page);
  pass("login");

  await page.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  pass("wizard loads");

  if (await page.getByTestId("wizard-clear-draft").isVisible().catch(() => false)) {
    await clearDraft(page);
    pass("clear existing draft");
  }

  await ensureBasicStep(page);
  await fillField(page, "title", DRAFT_TITLE);
  await fillField(page, "tripDetails.overview.peakHeight", "4200");
  await fillField(page, "capacityMax", "12");
  await pauseForSync(page);
  pass("partial fill + sync");

  const titleBeforeLeave = await readTitle(page);
  if (titleBeforeLeave === DRAFT_TITLE) {
    pass("title in form before leave", titleBeforeLeave);
  } else {
    fail("title in form before leave", `expected ${DRAFT_TITLE}, got ${titleBeforeLeave}`);
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });

  const titleAfterReturn = await readTitle(page);
  if (titleAfterReturn === DRAFT_TITLE) {
    pass("resume after leave/return", titleAfterReturn);
  } else {
    fail("resume after leave/return", `expected ${DRAFT_TITLE}, got ${titleAfterReturn}`);
  }

  const peakAfterReturn = await page
    .locator('[data-field-path="tripDetails.overview.peakHeight"] input')
    .first()
    .inputValue();
  if (toAsciiDigits(peakAfterReturn) === "4200") {
    pass("peak height resumed", peakAfterReturn);
  } else {
    fail("peak height resumed", `expected 4200, got ${peakAfterReturn}`);
  }

  const updatedTitle = `${DRAFT_TITLE} Updated`;
  await ensureBasicStep(page);
  await fillField(page, "title", updatedTitle);
  await pauseForSync(page);
  await page.goto("/tours", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  const titleAfterUpdate = await readTitle(page);
  if (titleAfterUpdate === updatedTitle) {
    pass("update + resume", titleAfterUpdate);
  } else {
    fail("update + resume", `expected ${updatedTitle}, got ${titleAfterUpdate}`);
  }

  await clearDraft(page);
  const titleAfterClear = await readTitle(page);
  const peakAfterClear = await page
    .locator('[data-field-path="tripDetails.overview.peakHeight"] input')
    .first()
    .inputValue();
  if (
    (titleAfterClear.includes("تور جدید") || titleAfterClear.length < 20) &&
    peakAfterClear === ""
  ) {
    pass("clear draft resets form", `${titleAfterClear} / peak empty`);
  } else {
    fail("clear draft resets form", `title=${titleAfterClear}, peak=${peakAfterClear}`);
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  const titleAfterClearReturn = await readTitle(page);
  const peakAfterClearReturn = await page
    .locator('[data-field-path="tripDetails.overview.peakHeight"] input')
    .first()
    .inputValue();
  if (
    (titleAfterClearReturn.includes("تور جدید") || titleAfterClearReturn.length < 20) &&
    peakAfterClearReturn === ""
  ) {
    pass("cleared draft stays cleared", `${titleAfterClearReturn}`);
  } else {
    fail(
      "cleared draft stays cleared",
      `title=${titleAfterClearReturn}, peak=${peakAfterClearReturn}`
    );
  }

  const indexRes = await page.request.get(
    "/api/workspaces/ws-denali-dev/drafts?namespace=operator.wizard"
  );
  const indexBody = await indexRes.json();
  if (!indexRes.ok() || !Array.isArray(indexBody.items)) {
    fail("draft index after clear", JSON.stringify(indexBody).slice(0, 200));
  } else if (indexBody.items.length === 0) {
    pass("draft index empty after clear");
  } else if (
    indexBody.items.length === 1 &&
    indexBody.items[0]?.draftKey === "denali-create"
  ) {
    pass("draft index fresh-start row after clear (auto-persisted reset)");
  } else {
    fail("draft index after clear", JSON.stringify(indexBody).slice(0, 200));
  }
} catch (error) {
  fail("unexpected", error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---`);
if (failed.length > 0) {
  process.exit(1);
}
