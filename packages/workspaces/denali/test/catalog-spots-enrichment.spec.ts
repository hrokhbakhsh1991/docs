import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliCatalogTour, listDenaliCatalog } from "../src/http/catalog.service";
import type { BookingPublicPort } from "../src/http/ports/public-booking.port";
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

function bookingPort(approvedByTour: Record<string, number>): BookingPublicPort {
  return {
    async findDuplicateByTourGuest() {
      return null;
    },
    async findDuplicateByTourGuestLabel() {
      return null;
    },
    async findDuplicateByTourGuestNationalId() {
      return null;
    },
    async findDuplicateByTourGuestPhone() {
      return null;
    },
    async findDuplicateByTourEmail() {
      return null;
    },
    async findOwnedBooking() {
      return null;
    },
    async mergeOwnedRegistrationIntake() {
      return null;
    },
    async reclassifyOwnedOtherToSelf() {
      return null;
    },
    async createPendingBooking() {
      return { id: "booking", status: "pending" };
    },
    async autoApprovePublicBooking() {
      return { id: "booking", status: "approved" };
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
  it("DN-SPOTS-01 detail card includes spotsRemaining from approved occupancy", async () => {
    const card = await getDenaliCatalogTour({
      tenantId: "tenant",
      workspaceType: "denali",
      store,
      bookingPort: bookingPort({ [TOUR_ID]: 4 }),
      tourId: TOUR_ID,
    });
    assert.equal(card?.spotsRemaining, 8);
  });

  it("DN-SPOTS-02 pending occupancy does not reduce spots when port returns zero", async () => {
    const card = await getDenaliCatalogTour({
      tenantId: "tenant",
      workspaceType: "denali",
      store,
      bookingPort: bookingPort({}),
      tourId: TOUR_ID,
    });
    assert.equal(card?.spotsRemaining, 12);
  });

  it("DN-CAT-STATE-01 keeps published full and past tours in the default catalog with explicit states", async () => {
    const listStore: DenaliTourStorePort = {
      async listPage() {
        return {
          items: [
            {
              id: "tour-open",
              createdAt: "2026-09-22T00:00:00.000Z",
              canonical: {
                schemaVersion: 1,
                roots: ["basics"],
                data: {
                  title: "Open tour",
                  publishStatus: "active",
                  startDateTime: "2030-09-20T08:00:00.000Z",
                  capacityMax: 12,
                },
              },
            },
            {
              id: "tour-full",
              createdAt: "2026-09-21T00:00:00.000Z",
              canonical: {
                schemaVersion: 1,
                roots: ["basics"],
                data: {
                  title: "Full tour",
                  publishStatus: "active",
                  startDateTime: "2030-09-21T08:00:00.000Z",
                  capacityMax: 12,
                },
              },
            },
            {
              id: "tour-past",
              createdAt: "2026-09-20T00:00:00.000Z",
              canonical: {
                schemaVersion: 1,
                roots: ["basics"],
                data: {
                  title: "Past tour",
                  publishStatus: "active",
                  startDateTime: "2025-09-21T08:00:00.000Z",
                  capacityMax: 12,
                },
              },
            },
          ],
          nextCursor: null,
        };
      },
      async findFirst() {
        return null;
      },
    };

    const result = await listDenaliCatalog({
      tenantId: "tenant",
      workspaceType: "denali",
      store: listStore,
      bookingPort: bookingPort({ "tour-full": 12 }),
    });

    assert.deepEqual(
      result.items.map((item) => ({ id: item.id, state: item.registrationState })),
      [
        { id: "tour-open", state: "open" },
        { id: "tour-full", state: "waitlist" },
        { id: "tour-past", state: "past" },
      ]
    );
    assert.equal(result.items.find((item) => item.id === "tour-full")?.waitlistEnabled, true);
  });
});
