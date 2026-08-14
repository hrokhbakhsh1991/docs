/**
 * Denali portal registration read/amend services (split from registration.service.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { amendDenaliRegistrationIntake } from "../src/http/registration-amend.service";
import { getDenaliRegistrationForTour } from "../src/http/registration-for-tour.service";
import { getDenaliRegistrationOwned } from "../src/http/registration-get.service";
import { DenaliRegistrationNotAmendableError } from "../src/http/errors/denali-registration-not-amendable.error";
import { DenaliRegistrationNotFoundError } from "../src/http/errors/denali-registration-not-found.error";
import type { BookingPublicPort } from "../src/http/ports/public-booking.port";
import type { DenaliTourStorePort } from "../src/http/ports/tour-store.port";

const TENANT = "00000000-0000-4000-8000-000000000003";
const GUEST = "00000000-0000-4000-8000-000000000199";
const TOUR_ID = "00000000-0000-4000-8000-000000000501";
const REG_ID = "00000000-0000-4000-8000-000000000601";

function pricedTourStore(): DenaliTourStorePort {
  return {
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
            title: "Read Services Tour",
            publishStatus: "active",
            capacityMax: 12,
            startDateTime: "2026-06-01T08:00:00.000Z",
            pricing: { basePricePerPerson: 2_500_000, paymentMode: "offline_receipt" },
            transport: { mode: "bus", transportCost: 150_000 },
          },
        },
      };
    },
  };
}

describe("registration-read-services", () => {
  it("DN-READ-01 for-tour returns self duplicate when present", async () => {
    const bookingPort: BookingPublicPort = {
      async findDuplicateByTourGuest(_tenantId, _tourId, guestUserId) {
        assert.equal(guestUserId, GUEST);
        return { id: REG_ID, status: "pending" };
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
        return { id: REG_ID, status: "pending" };
      },
      async autoApprovePublicBooking() {
        return { id: REG_ID, status: "approved" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    const result = await getDenaliRegistrationForTour({
      tenantId: TENANT,
      guestUserId: GUEST,
      tourId: TOUR_ID,
      bookingPort,
    });
    assert.deepEqual(result, { self: { id: REG_ID, status: "pending" } });
  });

  it("DN-READ-02 owned detail enriches due breakdown from tour + intake", async () => {
    const bookingPort: BookingPublicPort = {
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
      async findOwnedBooking(_tenantId, registrationId, guestUserId) {
        assert.equal(registrationId, REG_ID);
        assert.equal(guestUserId, GUEST);
        return {
          id: REG_ID,
          status: "approved",
          tourId: TOUR_ID,
          tourTitle: "Read Services Tour",
          guestLabel: "Member",
          registrantTarget: "self",
          paymentStatus: "unpaid",
          departureAt: "2026-06-01T08:00:00.000Z",
          submittedAt: "2026-05-01T08:00:00.000Z",
          partySize: 1,
          registrationIntake: { transport: { kind: "primary" } },
        };
      },
      async mergeOwnedRegistrationIntake() {
        return null;
      },
      async reclassifyOwnedOtherToSelf() {
        return null;
      },
      async createPendingBooking() {
        return { id: REG_ID, status: "pending" };
      },
      async autoApprovePublicBooking() {
        return { id: REG_ID, status: "approved" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    const detail = await getDenaliRegistrationOwned({
      tenantId: TENANT,
      guestUserId: GUEST,
      registrationId: REG_ID,
      bookingPort,
      store: pricedTourStore(),
    });
    assert.equal(detail.dueTotalMinor, "2650000");
    assert.equal(detail.dueCurrency, "IRR");
    assert.equal(detail.dueLines?.length, 2);
  });

  it("DN-READ-03 owned detail throws when booking not owned", async () => {
    const bookingPort: BookingPublicPort = {
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
        return { id: REG_ID, status: "pending" };
      },
      async autoApprovePublicBooking() {
        return { id: REG_ID, status: "approved" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    await assert.rejects(
      () =>
        getDenaliRegistrationOwned({
          tenantId: TENANT,
          guestUserId: GUEST,
          registrationId: REG_ID,
          bookingPort,
          store: pricedTourStore(),
        }),
      DenaliRegistrationNotFoundError
    );
  });

  it("DN-READ-04 amend merges transport while pending", async () => {
    let mergedPatch: Record<string, unknown> | undefined;
    const bookingPort: BookingPublicPort = {
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
        return {
          id: REG_ID,
          status: "pending",
          tourId: TOUR_ID,
          tourTitle: "Read Services Tour",
          guestLabel: "Member",
          registrantTarget: "self",
          paymentStatus: "unpaid",
          departureAt: "2026-06-01T08:00:00.000Z",
          submittedAt: "2026-05-01T08:00:00.000Z",
          partySize: 1,
        };
      },
      async mergeOwnedRegistrationIntake(input) {
        mergedPatch = input.patch;
        return { id: REG_ID, status: "pending" };
      },
      async reclassifyOwnedOtherToSelf() {
        return null;
      },
      async createPendingBooking() {
        return { id: REG_ID, status: "pending" };
      },
      async autoApprovePublicBooking() {
        return { id: REG_ID, status: "approved" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    const updated = await amendDenaliRegistrationIntake({
      tenantId: TENANT,
      workspaceType: "denali",
      guestUserId: GUEST,
      registrationId: REG_ID,
      body: { transport: { kind: "primary" } },
      store: pricedTourStore(),
      bookingPort,
    });
    assert.equal(updated.id, REG_ID);
    assert.equal((mergedPatch?.transport as { kind?: string })?.kind, "primary");
  });

  it("DN-READ-05 amend rejects approved registration", async () => {
    const bookingPort: BookingPublicPort = {
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
        return {
          id: REG_ID,
          status: "approved",
          tourId: TOUR_ID,
          tourTitle: "Read Services Tour",
          guestLabel: "Member",
          registrantTarget: "self",
          paymentStatus: "unpaid",
          departureAt: "2026-06-01T08:00:00.000Z",
          submittedAt: "2026-05-01T08:00:00.000Z",
          partySize: 1,
        };
      },
      async mergeOwnedRegistrationIntake() {
        return null;
      },
      async reclassifyOwnedOtherToSelf() {
        return null;
      },
      async createPendingBooking() {
        return { id: REG_ID, status: "pending" };
      },
      async autoApprovePublicBooking() {
        return { id: REG_ID, status: "approved" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    await assert.rejects(
      () =>
        amendDenaliRegistrationIntake({
          tenantId: TENANT,
          workspaceType: "denali",
          guestUserId: GUEST,
          registrationId: REG_ID,
          body: { transport: { kind: "primary" } },
          store: pricedTourStore(),
          bookingPort,
        }),
      DenaliRegistrationNotAmendableError
    );
  });
});
