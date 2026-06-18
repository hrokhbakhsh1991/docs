#!/usr/bin/env node
/**
 * Browser E2E verify: default category, no step-5 jump, no PATCH loop, clear draft.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000";
const OWNER_MOBILE = process.env.OPERATOR_OWNER_MOBILE ?? "+989121000001";
const OTP = "1234";
const DRAFT_TITLE = `ManualVerify ${Date.now()}`;

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

async function ensureBasicStep(page) {
  const basic = page.locator('[data-wizard-step="denali_basic"]');
  if (await basic.isVisible().catch(() => false)) return;
  await page.getByTestId("workspace-wizard-step-denali_basic").click();
  await basic.waitFor({ state: "visible", timeout: 30_000 });
}

async function readActiveStepIndex(page) {
  return page.evaluate(() => {
    const active = document.querySelector('[data-wizard-step-nav-item][data-active="true"]');
    if (active instanceof HTMLElement && active.dataset.stepIndex != null) {
      return Number(active.dataset.stepIndex);
    }
    const steps = [...document.querySelectorAll("[data-wizard-step-nav-item]")];
    const idx = steps.findIndex(
      (el) => el.getAttribute("aria-current") === "step" || el.classList.contains("is-active")
    );
    return idx >= 0 ? idx : null;
  });
}

async function readCategorySelection(page) {
  await ensureBasicStep(page);
  const mountain = page.getByTestId("denali-tour-kind-category-mountain");
  const singleDay = page.getByTestId("denali-tour-kind-duration-single_day");
  const mountainActive = await mountain.getAttribute("aria-pressed");
  const singleDayActive = await singleDay.getAttribute("aria-pressed");
  return {
    mountainActive: mountainActive === "true",
    singleDayActive: singleDayActive === "true",
  };
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

async function pauseForSync(page, ms = 2500) {
  await page.waitForTimeout(ms);
}

async function clearDraft(page) {
  await page.getByTestId("wizard-clear-draft").click();
  await page.getByTestId("wizard-clear-draft-confirm-confirm").click();
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
const pass = (name, detail = "") => {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
};
const fail = (name, detail) => {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: BASE });
const page = await context.newPage();

const patchUrls = [];
const consoleErrors = [];
page.on("request", (req) => {
  if (req.method() === "PATCH" && req.url().includes("/drafts/")) {
    patchUrls.push(req.url());
  }
});
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const text = msg.text();
    if (text.includes("7807/ingest") || /Failed to load resource.*404/.test(text)) {
      return;
    }
    consoleErrors.push(text);
  }
});

try {
  await loginViaBff(page);
  pass("login");

  await page.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  pass("wizard loads");

  if (await page.getByTestId("wizard-clear-draft").isVisible().catch(() => false)) {
    await clearDraft(page);
    pass("pre-clear existing draft");
  }

  await pauseForSync(page, 1500);
  const patchCountAfterLoad = patchUrls.length;

  const category = await readCategorySelection(page);
  if (category.mountainActive && category.singleDayActive) {
    pass("default category mountain + single_day active");
  } else {
    fail("default category mountain + single_day active", JSON.stringify(category));
  }

  const stepAfterLoad = await readActiveStepIndex(page);
  if (stepAfterLoad === 0 || stepAfterLoad === null) {
    pass("initial step is 0 (not step 5)", String(stepAfterLoad));
  } else if (stepAfterLoad === 4) {
    fail("initial step is 0 (not step 5)", `active step index=${stepAfterLoad} (step 5)`);
  } else {
    fail("initial step is 0 (not step 5)", `active step index=${stepAfterLoad}`);
  }

  await ensureBasicStep(page);
  await fillField(page, "title", DRAFT_TITLE);
  await pauseForSync(page);

  const patchAfterType = patchUrls.length - patchCountAfterLoad;
  if (patchAfterType <= 3) {
    pass("no PATCH storm after typing", `${patchAfterType} PATCH(es)`);
  } else {
    fail("no PATCH storm after typing", `${patchAfterType} PATCH(es) — possible loop`);
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await pauseForSync(page, 1500);

  const titleResumed = await page.locator('[data-field-path="title"] input').first().inputValue();
  if (titleResumed === DRAFT_TITLE) {
    pass("draft resume after navigation", titleResumed);
  } else {
    fail("draft resume after navigation", `got "${titleResumed}"`);
  }

  const stepAfterResume = await readActiveStepIndex(page);
  if (stepAfterResume !== 4) {
    pass("resume did not jump to step 5", String(stepAfterResume));
  } else {
    fail("resume did not jump to step 5", "landed on step 5");
  }

  await clearDraft(page);
  const titleAfterClear = await page.locator('[data-field-path="title"] input').first().inputValue();
  const stepAfterClear = await readActiveStepIndex(page);
  const categoryAfterClear = await readCategorySelection(page);

  if (titleAfterClear.trim().length === 0 || titleAfterClear.includes("تور")) {
    pass("clear empties title", titleAfterClear || "(empty)");
  } else {
    fail("clear empties title", titleAfterClear);
  }

  if (stepAfterClear === 0 || stepAfterClear === null) {
    pass("clear resets to step 0", String(stepAfterClear));
  } else {
    fail("clear resets to step 0", String(stepAfterClear));
  }

  if (categoryAfterClear.mountainActive && categoryAfterClear.singleDayActive) {
    pass("clear keeps default mountain_day selection");
  } else {
    fail("clear keeps default mountain_day selection", JSON.stringify(categoryAfterClear));
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await pauseForSync(page, 2000);

  const stepAfterRefresh = await readActiveStepIndex(page);
  if (stepAfterRefresh !== 4) {
    pass("refresh after clear stays off step 5", String(stepAfterRefresh));
  } else {
    fail("refresh after clear stays off step 5", "step 5");
  }

  const indexRes = await page.request.get(
    "/api/workspaces/ws-denali-dev/drafts?namespace=operator.wizard"
  );
  const indexBody = await indexRes.json();
  if (indexRes.ok() && Array.isArray(indexBody.items) && indexBody.items.length <= 1) {
    pass("draft index sane after clear", `${indexBody.items.length} item(s)`);
  } else {
    fail("draft index sane after clear", JSON.stringify(indexBody).slice(0, 200));
  }

  if (consoleErrors.length === 0) {
    pass("no console errors");
  } else {
    fail("no console errors", consoleErrors.slice(0, 5).join(" | "));
  }
} catch (error) {
  fail("unexpected", error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---`);
process.exit(failed.length > 0 ? 1 : 0);
