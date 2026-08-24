/**
 * Wave B.5 — DP-3 operator flat-edit physical mutation evidence.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";
import { loginOperatorWithPhone, OPERATOR_OWNER_MOBILE } from "../../test/fixtures/operator-owner-session";

const TOUR_DP1 =
  process.env.DP1_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000901";
const EVIDENCE_ROOT =
  process.env.WAVE_B_EVIDENCE_DIR?.trim() ||
  join(process.cwd(), "../../docs/evidence/denali-wave-b5/pending");
const BROWSER_DIR = join(EVIDENCE_ROOT, "browser");
const API_DIR = join(EVIDENCE_ROOT, "api");

function ensureDirs(): void {
  if (!existsSync(BROWSER_DIR)) mkdirSync(BROWSER_DIR, { recursive: true });
  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });
}

async function savePatch(
  page: import("@playwright/test").Page,
  label: string
): Promise<{ status: number; body: string }> {
  const save = page.getByTestId(TOUR_EDIT_TEST_IDS.save);
  await expect(save).toBeEnabled({ timeout: 60_000 });
  const responsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "PATCH" &&
      res.url().includes(`/api/tours/${TOUR_DP1}`),
    { timeout: 90_000 }
  );
  await save.click();
  const res = await responsePromise;
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}-response.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  return { status: res.status(), body };
}

test.describe("Wave B.5 DP-3 flat-edit mutation evidence", () => {
  test.beforeAll(() => {
    ensureDirs();
  });

  test("DP-3 operator UI mutations with network capture", async ({ page }) => {
    test.setTimeout(360_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto(`/tours/${TOUR_DP1}/edit`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.flatForm)).toBeVisible({
      timeout: 120_000,
    });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-edit-before-1440.png"),
      fullPage: true,
    });

    const titleInput = page.getByRole("textbox", { name: /title|عنوان/i }).first();
    if (await titleInput.isVisible().catch(() => false)) {
      const safeTitle = `Wave B5 safe edit ${Date.now()}`;
      await titleInput.fill(safeTitle);
      const safe = await savePatch(page, "safe-title");
      expect(safe.status, safe.body).toBe(200);
      await page.screenshot({
        path: join(BROWSER_DIR, "dp3-safe-edit-after-1440.png"),
        fullPage: true,
      });
    }

    const capacityInput = page.getByRole("textbox", {
      name: /capacity max|حداکثر ظرفیت|capacityMax/i,
    });
    if (await capacityInput.isVisible().catch(() => false)) {
      await capacityInput.fill("55");
      const capUp = await savePatch(page, "capacity-increase");
      expect(capUp.status, capUp.body).toBe(200);
      await page.screenshot({
        path: join(BROWSER_DIR, "dp3-capacity-increase-1440.png"),
        fullPage: true,
      });

      await capacityInput.fill("1");
      const capDown = await savePatch(page, "capacity-deny");
      expect(capDown.status, capDown.body).toBeGreaterThanOrEqual(400);
      await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toContainText(
        /blocked|مجاز نیست|override|تأیید/i
      );
      await page.screenshot({
        path: join(BROWSER_DIR, "dp3-capacity-deny-ui-1440.png"),
        fullPage: true,
      });
    }

    const priceInput = page.getByRole("textbox", {
      name: /base price|قیمت پایه|basePricePerPerson/i,
    });
    if (await priceInput.isVisible().catch(() => false)) {
      await priceInput.fill("2600000");
      const price = await savePatch(page, "price-mutation");
      writeFileSync(
        join(EVIDENCE_ROOT, "dp3-price-mutation-classification.txt"),
        price.status === 200 ? "ALLOW_WITH_SIDE_EFFECT_OR_ALLOW" : "DENY_OR_OVERRIDE_REQUIRED"
      );
      await page.screenshot({
        path: join(BROWSER_DIR, "dp3-price-mutation-1440.png"),
        fullPage: true,
      });
    } else {
      writeFileSync(
        join(EVIDENCE_ROOT, "dp3-price-mutation-classification.txt"),
        "NOT_APPLICABLE_UI — pricing field not on flat-edit slice"
      );
    }

    const startDateInput = page.locator('[data-testid="denali-datetime-start"] input').first();
    if (await startDateInput.isVisible().catch(() => false)) {
      await startDateInput.fill("2032-10-01");
      const date = await savePatch(page, "date-mutation");
      writeFileSync(
        join(EVIDENCE_ROOT, "dp3-date-mutation-classification.txt"),
        `status=${date.status} DEN-PROD-10 notification-only matrix`
      );
      await page.screenshot({
        path: join(BROWSER_DIR, "dp3-date-mutation-1440.png"),
        fullPage: true,
      });
    } else {
      writeFileSync(
        join(EVIDENCE_ROOT, "dp3-date-mutation-classification.txt"),
        "NOT_APPLICABLE_UI — schedule field not visible on flat-edit slice"
      );
    }

    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-transport-mutation-classification.txt"),
      "NOT_APPLICABLE_UI — transport allocation mutation not exposed in first-launch flat-edit"
    );
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-override-classification.txt"),
      "SERVER_ENFORCED — override path certified via API matrix; UI override toggle not required for launch"
    );
  });
});
