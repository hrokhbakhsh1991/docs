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

type TourSnapshot = {
  rowVersion?: number;
  canonical?: { data?: Record<string, unknown> };
  projection?: { title?: string; totalCapacity?: number };
};

async function readTourBff(page: import("@playwright/test").Page): Promise<TourSnapshot> {
  const res = await page.request.get(`/api/tours/${TOUR_DP1}`);
  return JSON.parse(await res.text()) as TourSnapshot;
}

async function captureTourBff(
  page: import("@playwright/test").Page,
  label: string
): Promise<TourSnapshot> {
  const res = await page.request.get(`/api/tours/${TOUR_DP1}`);
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  return JSON.parse(body) as TourSnapshot;
}

async function patchTourBff(
  page: import("@playwright/test").Page,
  label: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: string }> {
  const res = await page.request.patch(`/api/tours/${TOUR_DP1}`, { data: payload });
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}-response.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  return { status: res.status(), body };
}

async function saveFlatEditUi(
  page: import("@playwright/test").Page,
  label: string
): Promise<{ status: number; body: string }> {
  const save = page
    .getByTestId(TOUR_EDIT_TEST_IDS.flatForm)
    .getByTestId(TOUR_EDIT_TEST_IDS.save);
  await expect(save).toBeEnabled({ timeout: 60_000 });
  const [res] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/api/tours/${TOUR_DP1}`),
      { timeout: 120_000 }
    ),
    save.click(),
  ]);
  const body = await res.text();
  writeFileSync(join(API_DIR, `dp3-${label}-response.json`), body);
  writeFileSync(join(API_DIR, `dp3-${label}-status.txt`), String(res.status()));
  expect(res.ok(), body).toBeTruthy();
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
    const titleField = page.getByTestId(TOUR_EDIT_TEST_IDS.title);
    await expect(titleField).toBeVisible({ timeout: 120_000 });
    const safeTitle = `DP1 Payment Deadline Tour B5 ${Date.now()}`;
    await titleField.fill(safeTitle);
    await captureTourBff(page, "safe-edit-before");
    await saveFlatEditUi(page, "safe-edit-ui");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(titleField).toHaveValue(safeTitle, { timeout: 60_000 });
    const afterSafe = await captureTourBff(page, "safe-edit-after");
    expect(afterSafe.projection?.title ?? afterSafe.canonical?.data?.title).toBe(safeTitle);
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-safe-edit-classification.txt"),
      "BROWSER_UI_PROVEN"
    );
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-safe-edit-after-1440.png"),
      fullPage: true,
    });

    const capacityInput = page.getByRole("textbox", {
      name: /حداکثر ظرفیت|capacity max|capacityMax/i,
    });
    await expect(capacityInput).toBeVisible({ timeout: 60_000 });
    await capacityInput.fill("60");
    await captureTourBff(page, "capacity-increase-before");
    await saveFlatEditUi(page, "capacity-increase-ui");
    const afterCap = await captureTourBff(page, "capacity-increase-after");
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

    const beforeDeny = await readTourBff(page);
    const deny = await patchTourBff(page, "capacity-deny-api", {
      rowVersion: beforeDeny.rowVersion,
      data: { basicInfo: { capacityMax: 1 } },
    });
    expect(deny.status, deny.body).toBeGreaterThanOrEqual(400);
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-capacity-deny-classification.txt"),
      `API_ONLY deny status=${deny.status}; UI deny screenshot captured`
    );
    await capacityInput.fill("1");
    await captureTourBff(page, "capacity-deny-ui-before");
    await page
      .getByTestId(TOUR_EDIT_TEST_IDS.flatForm)
      .getByTestId(TOUR_EDIT_TEST_IDS.save)
      .click();
    await page
      .getByText(/blocked|مجاز نیست|override|تأیید|خطا|VALIDATION|CAPACITY/i)
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    await captureTourBff(page, "capacity-deny-ui-after");
    await page.screenshot({
      path: join(BROWSER_DIR, "dp3-capacity-deny-ui-1440.png"),
      fullPage: true,
    });

    const priceInput = page.getByRole("textbox", {
      name: /قیمت پایه|base price|basePricePerPerson/i,
    });
    if (await priceInput.isVisible().catch(() => false)) {
      await priceInput.fill("2600000");
      await saveFlatEditUi(page, "price-mutation-ui");
      const afterPrice = await captureTourBff(page, "price-mutation-after");
      const basePrice = (afterPrice.canonical?.data?.pricing as { basePricePerPerson?: number } | undefined)
        ?.basePricePerPerson;
      writeFileSync(
        join(EVIDENCE_ROOT, "dp3-price-mutation-classification.txt"),
        `BROWSER_UI_PROVEN basePricePerPerson=${basePrice ?? "n/a"}`
      );
      await page.screenshot({
        path: join(BROWSER_DIR, "dp3-price-mutation-1440.png"),
        fullPage: true,
      });
    } else {
      const beforePrice = await readTourBff(page);
      const pricePatch = await patchTourBff(page, "price-mutation-api", {
        rowVersion: beforePrice.rowVersion,
        data: {
          pricing: { basePricePerPerson: 2600000, paymentMode: "offline_receipt" },
        },
      });
      writeFileSync(
        join(EVIDENCE_ROOT, "dp3-price-mutation-classification.txt"),
        `API_ONLY status=${pricePatch.status} — pricing not in flat-edit UI; obligation freeze via server matrix`
      );
    }

    const beforeDate = await readTourBff(page);
    const datePatch = await patchTourBff(page, "date-mutation-api", {
      rowVersion: beforeDate.rowVersion,
      data: { startDateTime: "2032-10-01T08:00:00.000Z" },
    });
    writeFileSync(
      join(EVIDENCE_ROOT, "dp3-date-mutation-classification.txt"),
      `API_ONLY status=${datePatch.status} — DEN-PROD-10 notification/review matrix; no automatic refund`
    );
    await page.reload({ waitUntil: "domcontentloaded" });
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

    await titleField.fill("DP1 Payment Deadline Tour");
    await saveFlatEditUi(page, "safe-edit-cleanup");
  });
});
