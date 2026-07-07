/**
 * Shared Playwright helpers for platform E2E specs.
 */
import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page } from "@playwright/test";

import { PLATFORM_OPS_PHONE, uniquePlatformSubdomain } from "./platform-ops-session";

export type CreatedPlatformClub = {
  readonly tenantId: string;
  readonly subdomain: string;
};

export async function createPlatformClubViaBff(
  page: Page,
  options?: {
    readonly subdomain?: string;
    readonly ownerPhone?: string;
  }
): Promise<CreatedPlatformClub> {
  const subdomain = options?.subdomain ?? uniquePlatformSubdomain("ops");
  const ownerPhone = options?.ownerPhone ?? PLATFORM_OPS_PHONE;

  const createRes = await page.request.post("/api/platform/tenants", {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      subdomain,
      workspaceType: "denali",
      ownerPhone,
    },
  });
  const createText = await createRes.text();
  expect(createRes.ok(), createText).toBeTruthy();
  const createBody = JSON.parse(createText) as {
    tenant?: { id?: string };
  };
  const tenantId = createBody.tenant?.id;
  expect(typeof tenantId).toBe("string");
  expect((tenantId ?? "").length).toBeGreaterThan(0);

  return { tenantId: tenantId!, subdomain };
}

export async function openPlatformClubDetail(page: Page, tenantId: string): Promise<void> {
  await page.goto(`/platform/clubs/${tenantId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page.locator('[data-platform-club-detail][data-client-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
}

/** P2-C — custom_domain requires enterprise plan before Domains tab POST succeeds. */
export async function upgradePlatformClubToEnterprise(
  page: Page,
  tenantId: string
): Promise<void> {
  const response = await page.request.patch(`/api/platform/tenants/${tenantId}/subscription`, {
    data: { planId: "enterprise" },
  });
  const body = await response.text();
  expect(response.ok(), body).toBeTruthy();
}

export async function openPlatformClubDomainsTab(
  page: Page,
  tenantId: string
): Promise<Locator> {
  const domainsList = await page.request.get(`/api/platform/tenants/${tenantId}/domains`);
  expect(domainsList.ok(), await domainsList.text()).toBeTruthy();

  await page.locator('[data-tab-button="domains"]').click();
  const panel = page.locator('[data-tab="domains"]');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator('[data-platform-loading]')).toBeHidden({ timeout: 60_000 });
  return panel;
}
