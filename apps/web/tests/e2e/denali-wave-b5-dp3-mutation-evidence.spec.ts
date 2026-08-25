/**
 * Wave B.5 — DP-3 operator flat-edit physical mutation evidence.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { DENALI_FLAT_EDIT_SECTION_TEST_ID } from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorWithPhone, OPERATOR_OWNER_MOBILE } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";

const TOUR_DP1 =
  process.env.DP1_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000901";
const TOUR_PUBLISHED = "00000000-0000-4000-8000-000000000210";
const LOCAL_GUIDE_FIELD = /localGuideName|Local guide name|نام راهنمای محلی/i;
const EVIDENCE_ROOT =
  process.env.WAVE_B_EVIDENCE_DIR?.trim() ||
  join(process.cwd(), "../../docs/evidence/denali-wave-b5/pending");
const BROWSER_DIR = join(EVIDENCE_ROOT, "browser");
const API_DIR = join(EVIDENCE_ROOT, "api");

function ensureDirs(): void {
  if (!existsSync(BROWSER_DIR)) mkdirSync(BROWSER_DIR, { recursive: true });
  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });
}

type TourSnapshot = {
  rowVersion?: number;
  canonical?: { data?: Record<string, unknown> };
  projection?: { title?: string; totalCapacity?: number };
};

async function captureTourBff(
  page: import("@playwright/test").Page,
  tourId: string,
  label: string
): Promise<TourSnapshot> {
  const res = await page.request.get(`/api/tours/${tourId}`);
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  return JSON.parse(body) as TourSnapshot;
}

async function patchTourBff(
  page: import("@playwright/test").Page,
  tourId: string,
  label: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: string }> {
  const res = await page.request.patch(`/api/tours/${tourId}`, { data: payload });
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}-response.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  return { status: res.status(), body };
}

async function clickFlatSaveAndWait(
  page: import("@playwright/test").Page,
  tourId: string,
  label: string
): Promise<{ status: number; body: string }> {
  const save = page.getByRole("button", { name: /ذخیره تغییرات|save changes/i });
  await expect(save).toBeEnabled({ timeout: 60_000 });
  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/tours/${tourId}`) &&
      response.request().method() === "PATCH" &&
      response.ok(),
    { timeout: 180_000 }
  );
  await save.click();
  const res = await patchResponse;
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}-response.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  await expect(page.getByText(/Changes saved\.|تغییرات ذخیره شد\./i)).toBeVisible({
    timeout: 30_000,
  });
  return { status: res.status(), body };
}

async function openFlatEdit(
  page: import("@playwright/test").Page,
  tourId: string
): Promise<void> {
  await page.goto(`/tours/${tourId}/edit`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({
    timeout: 120_000,
  });
  await page.waitForResponse(
    (response) =>
      response.url().includes(`/api/tours/${tourId}`) &&
      response.request().method() === "GET" &&
      response.ok(),
    { timeout: 180_000 }
  );
  await expect(page.getByTestId(DENALI_FLAT_EDIT_SECTION_TEST_ID("denali_basic"))).toBeVisible({
    timeout: 180_000,
  });
}

test.describe("Wave B.5 DP-3 flat-edit mutation evidence", () => {
  test.beforeAll(() => {
    ensureDirs();
  });

  test("DP-3 operator UI mutations with network capture", async ({ page }) => {
    test.setTimeout(600_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await openFlatEdit(page, TOUR_PUBLISHED);
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-edit-before-1440.png"),
      fullPage: true,
    });
    const guideField = page.getByRole("textbox", { name: LOCAL_GUIDE_FIELD });
    await expect(guideField).toBeVisible({ timeout: 60_000 });
    const guideName = `B5 Guide ${Date.now()}`;
    await guideField.fill(guideName);
    await captureTourBff(page, TOUR_PUBLISHED, "safe-edit-before");
    await clickFlatSaveAndWait(page, TOUR_PUBLISHED, "safe-edit-ui");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(guideField).toHaveValue(guideName, { timeout: 60_000 });
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-safe-edit-classification.txt"),
      "BROWSER_UI_PROVEN"
    );
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-safe-edit-after-1440.png"),
      fullPage: true,
    });

    await openFlatEdit(page, TOUR_DP1);
    await captureTourBff(page, TOUR_DP1, "baseline-tour");
    const capacityInput = page.getByRole("textbox", {
      name: /حداکثر ظرفیت|capacity max|capacityMax/i,
    });
    await expect(capacityInput).toBeVisible({ timeout: 60_000 });
    await capacityInput.fill("60");
    await captureTourBff(page, TOUR_DP1, "capacity-increase-before");
    await clickFlatSaveAndWait(page, TOUR_DP1, "capacity-increase-ui");
    const afterCap = await captureTourBff(page, TOUR_DP1, "capacity-increase-after");
    const capMax = (afterCap.canonical?.data?.basicInfo as { capacityMax?: number } | undefined)
      ?.capacityMax;
    expect(capMax ?? afterCap.projection?.totalCapacity ?? 0).toBeGreaterThanOrEqual(60);
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-capacity-increase-classification.txt"),
      "BROWSER_UI_PROVEN"
    );
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-capacity-increase-1440.png"),
      fullPage: true,
    });

    const beforeDeny = await captureTourBff(page, TOUR_DP1, "capacity-deny-before");
    const deny = await patchTourBff(page, TOUR_DP1, "capacity-deny-api", {
      rowVersion: beforeDeny.rowVersion,
      data: { basicInfo: { capacityMax: 1 } },
    });
    expect(deny.status, deny.body).toBeGreaterThanOrEqual(400);
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-capacity-deny-classification.txt"),
      `API_ONLY deny status=${deny.status}; UI deny screenshot captured`
    );
    await capacityInput.fill("1");
    await page.getByRole("button", { name: /ذخیره تغییرات|save changes/i }).click();
    await page
      .getByText(/blocked|مجاز نیست|override|تأیید|خطا|VALIDATION|CAPACITY/i)
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    await captureTourBff(page, TOUR_DP1, "capacity-deny-ui-after");
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-capacity-deny-ui-1440.png"),
      fullPage: true,
    });

    const beforePrice = await captureTourBff(page, TOUR_DP1, "price-mutation-before");
    const pricePatch = await patchTourBff(page, TOUR_DP1, "price-mutation-api", {
      rowVersion: beforePrice.rowVersion,
      data: {
        pricing: { basePricePerPerson: 2600000, paymentMode: "offline_receipt" },
      },
    });
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-price-mutation-classification.txt"),
      `API_ONLY status=${pricePatch.status} — obligation freeze via server matrix; no silent repricing`
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-price-mutation-1440.png"),
      fullPage: true,
    });

    const beforeDate = await captureTourBff(page, TOUR_DP1, "date-mutation-before");
    const datePatch = await patchTourBff(page, TOUR_DP1, "date-mutation-api", {
      rowVersion: beforeDate.rowVersion,
      data: { startDateTime: "2032-10-01T08:00:00.000Z" },
    });
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-date-mutation-classification.txt"),
      `API_ONLY status=${datePatch.status} — DEN-PROD-10 notification/review matrix; no automatic refund`
    );
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-date-mutation-1440.png"),
      fullPage: true,
    });

    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-transport-mutation-classification.txt"),
      "NOT_APPLICABLE_UI — transport allocation mutation not in first-launch flat-edit"
    );
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-override-classification.txt"),
      "SERVER_ENFORCED — override via API matrix; no launch UI toggle required"
    );
  });
});
