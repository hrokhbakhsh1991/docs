/**
 * P6 VS-01 — operator session + denali catalog publish visibility
 * Authority: docs/phase-19/platform-denali-vertical-slice.mdoc · SMOKE-SCENARIO-MAP-P6.md
 *
 * Publish transition (draft→active) — API: p6-vs01-admin-publish.spec.ts P6-VS-01-01
 */
import { expect, test } from "@playwright/test";

import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PUBLISHED_TITLE = "North Ridge Trek";
const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";
const OPERATOR_SMOKE_DRAFT_TITLE = "Denali draft fixture";

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

async function fetchCatalogTitles(
  page: import("@playwright/test").Page
): Promise<readonly string[]> {
  const res = await page.request.get(`${tourOpsApiBase()}/denali/catalog`, {
    headers: { "x-tenant-id": OPERATOR_SMOKE_TENANT_ID },
  });
  expect(res.ok(), `catalog GET failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as {
    data?: { items?: readonly { title?: string }[] };
  };
  return (body.data?.items ?? [])
    .map((item) => item.title?.trim() ?? "")
    .filter((title) => title.length > 0);
}

test.describe("p6-admin-publish-smoke.spec.ts — P6 VS-01", () => {
  test("SMK-P6-VS-01 active tour listed · draft tour hidden from denali catalog", async ({
    page,
  }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    await expect
      .poll(async () => fetchCatalogTitles(page), { timeout: 30_000 })
      .toContain(OPERATOR_SMOKE_PUBLISHED_TITLE);

    const titles = await fetchCatalogTitles(page);
    expect(titles).not.toContain(OPERATOR_SMOKE_DRAFT_TITLE);

    const draftDetail = await page.request.get(
      `${tourOpsApiBase()}/denali/catalog/${encodeURIComponent(OPERATOR_SMOKE_DRAFT_TOUR_ID)}`,
      { headers: { "x-tenant-id": OPERATOR_SMOKE_TENANT_ID } }
    );
    expect(draftDetail.status()).toBe(404);
  });
});
