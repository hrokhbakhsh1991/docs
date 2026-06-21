#!/usr/bin/env node
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000";
const TITLE = `API Draft ${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();

const otp = await page.request.post("/api/auth/request-otp", {
  data: { phone: "+989121000001" },
});
const { challenge_id } = await otp.json();
await page.request.post("/api/auth/login-web-session", {
  data: { phone: "+989121000001", otp: "1234", challenge_id },
});

const envelope = {
  form: {
    data: {
      title: TITLE,
      publishStatus: "draft",
    },
  },
  meta: {
    currentStepIndex: 0,
    wizardSessionId: "e2e-session",
  },
};

const patch = await page.request.patch(
  "/api/workspaces/ws-denali-dev/drafts/operator.wizard/denali-create",
  {
    data: {
      data: envelope,
      version: 0,
      schemaVersion: 1,
      lastModified: Date.now(),
    },
  }
);
console.log("PATCH", patch.status(), await patch.text());

await page.goto("/tours/new");
await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(3000);
const titleInput = page.locator('[data-field-path="title"] input').first();
const onBasic = await page.locator('[data-wizard-step="denali_basic"]').isVisible().catch(() => false);
console.log("on basic step?", onBasic);
if (!onBasic) {
  const step = await page.locator("[data-wizard-step]").first().getAttribute("data-wizard-step");
  console.log("current step", step);
  const basicBtn = page.getByTestId("workspace-wizard-step-denali_basic");
  if (await basicBtn.isEnabled().catch(() => false)) await basicBtn.click();
}
await titleInput.waitFor({ state: "visible", timeout: 60_000 });
const title = await titleInput.inputValue();
console.log("UI title after API seed", title);
console.log("match?", title === TITLE);

await page.goto("/dashboard");
await page.goto("/tours/new");
await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(2000);
const titleInput2 = page.locator('[data-field-path="title"] input').first();
if (!(await titleInput2.isVisible().catch(() => false))) {
  const basicBtn = page.getByTestId("workspace-wizard-step-denali_basic");
  if (await basicBtn.isEnabled().catch(() => false)) await basicBtn.click();
}
await titleInput2.waitFor({ state: "visible", timeout: 60_000 });
const title2 = await titleInput2.inputValue();
console.log("UI title after leave/return", title2);

await page.getByTestId("wizard-clear-draft").click();
const clearConfirm = page.getByTestId("wizard-clear-draft-confirm-confirm");
await clearConfirm.waitFor({ state: "visible", timeout: 10_000 });
await clearConfirm.click();
await page.waitForTimeout(5000);
const title3 = await page.locator('[data-field-path="title"] input').first().inputValue();
console.log("UI title after clear", title3);
const index = await page.request.get(
  "/api/workspaces/ws-denali-dev/drafts?namespace=operator.wizard"
);
console.log("index after clear", await index.text());

await browser.close();
