import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchCatalogTour } from "../src/catalog/fetch-catalog-tour";

describe("fetchCatalogTour", () => {
  it("preserves the server-derived waitlist state for the guest form", async () => {
    const previousApiUrl = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://api.test";
    try {
      const tour = await fetchCatalogTour({
        tenantId: "tenant-denali",
        pluginId: "denali",
        tourId: "tour-full",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                id: "tour-full",
                title: "Full tour",
                registrationState: "waitlist",
                waitlistEnabled: true,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          ),
      });

      assert.equal(tour?.registrationState, "waitlist");
      assert.equal(tour?.waitlistEnabled, true);
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = previousApiUrl;
      }
    }
  });
});
