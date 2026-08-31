import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingPublicPort } from "@app-tour/booking-http-contracts";
import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { createHarborRegistration } from "../src/registration/create-harbor-registration";
import { HarborRegistrationDuplicateError } from "../src/registration/harbor-registration.errors";
import type { HarborTourStorePort } from "../src/http/harbor-http-host";

const tourId = "00000000-0000-4000-8000-000000000888";
const canonical = {
  schemaVersion: 1,
  roots: [],
  data: {
    title: "Register sail",
    city: "bandar",
    publishStatus: "published",
    departureAt: "2026-12-01T12:00:00.000Z",
    totalCapacity: 10,
  },
} as CanonicalDocument;

function store(): HarborTourStorePort {
  return {
    listPage: async () => ({ items: [] }),
    findFirst: async ({ id }) =>
      id === tourId
        ? { id: tourId, createdAt: "2026-08-01T00:00:00.000Z", canonical }
        : null,
  };
}

describe("PSR-6c4 createHarborRegistration", () => {
  it("creates pending booking via BookingPublicPort", async () => {
    const calls: unknown[] = [];
    const bookingPort: BookingPublicPort = {
      findDuplicateByTourGuest: async () => null,
      findDuplicateByTourGuestLabel: async () => null,
      findDuplicateByTourGuestNationalId: async () => null,
        findDuplicateByTourGuestPhone: async () => null,
      findDuplicateByTourEmail: async () => null,
      findOwnedBooking: async () => null,
      mergeOwnedRegistrationIntake: async () => null,
      createPendingBooking: async (input) => {
        calls.push(input);
        return { id: "b1", status: "pending" };
      },
      autoApprovePublicBooking: async () => ({ id: "b1", status: "approved" }),
      sumApprovedPartySizeByTourIds: async () => ({}),
    };

    const created = await createHarborRegistration({
      tenantId: "tenant-1",
      workspaceType: "harbor",
      guestUserId: "guest-1",
      body: {
        tourId,
        contact: { fullName: "Ada Harbor", email: "ada@example.com" },
        partySize: 2,
      },
      store: store(),
      bookingPort,
    });
    assert.equal(created.id, "b1");
    assert.equal(calls.length, 1);
    assert.equal((calls[0] as { tourTitle: string }).tourTitle, "Register sail");
  });

  it("rejects duplicate email", async () => {
    const bookingPort: BookingPublicPort = {
      findDuplicateByTourGuest: async () => null,
      findDuplicateByTourGuestLabel: async () => null,
      findDuplicateByTourGuestNationalId: async () => null,
        findDuplicateByTourGuestPhone: async () => null,
      findDuplicateByTourEmail: async () => ({ id: "existing" }),
      findOwnedBooking: async () => null,
      mergeOwnedRegistrationIntake: async () => null,
      createPendingBooking: async () => {
        throw new Error("should not create");
      },
      autoApprovePublicBooking: async () => {
        throw new Error("should not auto-approve");
      },
      sumApprovedPartySizeByTourIds: async () => ({}),
    };

    await assert.rejects(
      () =>
        createHarborRegistration({
          tenantId: "tenant-1",
          workspaceType: "harbor",
          guestUserId: "guest-1",
          body: {
            tourId,
            contact: { fullName: "Ada Harbor", email: "ada@example.com" },
            partySize: 1,
          },
          store: store(),
          bookingPort,
        }),
      HarborRegistrationDuplicateError,
    );
  });
});
