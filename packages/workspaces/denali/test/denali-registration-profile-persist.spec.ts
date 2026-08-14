import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDenaliRegistration } from "../src/http/registration.service";
import type { DenaliPublicBookingPort } from "../src/http/ports/public-booking.port";
import type { DenaliTourStorePort } from "../src/http/ports/tour-store.port";

const TOUR_ID = "00000000-0000-4000-8000-000000000212";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const GUEST_USER_ID = "00000000-0000-4000-8000-000000000199";

function publishedParticipantTourStore(): DenaliTourStorePort {
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
            title: "Participant Fields Tour",
            publishStatus: "active",
            capacityMax: 12,
            startDateTime: "2026-06-01T08:00:00.000Z",
            participantRequirements: {
              nationalIdRequired: true,
              fatherNameRequired: true,
              birthDateRequired: true,
            },
          },
        },
      };
    },
  };
}

function noopBookingPort(): DenaliPublicBookingPort {
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
      return { id: "booking-1", status: "pending" };
    },
    async autoApprovePublicBooking() {
      return { id: "booking-1", status: "approved" };
    },
    async sumApprovedPartySizeByTourIds() {
      return {};
    },
  };
}

describe("denali-registration-profile-persist", () => {
  it("DN-REG-P01 self intake patches empty membership displayName and participant fields", async () => {
    const patches: Array<Record<string, string>> = [];
    await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        registrantTarget: "self",
        contact: {
          fullName: "Ali Rezaei",
          nationalId: "1234567890",
          fatherName: "Hossein",
          birthDate: "1990-05-20",
        },
        partySize: 1,
      },
      store: publishedParticipantTourStore(),
      bookingPort: noopBookingPort(),
      resolveGuestMembership: async () => ({
        displayName: null,
        nationalId: null,
        fatherName: null,
        birthDate: null,
      }),
      saveGuestProfileFields: async (_tenantId, _userId, patch) => {
        patches.push({ ...patch });
      },
    });

    assert.equal(patches.length, 1);
    assert.deepEqual(patches[0], {
      displayName: "Ali Rezaei",
      nationalId: "1234567890",
      fatherName: "Hossein",
      birthDate: "1990-05-20",
    });
  });

  it("DN-REG-P02 skips displayName patch when membership already has one", async () => {
    const patches: Array<Record<string, string>> = [];
    await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        registrantTarget: "self",
        contact: {
          fullName: "Ali Rezaei",
          nationalId: "1234567890",
          fatherName: "Hossein",
          birthDate: "1990-05-20",
        },
        partySize: 1,
      },
      store: publishedParticipantTourStore(),
      bookingPort: noopBookingPort(),
      resolveGuestMembership: async () => ({
        displayName: "Existing Name",
        nationalId: null,
        fatherName: null,
        birthDate: null,
      }),
      saveGuestProfileFields: async (_tenantId, _userId, patch) => {
        patches.push({ ...patch });
      },
    });

    assert.equal(patches.length, 1);
    assert.equal(patches[0]?.displayName, undefined);
    assert.equal(patches[0]?.nationalId, "1234567890");
  });

  it("DN-REG-P03 other registrant does not patch booker profile", async () => {
    let patchCount = 0;
    await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        registrantTarget: "other",
        contact: {
          fullName: "Guest Child",
          phone: "09123456789",
          nationalId: "2234567890",
          fatherName: "Guest Father",
          birthDate: "1992-01-01",
        },
        partySize: 1,
      },
      store: publishedParticipantTourStore(),
      bookingPort: noopBookingPort(),
      resolveGuestMembership: async () => ({
        displayName: null,
        nationalId: null,
        fatherName: null,
        birthDate: null,
      }),
      saveGuestProfileFields: async () => {
        patchCount += 1;
      },
    });

    assert.equal(patchCount, 0);
  });
});
