/**
 * B4.2 — marketing catalog tour fetch contract (B4.1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { fetchCatalogTour } from "../src/catalog/fetch-catalog-tour";

const MARKETING_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const TENANT_ID = "00000000-0000-4000-8000-000000000014";
const PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

describe("fetch-catalog-tour.spec.ts — B4.2", () => {
  const originalFetch = globalThis.fetch;
  const priorApiUrl = process.env.TOUR_OPS_API_URL;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (priorApiUrl === undefined) {
      delete process.env.TOUR_OPS_API_URL;
    } else {
      process.env.TOUR_OPS_API_URL = priorApiUrl;
    }
  });

  it("MKT-B4-01 returns catalog card on successful upstream response", async () => {
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    globalThis.fetch = async (input) => {
      assert.match(String(input), new RegExp(`/denali/catalog/${PUBLISHED_TOUR_ID}$`));
      return Response.json({
        success: true,
        data: {
          id: PUBLISHED_TOUR_ID,
          title: "North Ridge Trek",
          shortDescription: "Operator smoke catalog tour",
          departureAt: null,
        },
      });
    };

    const tour = await fetchCatalogTour({
      tenantId: TENANT_ID,
      pluginId: "denali",
      tourId: PUBLISHED_TOUR_ID,
    });
    assert.equal(tour?.id, PUBLISHED_TOUR_ID);
    assert.equal(tour?.title, "North Ridge Trek");
  });

  it("MKT-B4-02 typed upstream 404 resolves to null (PDP not-found path)", async () => {
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    globalThis.fetch = async () => new Response(null, { status: 404 });

    const tour = await fetchCatalogTour({
      tenantId: TENANT_ID,
      pluginId: "denali",
      tourId: PUBLISHED_TOUR_ID,
    });
    assert.equal(tour, null);
  });

  it("MKT-B4-03 unexpected upstream failure stays an observable fetch error", async () => {
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    globalThis.fetch = async () => new Response("upstream unavailable", { status: 503 });

    await assert.rejects(
      () =>
        fetchCatalogTour({
          tenantId: TENANT_ID,
          pluginId: "denali",
          tourId: PUBLISHED_TOUR_ID,
        }),
      /MARKETING_CATALOG_DETAIL_FAILED:503/
    );
  });

  it("MKT-B4-04 tour PDP calls notFound only for null catalog card", () => {
    const source = readFileSync(join(MARKETING_ROOT, "app/tours/[tourId]/page.tsx"), "utf8");
    assert.match(source, /if \(tour === null\) \{\s*notFound\(\);/s);
    assert.doesNotMatch(source, /catch[\s\S]*notFound\(\)/);
  });
});
