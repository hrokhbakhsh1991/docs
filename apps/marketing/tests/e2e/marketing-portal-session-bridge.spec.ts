/**
 * Marketing ↔ Portal session bridge regressions (PCMS / DG-4.7.2).
 *
 * Reproduces the user-reported failure class:
 * Marketing header authenticated → registration CTA → standalone Portal /login.
 *
 * Requires smoke stack with matched jwtEnv (smoke-marketing-e2e-servers.mjs).
 */
import { expect, test } from "@playwright/test";

import {
  assertNoStandaloneLogin,
  authenticateMemberViaPortal,
  readSessionCookieMetadata,
  resolveMarketingBaseUrl,
  resolvePortalBaseUrl,
  resolveSessionCookieDomainSuffix,
  resolveSmokeTourId,
} from "./fixtures/portal-session-bridge";

const TOUR_ID = resolveSmokeTourId();
const MARKETING_PDP = `/tours/${TOUR_ID}`;
const PORTAL_BASE = resolvePortalBaseUrl();
const SESSION_COOKIE_DOMAIN = resolveSessionCookieDomainSuffix();

async function scrollTourDetailCtaIntoView(page: import("@playwright/test").Page): Promise<void> {
  await page.locator("[data-marketing-catalog-tour-detail]").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

async function resolveVisibleGuestRegisterCta(
  page: import("@playwright/test").Page
): Promise<import("@playwright/test").Locator> {
  await scrollTourDetailCtaIntoView(page);
  const rail = page.locator(
    "[data-marketing-catalog-detail-booking-rail-cta] [data-marketing-register][data-marketing-register-ready='true']"
  );
  const sticky = page.locator(
    "[data-marketing-catalog-detail-sticky-cta] [data-marketing-register][data-marketing-register-ready='true']"
  );
  const primary = page.locator(
    "[data-marketing-catalog-detail-cta-primary] [data-marketing-register][data-marketing-register-ready='true']"
  );
  for (const candidate of [sticky, primary, rail]) {
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }
  const fallback = page.locator("[data-marketing-register][data-marketing-register-ready='true']");
  const count = await fallback.count();
  for (let i = 0; i < count; i++) {
    const candidate = fallback.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  if (count > 0) {
    return fallback.first();
  }
  return page.locator("[data-marketing-register]").first();
}

async function resolveVisibleAuthenticatedRegisterCta(
  page: import("@playwright/test").Page
): Promise<import("@playwright/test").Locator> {
  await scrollTourDetailCtaIntoView(page);
  const mode = await page
    .locator("[data-marketing-tour-detail-cta-mode]")
    .first()
    .getAttribute("data-marketing-tour-detail-cta-mode");

  if (mode === "member-self") {
    const stickyAnother = page.locator(
      "[data-marketing-catalog-detail-sticky-cta] [data-marketing-register-another]"
    );
    if (await stickyAnother.first().isVisible().catch(() => false)) {
      return stickyAnother.first();
    }
    const another = page.locator("[data-marketing-register-another]").first();
    if (await another.isVisible().catch(() => false)) {
      return another;
    }
  }

  const sticky = page.locator("[data-marketing-catalog-detail-sticky-cta] [data-marketing-register]");
  if (await sticky.first().isVisible().catch(() => false)) {
    return sticky.first();
  }
  const rail = page.locator(
    "[data-marketing-catalog-detail-booking-rail-cta] [data-marketing-register]"
  );
  if (await rail.first().isVisible().catch(() => false)) {
    return rail.first();
  }
  return page.locator("[data-marketing-register]").first();
}

async function resolveVisibleViewRegistrationCta(
  page: import("@playwright/test").Page
): Promise<import("@playwright/test").Locator | null> {
  const links = page.locator("[data-marketing-view-registration]");
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    if (await link.isVisible().catch(() => false)) {
      return link;
    }
  }
  return null;
}

for (const viewport of [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 375, height: 812 },
] as const) {
  test.describe(`marketing-portal-session-bridge (${viewport.label})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`REG-MKT-PTL-01 portal-first auth → marketing register CTA → intake (${viewport.label})`, async ({
      page,
      context,
    }) => {
      await authenticateMemberViaPortal(page);
      const cookie = await readSessionCookieMetadata(context);
      expect(cookie).not.toBeNull();
      expect(cookie?.name).toBe("atour_mb_session");
      expect(cookie?.domain).toMatch(new RegExp(`${SESSION_COOKIE_DOMAIN.replace(/\./g, "\\.")}$`));

      await page.goto(MARKETING_PDP, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
        timeout: 120_000,
      });

      const ctaMode = await page
        .locator("[data-marketing-tour-detail-cta-mode]")
        .first()
        .getAttribute("data-marketing-tour-detail-cta-mode");
      expect(ctaMode).toMatch(/member-(continue|self)/);

      const registerLink = await resolveVisibleAuthenticatedRegisterCta(page);
      await expect(registerLink).toBeVisible({ timeout: 30_000 });

      const chain: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) chain.push(frame.url());
      });

      await Promise.all([
        page.waitForURL(/\/catalog\/[^/]+\/register/, {
          waitUntil: "domcontentloaded",
          timeout: 120_000,
        }),
        registerLink.click(),
      ]);

      await assertNoStandaloneLogin(page);
      await expect(page.locator("[data-registration-resume='intake']")).toBeVisible({
        timeout: 120_000,
      });
      await expect(page.locator("[data-public-registration-intake]")).toBeVisible({
        timeout: 60_000,
      });
      expect(chain.some((url) => /\/login/.test(url))).toBe(false);
    });

    test(`REG-MKT-PTL-02 authenticated /me/registrations — no login redirect (${viewport.label})`, async ({
      page,
    }) => {
      await authenticateMemberViaPortal(page);
      await page.goto(MARKETING_PDP, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
        timeout: 120_000,
      });

      const viewSelf = await resolveVisibleViewRegistrationCta(page);
      if (viewSelf === null) {
        test.skip(true, "member-self CTA not present for this tour/member");
      }

      await viewSelf.scrollIntoViewIfNeeded();
      await Promise.all([
        page.waitForURL(/\/me\/registrations\//, {
          waitUntil: "domcontentloaded",
          timeout: 120_000,
        }),
        viewSelf.click(),
      ]);

      await assertNoStandaloneLogin(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 120_000 });
    });

    test(`REG-MKT-PTL-03 anonymous register CTA opens modal — never standalone /login (${viewport.label})`, async ({
      page,
      context,
    }) => {
      await context.clearCookies();
      await page.goto(MARKETING_PDP, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
        timeout: 120_000,
      });
      await expect(page.locator("[data-marketing-member-authenticated]")).toHaveCount(0);

      const registerCta = await resolveVisibleGuestRegisterCta(page);
      await expect(registerCta).toHaveAttribute("data-marketing-register-ready", "true", {
        timeout: 60_000,
      });
      await registerCta.evaluate((el) => {
        (el as HTMLAnchorElement).click();
      });

      const marketingModal = page.locator('[data-marketing-login-modal-open="true"]');
      if (await marketingModal.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await expect(page).toHaveURL(new RegExp(`/tours/${TOUR_ID}`));
      } else if (page.url().includes("auth=login")) {
        await expect(marketingModal).toBeVisible({ timeout: 60_000 });
        await expect(page).toHaveURL(new RegExp(`/tours/${TOUR_ID}`));
      } else {
        await expect(page).toHaveURL(/\/catalog\/[^/]+\/register/, { timeout: 60_000 });
        await expect(
          page.locator(
            "[data-portal-register-guest-auth='modal-first'], dialog[open][data-portal-login-modal-open='true']"
          )
        ).toBeVisible({ timeout: 60_000 });
      }
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.locator("[data-portal-login-full-page]")).toHaveCount(0);
    });

    test(`REG-MKT-PTL-04 cookie shared marketing ↔ portal on same tenant domain (${viewport.label})`, async ({
      page,
      context,
    }) => {
      await authenticateMemberViaPortal(page);
      const marketingHost = new URL(resolveMarketingBaseUrl()).hostname;
      const portalHost = new URL(PORTAL_BASE).hostname;
      const marketingCookies = await context.cookies(`http://${marketingHost}:3002`);
      const portalCookies = await context.cookies(PORTAL_BASE);
      const marketingSession = marketingCookies.find((c) => c.name === "atour_mb_session");
      const portalSession = portalCookies.find((c) => c.name === "atour_mb_session");
      expect(marketingSession).toBeDefined();
      expect(portalSession).toBeDefined();
      expect(marketingSession?.domain).toMatch(
        new RegExp(`${SESSION_COOKIE_DOMAIN.replace(/\./g, "\\.")}$`)
      );
      expect(portalSession?.domain).toMatch(
        new RegExp(`${SESSION_COOKIE_DOMAIN.replace(/\./g, "\\.")}$`)
      );
    });
  });
}
