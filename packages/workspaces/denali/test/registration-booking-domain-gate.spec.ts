/**
 * Phase 1 — registration orchestration fail-closes on booking domain validation
 * before host createPendingBooking.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_DENALI_CAPACITY_RULE } from "../src/booking/capacity-rule.ts";
import { createDenaliRegistration } from "../src/http/registration.service.ts";
import type { BookingPublicPort } from "../src/http/ports/public-booking.port.ts";
import type { DenaliTourStorePort } from "../src/http/ports/tour-store.port.ts";

const TOUR_ID = "00000000-0000-4000-8000-000000000312";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const GUEST_USER_ID = "00000000-0000-4000-8000-000000000199";

function publishedTourStore(): DenaliTourStorePort {
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
            title: "Capacity Gate Tour",
            publishStatus: "active",
            capacityMax: 12,
            startDateTime: "2026-06-01T08:00:00.000Z",
          },
        },
      };
    },
  };
}

describe("registration-booking-domain-gate.spec.ts — Denali Phase 1", () => {
  it("DN-B1-R01 partySize over maxPartySize never reaches host createPendingBooking", async () => {
    let createCalls = 0;
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
      async findDuplicateByTourEmail() {
        return null;
      },
      async createPendingBooking() {
        createCalls += 1;
        return { id: "should-not-create", status: "pending" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    await assert.rejects(
      () =>
        createDenaliRegistration({
          tenantId: TENANT_ID,
          workspaceType: "denali",
          guestUserId: GUEST_USER_ID,
          body: {
            tourId: TOUR_ID,
            contact: { fullName: "Overflow Guest" },
            partySize: DEFAULT_DENALI_CAPACITY_RULE.maxPartySize + 1,
          },
          store: publishedTourStore(),
          bookingPort,
        }),
      /BOOKING_VALIDATION_REJECTED: partySize must be <=/
    );
    assert.equal(createCalls, 0);
  });

  it("DN-B1-R02 valid partySize still creates pending via host port", async () => {
    let createCalls = 0;
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
      async findDuplicateByTourEmail() {
        return null;
      },
      async createPendingBooking(input) {
        createCalls += 1;
        assert.equal(input.partySize, 2);
        return { id: "booking-ok", status: "pending" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Ok Guest" },
        partySize: 2,
      },
      store: publishedTourStore(),
      bookingPort,
    });
    assert.equal(createCalls, 1);
    assert.equal(created.id, "booking-ok");
    assert.equal(created.status, "pending");
  });

  it("DN-B1-R03 empty guestLabel never reaches host createPendingBooking", async () => {
    let createCalls = 0;
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
      async findDuplicateByTourEmail() {
        return null;
      },
      async createPendingBooking() {
        createCalls += 1;
        return { id: "should-not-create", status: "pending" };
      },
      async sumApprovedPartySizeByTourIds() {
        return {};
      },
    };

    await assert.rejects(
      () =>
        createDenaliRegistration({
          tenantId: TENANT_ID,
          workspaceType: "denali",
          guestUserId: GUEST_USER_ID,
          body: {
            tourId: TOUR_ID,
            contact: { fullName: "   " },
            partySize: 1,
          },
          store: publishedTourStore(),
          bookingPort,
        }),
      /DENALI_REGISTRATION_INVALID|BOOKING_VALIDATION_REJECTED/
    );
    assert.equal(createCalls, 0);
  });
});
