#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

mkdirSync("/opt/cursor/artifacts", { recursive: true });

const browser = await chromium.launch();
const baseURL = process.env.SMOKE_MARKETING_BASE_URL ?? "http://denali.localhost:3002";

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["mobile", devices["iPhone 13"].viewport],
]) {
  const context = await browser.newContext({ baseURL, viewport });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });
  await page.screenshot({
    path: `/opt/cursor/artifacts/landing-audit-${name}-hero.png`,
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height ?? 900, 900) },
  });
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `/opt/cursor/artifacts/landing-audit-${name}-programs.png`,
  });
  await page.screenshot({
    path: `/opt/cursor/artifacts/landing-audit-${name}-full.png`,
    fullPage: true,
  });
  await context.close();
}

await browser.close();
console.log("landing audit screenshots saved");
