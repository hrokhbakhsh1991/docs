import { expect, test } from "@playwright/test";

import { resolveSmokePublishedTourId } from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();

test("SMK-MKT-08 sitemap.xml is reachable and lists the published tour URL", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);

  const body = await response.text();
  expect(body).toMatch(/<urlset[\s>]/);
  expect(body).toContain(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`);
});
