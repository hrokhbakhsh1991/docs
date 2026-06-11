import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliCatalogTour } from "../src/http/catalog.service";
import type { DenaliPublicBookingPort } from "../src/http/ports/public-booking.port";
import type { DenaliTourStorePort } from "../src/http/ports/tour-store.port";

const TOUR_ID = "00000000-0000-4000-8000-000000000210";

const store: DenaliTourStorePort = {
  async listPage() {
    return { items: [] };
  },
  async findFirst() {
    return {
      id: TOUR_ID,
      createdAt: new Date(0).toISOString(),
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: {
          title: "North Ridge Trek",
          publishStatus: "active",
          capacityMax: 12,
        },
      },
    };
  },
};

function bookingPort(approvedByTour: Record<string, number>): DenaliPublicBookingPort {
  return {
    async findDuplicateByTourEmail() {
      return null;
    },
    async createPendingBooking() {
      return { id: "booking", status: "pending" };
    },
    async sumApprovedPartySizeByTourIds(_tenantId, tourIds) {
      const totals: Record<string, number> = {};
      for (const tourId of tourIds) {
        if (approvedByTour[tourId] !== undefined) {
          totals[tourId] = approvedByTour[tourId]!;
        }
      }
      return totals;
    },
  };
}

describe("catalog-spots-enrichment", () => {
  it("DN-CAT-07 detail card includes spotsRemaining from approved occupancy", async () => {
    const card = await getDenaliCatalogTour({
      tenantId: "tenant",
      workspaceType: "denali",
      store,
      bookingPort: bookingPort({ [TOUR_ID]: 4 }),
      tourId: TOUR_ID,
    });
    assert.equal(card?.spotsRemaining, 8);
  });

  it("DN-CAT-08 pending occupancy does not reduce spots when port returns zero", async () => {
    const card = await getDenaliCatalogTour({
      tenantId: "tenant",
      workspaceType: "denali",
      store,
      bookingPort: bookingPort({}),
      tourId: TOUR_ID,
    });
    assert.equal(card?.spotsRemaining, 12);
  });
});
