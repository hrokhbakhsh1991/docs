#!/usr/bin/env node
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
const patches = [];
page.on("request", (r) => {
  if (r.method() === "PATCH") patches.push(r.url());
});

const otp = await page.request.post("/api/auth/request-otp", {
  data: { phone: "09174070937" },
});
const { challenge_id } = await otp.json();
await page.request.post("/api/auth/login-web-session", {
  data: { phone: "09174070937", otp: "1234", challenge_id },
});

await page.goto("/tours/new");
await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
await page.locator('[data-wizard-step="denali_basic"]').waitFor({ state: "visible", timeout: 60_000 });

const input = page.locator('[data-field-path="title"] input').first();
await input.waitFor({ state: "visible" });
console.log("input disabled?", await input.isDisabled());
await input.fill("Saved Title Test");
console.log("value after fill", await input.inputValue());
await page.waitForTimeout(3000);
console.log(
  "status before save",
  await page.locator('[data-testid="draft-sync-indicator"]').getAttribute("data-status").catch(() => "none")
);
await page.getByTestId("wizard-save-draft").click();
await page.waitForTimeout(6000);
console.log(
  "status after save",
  await page.locator('[data-testid="draft-sync-indicator"]').getAttribute("data-status").catch(() => "none")
);
console.log("chrome", (await page.locator("[data-draft-sync-chrome]").innerText()).slice(0, 300));
console.log("patches", patches);
const get = await page.request.get(
  "/api/workspaces/ws-denali-dev/drafts/operator.wizard/denali-create"
);
console.log("GET", get.status(), (await get.text()).slice(0, 500));
await browser.close();
