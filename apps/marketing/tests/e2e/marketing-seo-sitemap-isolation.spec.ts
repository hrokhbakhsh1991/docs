import { expect, test } from "@playwright/test";

const DENALI_BASE = process.env.SMOKE_DENALI_BASE_URL ?? "http://operator.localhost:3002";
const URBAN_BASE = process.env.SMOKE_URBAN_BASE_URL ?? "http://urban.localhost:3002";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const URBAN_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";

test("SMK-MKT-104 tenant sitemaps isolate published tour URLs per host", async ({ request }) => {
  const denaliResponse = await request.get(`${DENALI_BASE}/sitemap.xml`);
  expect(denaliResponse.status()).toBe(200);
  const denaliBody = await denaliResponse.text();
  expect(denaliBody).toContain(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}`);
  expect(denaliBody).not.toContain(`/tours/${URBAN_PUBLISHED_TOUR_ID}`);

  const urbanResponse = await request.get(`${URBAN_BASE}/sitemap.xml`);
  expect(urbanResponse.status()).toBe(200);
  const urbanBody = await urbanResponse.text();
  expect(urbanBody).toContain(`/tours/${URBAN_PUBLISHED_TOUR_ID}`);
  expect(urbanBody).not.toContain(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}`);
});
