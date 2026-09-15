import { expect, type Locator, type Page } from "@playwright/test";

export const NOTIFICATIONS_PANEL_READY =
  "[data-portal-member-notifications-panel][data-portal-member-notifications-state='ready']";

export const NOTIFICATIONS_PAGE_READY =
  "[data-portal-member-notifications][data-portal-member-notifications-state='ready']";

export async function gotoMemberNotificationsReady(page: Page): Promise<void> {
  await page.goto("/me/notifications", { waitUntil: "domcontentloaded" });
  await expect(page.locator(NOTIFICATIONS_PAGE_READY)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(NOTIFICATIONS_PANEL_READY)).toBeVisible({ timeout: 60_000 });
}

export async function fetchUnreadNotificationCount(page: Page): Promise<number> {
  const res = await page.request.get("/api/me/notifications/unread-count");
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { count?: number };
  return body.count ?? 0;
}

export function unreadNotificationItems(page: Page): Locator {
  return page.locator('[data-portal-member-notification-unread="true"]');
}

export function notificationBellBadge(page: Page): Locator {
  return page.locator("[data-portal-member-notification-badge]");
}

export async function expectBellBadgeCount(page: Page, count: number): Promise<void> {
  const bell = page.locator("[data-testid='portal-member-notification-bell']");
  await expect(bell).toBeVisible({ timeout: 60_000 });
  if (count <= 0) {
    await expect(notificationBellBadge(page)).toHaveCount(0);
    return;
  }
  await expect(notificationBellBadge(page)).toBeVisible();
  const text = await notificationBellBadge(page).innerText();
  if (count > 99) {
    expect(text).toBe("99+");
    return;
  }
  expect(Number.parseInt(text, 10)).toBe(count);
}
