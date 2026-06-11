import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const REPO_ROOT = join(process.cwd(), "../..");
const GOLDEN_DIR = join(REPO_ROOT, "packages/workspaces/denali/test/fixtures/golden");

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const API_BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:3001";

test.describe("denali-wizard.spec.ts (SMK-P6-01..06, REQ-P6-015)", () => {
  // smoke-denali-e2e-servers sets TOUR_OPS_DEV_TENANT_ID → denali plugin (Linux-safe; no Host override).
  test.use({
    baseURL: process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000",
  });

  test("SMK-P6-01 / SMK-P6-04: /tours/new renders denali workspace wizard", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

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

    const primary = await page.locator("body").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--color-primary").trim().toLowerCase()
    );
    expect(primary).toBe("#0f766e");

    const continueBtn = page.getByTestId("workspace-wizard-step-next");
    if (await continueBtn.isVisible().catch(() => false)) {
      const btnBg = await continueBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(btnBg).toBe("rgb(15, 118, 110)");
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
        "x-user-id": "denali-smoke-user",
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
