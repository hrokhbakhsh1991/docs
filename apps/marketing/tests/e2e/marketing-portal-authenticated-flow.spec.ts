/**
 * Full local acceptance — authenticated session across marketing ↔ portal
 * (profile SSR, registration intake, refresh, new tab, logout).
 */
import { expect, test } from "@playwright/test";

import {
  authenticateMemberViaPortal,
  readSessionCookieMetadata,
  resolveMarketingBaseUrl,
  resolvePortalBaseUrl,
  resolveSmokeTourId,
} from "./fixtures/portal-session-bridge";

const MARKETING_BASE = resolveMarketingBaseUrl();
const PORTAL_BASE = resolvePortalBaseUrl();
const TOUR_ID = resolveSmokeTourId();
const MARKETING_HOME = "/";
const MARKETING_PDP = `/tours/${TOUR_ID}`;

test.describe("marketing-portal authenticated flow (denali local)", () => {
  test("REG-MKT-FLOW-01 full bridge: header → tour CTA → intake → profile → refresh → logout", async ({
    page,
    context,
  }) => {
    await authenticateMemberViaPortal(page);

    const cookie = await readSessionCookieMetadata(context);
    expect(cookie).not.toBeNull();
    expect(cookie?.name).toBe("atour_mb_session");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.secure).toBe(false);

    // 2–3. Marketing home — authenticated header
    await page.goto(MARKETING_HOME, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-marketing-login]")).toHaveCount(0);

    // 4–7. Tour PDP → register intake (no re-login)
    await page.goto(MARKETING_PDP, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
      timeout: 60_000,
    });

    const registerCta = page
      .locator(
        "[data-marketing-catalog-detail-sticky-cta] [data-marketing-register], [data-marketing-register]"
      )
      .first();
    await expect(registerCta).toBeVisible({ timeout: 60_000 });

    await Promise.all([
      page.waitForURL(/\/catalog\/[^/]+\/register/, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      }),
      registerCta.click(),
    ]);

    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator('[data-registration-resume="intake"]').first()).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.locator("[data-portal-register-auth-gate]")).toHaveCount(0);
    await expect(page.locator("[data-public-registration-intake]")).toBeVisible({
      timeout: 60_000,
    });

    // Profile has real content
    await page.goto(`${PORTAL_BASE}/me/profile`, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("main[data-portal-member-profile]")).toBeVisible();
    await expect(page.locator('[data-member-profile-field="displayName"] input')).not.toHaveValue(
      ""
    );
    await expect(page.locator('main[data-portal-member-profile] [role="alert"]')).toHaveCount(0);

    // 8. Refresh marketing + portal
    await page.goto(MARKETING_HOME, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
      timeout: 60_000,
    });

    await page.goto(`${PORTAL_BASE}/me/profile`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("main[data-portal-member-profile]")).toBeVisible();

    // 9. New tab shares session
    const secondTab = await context.newPage();
    await secondTab.goto(MARKETING_HOME, { waitUntil: "domcontentloaded" });
    await expect(secondTab.locator("[data-marketing-member-authenticated]")).toBeVisible({
      timeout: 60_000,
    });
    await secondTab.close();

    // 10–11. Logout from portal profile
    const logoutButton = page.locator(
      '[data-public-auth-logout][data-public-auth-logout-ready="true"]'
    );
    await expect(logoutButton.first()).toBeVisible({ timeout: 30_000 });
    const [logoutResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" && res.url().includes("/api/public-auth/logout"),
        { timeout: 60_000 }
      ),
      logoutButton.first().click(),
    ]);
    expect(logoutResponse.ok(), `logout failed (${logoutResponse.status()})`).toBeTruthy();
    await page.waitForURL(new RegExp(`${new URL(MARKETING_BASE).hostname}`), {
      timeout: 60_000,
    });

    await expect(page.locator("[data-marketing-member-authenticated]")).toHaveCount(0, {
      timeout: 30_000,
    });

    await page.goto(`${PORTAL_BASE}/me/profile`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });

    await page.goto(`${PORTAL_BASE}/catalog/${TOUR_ID}/register`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("[data-portal-register-auth-gate]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('[data-registration-resume="intake"]')).toHaveCount(0);
  });
});
