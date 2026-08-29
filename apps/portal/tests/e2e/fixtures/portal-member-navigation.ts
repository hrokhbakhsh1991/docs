import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Ensure /me/registrations list is hydrated (registration flow may already land here). */
export async function openMemberRegistrationsFromSuccess(page: Page): Promise<void> {
  if (!page.url().includes("/me/registrations")) {
    await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 60_000 });
    const listRoot = page.locator("[data-portal-member-registrations]");
    if (await listRoot.isVisible({ timeout: 30_000 }).catch(() => false)) {
      const firstRow = page.locator("[data-portal-member-registrations-list] li").first();
      if (await firstRow.isVisible({ timeout: 30_000 }).catch(() => false)) {
        return;
      }
    }
    await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
  }

  await expect(page.locator("[data-portal-member-registrations-list] li").first()).toBeVisible({
    timeout: 90_000,
  });
}

/** Open a registration detail row by tour title from the trips list. */
export async function openMemberRegistrationDetailByTitle(
  page: Page,
  tourTitle: string
): Promise<void> {
  const tourLink = page
    .locator(`[data-portal-member-registrations-list] a`)
    .filter({ hasText: tourTitle })
    .first();
  await expect(tourLink).toBeVisible({ timeout: 90_000 });
  const href = await tourLink.getAttribute("href");
  expect(href, "registration detail link must have href").toBeTruthy();

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(href!, { waitUntil: "domcontentloaded" });
    const detail = page.locator("[data-portal-member-registration-detail]");
    if (await detail.isVisible({ timeout: 30_000 }).catch(() => false)) {
      return;
    }
  }

  await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
    timeout: 90_000,
  });
}
