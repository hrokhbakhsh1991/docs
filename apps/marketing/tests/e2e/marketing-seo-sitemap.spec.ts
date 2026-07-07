import { expect, test } from "@playwright/test";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

test("SMK-MKT-08 sitemap.xml is reachable and lists the published tour URL", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);

  const body = await response.text();
  expect(body).toMatch(/<urlset[\s>]/);
  expect(body).toContain(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}`);
});
