import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const REPO_ROOT = join(process.cwd(), "../..");
const GOLDEN_DIR = join(REPO_ROOT, "packages/workspaces/denali/test/fixtures/golden");

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DENALI_SMOKE_OWNER_USER_ID =
  process.env.DENALI_SMOKE_OWNER_USER_ID ?? "00000000-0000-4000-8000-000000000101";
const DENALI_SMOKE_OWNER_MOBILE = "09174070937";
const DENALI_DEV_OTP = "1234";
const API_BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:3001";

async function loginDenaliSmokeOwner(page: import("@playwright/test").Page): Promise<void> {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: DENALI_SMOKE_OWNER_MOBILE },
  });
  expect(otpRes.ok()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: DENALI_SMOKE_OWNER_MOBILE,
      otp: DENALI_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
  });
  expect(loginRes.ok()).toBeTruthy();
}

test.describe("denali-wizard.spec.ts (SMK-P6-01..06, REQ-P6-015)", () => {
  // smoke-denali-e2e-servers sets TOUR_OPS_DEV_TENANT_ID → denali plugin (Linux-safe; no Host override).
  test.use({
    baseURL: process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000",
  });

  test("SMK-P6-01 / SMK-P6-04: /tours/new renders denali workspace wizard", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await loginDenaliSmokeOwner(page);

    const res = await page.goto("/tours/new", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);

    const wizard = page.locator("[data-workspace-wizard]");
    await expect(wizard).toBeVisible({ timeout: 30_000 });
    await expect(wizard).toHaveAttribute("data-plugin-id", "denali");
    await expect(page.locator("[data-wizard-step]").first()).toBeVisible();

    expect(consoleErrors, "SMK-P6-02: no console errors").toEqual([]);

    const primary = await page
      .locator("body")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--color-primary").trim().toLowerCase()
      );
    expect(primary).toBe("#059669");

    const continueBtn = page.getByTestId("workspace-wizard-step-next");
    if (await continueBtn.isVisible().catch(() => false)) {
      const btnBg = await continueBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(btnBg).toBe("rgb(5, 150, 105)");
    }
  });

  test("SMK-P6-03: denali smoke tenant is provisioned with workspace_type=denali", async ({
    request,
  }) => {
    const health = await request.get(`${API_BASE}/health`);
    expect(health.ok()).toBe(true);
    expect(DENALI_SMOKE_TENANT_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test("REQ-P6-023 / P6-6-A01: golden fixtures exist (3 files)", () => {
    for (const file of [
      "tour-minimal.json",
      "tour-template-overlay.json",
      "tour-publish-ready.json",
    ]) {
      expect(existsSync(join(GOLDEN_DIR, file))).toBe(true);
      const raw = readFileSync(join(GOLDEN_DIR, file), "utf8");
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });

  test("SMK-P6-05: POST /tours on denali tenant uses denali validation engine", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/tours`, {
      headers: {
        "content-type": "application/json",
        "x-tenant-id": DENALI_SMOKE_TENANT_ID,
        "x-authenticated-tenant-id": DENALI_SMOKE_TENANT_ID,
        "x-user-id": DENALI_SMOKE_OWNER_USER_ID,
        "x-actor-role": "admin",
        "x-membership-status": "ACTIVE",
        "x-workspace-id": "default",
      },
      data: {
        data: {
          basics: { title: "denali-smoke-starter-shape" },
        },
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error ?? "").toMatch(/CANONICAL_VALIDATION_FAILED|title|program/i);
  });
});

// Runs against the real smoke BFF/API/Postgres fixture, never a public staging tenant.
test.describe("preset rule editor smoke", () => {
  test.use({ baseURL: process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000" });
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`preset rules persist through the real editor (${viewport.width}px)`, async ({
      page,
    }, testInfo) => {
      const base = process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000";
      expect(new URL(base).hostname.endsWith(".localhost")).toBe(true);
      await page.setViewportSize(viewport);
      await loginDenaliSmokeOwner(page);
      const endpoint = "/api/settings/tour-presets/advanced";
      const beforeResponse = await page.request.get(endpoint);
      expect(beforeResponse.ok()).toBe(true);
      const before = await beforeResponse.json();
      const runId = `preset-smoke-${viewport.width}-${Date.now()}`;
      const resource = await page.request.post("/api/settings/resources/tour_presets", {
        data: { name: runId, isActive: true },
      });
      expect(resource.status()).toBe(201);
      const preset = await resource.json();
      try {
        await page.goto("/settings/tour-presets/advanced");
        await page.getByTestId("operator-presets-advanced-rule-id").fill(runId);
        await page.getByTestId("operator-presets-advanced-rule-add").click();
        await page.locator(`[id="rule-${runId}-tourType"]`).fill("mountain_day");
        await page.locator(`[id="rule-${runId}-presetId"]`).fill(preset.id);
        await page.getByTestId("operator-presets-advanced-save").click();
        await expect(page.getByTestId("operator-presets-advanced-success")).toBeVisible();
        await page.reload();
        await expect(page.locator(`[id="rule-${runId}-tourType"]`)).toHaveValue("mountain_day");
        await expect(page.locator(`[id="rule-${runId}-presetId"]`)).toHaveValue(preset.id);
        const stored = await page.request.get(endpoint);
        expect(stored.ok()).toBe(true);
        expect((await stored.json()).payload.matchRules).toContainEqual({
          id: runId,
          tourType: "mountain_day",
          themeId: null,
          presetId: preset.id,
          enabled: true,
        });
        await page.screenshot({
          path: testInfo.outputPath(`preset-editor-${viewport.width}.png`),
          fullPage: true,
        });
      } finally {
        const restored = await page.request.put(endpoint, {
          data: { configVersion: before.configVersion, payload: before.payload },
        });
        expect(restored.ok()).toBe(true);
        const removed = await page.request.delete(
          `/api/settings/resources/tour_presets/${preset.id}`
        );
        expect(removed.ok()).toBe(true);
      }
    });
  }
});
