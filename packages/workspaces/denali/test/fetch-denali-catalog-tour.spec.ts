import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchDenaliCatalogTour } from "../src/catalog/fetch-denali-catalog-tour.ts";

describe("fetchDenaliCatalogTour", () => {
  it("returns null on 404", async () => {
    const card = await fetchDenaliCatalogTour({
      tenantId: "t1",
      tourId: "missing",
      apiBaseUrl: "https://api.example",
      headers: { "x-tenant-id": "t1" },
      fetchImpl: async () => new Response(null, { status: 404 }),
    });
    assert.equal(card, null);
  });

  it("parses success payload", async () => {
    const card = await fetchDenaliCatalogTour({
      tenantId: "t1",
      tourId: "tour-1",
      apiBaseUrl: "https://api.example",
      headers: { "x-tenant-id": "t1" },
      fetchImpl: async (input) => {
        assert.match(String(input), /\/denali\/catalog\/tour-1$/);
        return Response.json({
          success: true,
          data: {
            id: "tour-1",
            title: "Peak day",
            shortDescription: null,
            departureAt: null,
          },
        });
      },
    });
    assert.equal(card?.id, "tour-1");
    assert.equal(card?.title, "Peak day");
  });
});
