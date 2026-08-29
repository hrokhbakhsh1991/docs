/**
 * Users member detail — loyalty tier selector responsive regression.
 */
import { expect, test } from "@playwright/test";

import { USERS_DIRECTORY_TEST_IDS } from "../src/features/users/users-directory-types";
import {
  loginOperatorOwner,
  OPERATOR_ADMIN_DISPLAY_NAME,
  OPERATOR_MEMBER_DISPLAY_NAME,
} from "./fixtures/operator-owner-session";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 768 },
  { label: "768", width: 768, height: 1024 },
  { label: "390", width: 390, height: 844 },
] as const;

type DirectoryUser = {
  readonly role: string;
  readonly displayName: string;
  readonly phone: string | null;
};

async function resolveEditableMemberNeedle(page: import("@playwright/test").Page): Promise<string> {
  const usersRes = await page.request.get("/api/users?limit=100&sort=name_asc");
  expect(usersRes.ok(), await usersRes.text()).toBeTruthy();
  const payload = (await usersRes.json()) as { items: readonly DirectoryUser[] };
  const editable =
    payload.items.find((user) => user.role === "member") ??
    payload.items.find((user) => user.role === "admin") ??
    payload.items.find((user) => user.role === "viewer");
  if (editable === undefined) {
    return "";
  }
  if (editable.displayName.trim().length > 0) {
    return editable.displayName;
  }
  return editable.phone ?? "";
}

async function openMemberDetailForRewards(page: import("@playwright/test").Page) {
  await page.goto("/users", { waitUntil: "networkidle" });
  await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.page)).toBeVisible({ timeout: 20_000 });

  const needle =
    (await resolveEditableMemberNeedle(page)) ||
    OPERATOR_MEMBER_DISPLAY_NAME ||
    OPERATOR_ADMIN_DISPLAY_NAME;
  test.skip(needle.length === 0, "No editable non-owner member in roster seed");

  const searchInput = page.getByPlaceholder(/Search by name or phone|جستجو/i);
  await searchInput.fill(needle);
  await page.waitForTimeout(400);

  const memberRow = page.locator("tr").filter({ hasText: needle });
  await expect(memberRow).toBeVisible({ timeout: 15_000 });
  await memberRow.getByTestId(USERS_DIRECTORY_TEST_IDS.rowDetails).click();
  await expect(page.getByTestId(USERS_DIRECTORY_TEST_IDS.memberDetail)).toBeVisible({
    timeout: 10_000,
  });
  const loyaltyFieldset = page.getByTestId(USERS_DIRECTORY_TEST_IDS.rewardsLoyaltyTier);
  await loyaltyFieldset.scrollIntoViewIfNeeded();
  await expect(loyaltyFieldset).toBeVisible({ timeout: 10_000 });
}

async function readLoyaltyMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const fieldset = document.querySelector('[data-testid="operator-users-rewards-loyalty-tier"]');
    const radios = fieldset?.querySelectorAll('input[type="radio"]') ?? [];
    const labels = fieldset?.querySelectorAll("label") ?? [];
    const doc = document.documentElement;
    const overlaps: string[] = [];

    for (const radio of radios) {
      const radioRect = radio.getBoundingClientRect();
      const label = radio.closest("label");
      const text = label?.querySelector("span.min-w-0");
      if (!text) continue;
      const textRect = text.getBoundingClientRect();
      const horizontalOverlap =
        radioRect.right > textRect.left + 4 && radioRect.left < textRect.right;
      const verticalOverlap =
        radioRect.bottom > textRect.top + 2 && radioRect.top < textRect.bottom - 2;
      if (horizontalOverlap && verticalOverlap) {
        overlaps.push(text.textContent?.slice(0, 40) ?? "unknown");
      }
    }

    const radioSizes = [...radios].map((radio) => {
      const rect = radio.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });

    return {
      docOverflow: doc.scrollWidth > doc.clientWidth,
      optionCount: labels.length,
      radioSizes,
      overlaps,
      legendText: fieldset?.querySelector("legend")?.textContent?.trim() ?? "",
    };
  });
}

test.describe("users-loyalty-detail-responsive", () => {
  test("WEB-USERS-LOY-UI layout @ all breakpoints", async ({ page }) => {
    await loginOperatorOwner(page);
    await openMemberDetailForRewards(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(200);
      const metrics = await readLoyaltyMetrics(page);

      expect(metrics.docOverflow, `doc overflow @ ${viewport.label}`).toBe(false);
      expect(metrics.optionCount, `options @ ${viewport.label}`).toBe(3);
      expect(metrics.overlaps, `radio/text overlap @ ${viewport.label}`).toEqual([]);
      expect(metrics.legendText, `legend @ ${viewport.label}`).toBe("سطح وفاداری");

      for (const size of metrics.radioSizes) {
        expect(size.width, `radio width @ ${viewport.label}`).toBeLessThanOrEqual(20);
        expect(size.height, `radio height @ ${viewport.label}`).toBeLessThanOrEqual(20);
      }

      await page.screenshot({
        path: `/opt/cursor/artifacts/users-loyalty-detail-${viewport.label}.png`,
        fullPage: false,
      });
    }

    const vipOption = page.getByRole("radio", { name: /VIP/i });
    await vipOption.click();
    await expect(vipOption).toBeChecked();
    await page.screenshot({
      path: `/opt/cursor/artifacts/users-loyalty-detail-selected-1440.png`,
      fullPage: false,
    });
  });
});
