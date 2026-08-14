import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  getIdentityRepository,
  resetIdentityRepositorySingletonForTests,
} from "../identity/create-identity-repository";

import { createBooking, resetBookingsServiceCompositionForTests } from "./create-bookings-service";
import { getBookingsRepository, resetBookingsRepositoryForTests } from "./create-bookings-repository";
import type { BookingActorContext } from "./ports/booking-actor-context";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TOUR_DENALI = "00000000-0000-4000-8000-000000000891";
const MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";

function opsAuth(): BookingActorContext {
  return {
    tenantId: TENANT_DENALI,
    userId: "00000000-0000-4000-8000-000000000102",
    role: "admin",
    status: "ACTIVE",
  };
}

describe("booking admin-assisted ownership", { concurrency: false }, () => {
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.OPERATOR_SMOKE_E2E_SEED = "1";
    delete process.env.DATABASE_URL;
  });

  beforeEach(() => {
    resetIdentityRepositorySingletonForTests();
    getIdentityRepository();
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetIdentityRepositorySingletonForTests();
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("assigns submittedByUserId to the selected active member for assisted ops create", async () => {
    const created = await createBooking(opsAuth(), {
      tourId: TOUR_DENALI,
      tourTitle: "Damavand Day Trip",
      guestLabel: "Smoke Member",
      guestPhone: "+15550001003",
      guestEmail: "member@example.com",
      memberUserId: MEMBER_USER_ID,
      partySize: 1,
      departureAt: "2031-06-01T10:00:00.000Z",
      registrationIntake: {
        registrantTarget: "self",
        tourCapacityMax: 20,
      },
    });

    const detail = await getBookingsRepository().getById(created.id, TENANT_DENALI);
    assert.equal(detail?.submittedByUserId, MEMBER_USER_ID);
  });

  it("rejects assisted ownership when the selected member does not exist in the tenant", async () => {
    await assert.rejects(
      () =>
        createBooking(opsAuth(), {
          tourId: TOUR_DENALI,
          tourTitle: "Damavand Day Trip",
          guestLabel: "Missing Member",
          guestPhone: "+15550009999",
          memberUserId: "00000000-0000-4000-8000-000000009999",
          partySize: 1,
          departureAt: "2031-06-01T10:00:00.000Z",
          registrationIntake: {
            registrantTarget: "self",
            tourCapacityMax: 20,
          },
        }),
      /BOOKING_MEMBER_NOT_FOUND/
    );
  });
});
