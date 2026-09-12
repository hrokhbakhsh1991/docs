/**
 * Phase 3 — per-tour registrationApproval auto wires host autoApprove after create.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliRegistrationObligationMinor } from "../src/finance/resolve-denali-registration-obligation.ts";
import { createDenaliRegistration } from "../src/http/registration.service.ts";
import type { BookingPublicPort } from "../src/http/ports/public-booking.port.ts";
import type { DenaliTourStorePort } from "../src/http/ports/tour-store.port.ts";

const TOUR_ID = "00000000-0000-4000-8000-000000000413";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const GUEST_USER_ID = "00000000-0000-4000-8000-000000000199";

function storeWithPolicy(
  mode: "manual" | "auto" | undefined,
  paymentCollection: "free" | "paid" = "paid"
): DenaliTourStorePort {
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
            title: "Approval Mode Tour",
            publishStatus: "active",
            capacityMax: 12,
            startDateTime: "2026-06-01T08:00:00.000Z",
            pricing: {
              registrationApproval: mode,
              paymentCollection,
              basePricePerPerson: 2_500_000,
              paymentMode: "offline_receipt",
            },
          },
        },
      };
    },
  };
}

function trackingPort(): {
  readonly port: BookingPublicPort;
  readonly createCalls: number[];
  readonly autoCalls: Array<{ bookingId: string; actorUserId: string }>;
} {
  const createCalls: number[] = [];
  const autoCalls: Array<{ bookingId: string; actorUserId: string }> = [];
  const port: BookingPublicPort = {
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
      createCalls.push(1);
      return { id: "booking-auto", status: "pending" };
    },
    async autoApprovePublicBooking(input) {
      autoCalls.push({ bookingId: input.bookingId, actorUserId: input.actorUserId });
      return { id: input.bookingId, status: "approved" };
    },
    async sumApprovedPartySizeByTourIds() {
      return {};
    },
  };
  return { port, createCalls, autoCalls };
}

describe("registration-auto-approve — Denali Phase 3", () => {
  it("DN-P3-R01 auto mode calls host autoApprove after create", async () => {
    const { port, createCalls, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Auto Guest" },
        partySize: 1,
      },
      store: storeWithPolicy("auto"),
      bookingPort: port,
    });
    assert.equal(createCalls.length, 1);
    assert.equal(autoCalls.length, 1);
    assert.equal(autoCalls[0]?.bookingId, "booking-auto");
    assert.equal(autoCalls[0]?.actorUserId, GUEST_USER_ID);
    assert.equal(created.status, "approved");
  });

  it("DN-P3-R02 manual mode never auto-approves", async () => {
    const { port, createCalls, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Manual Guest" },
        partySize: 1,
      },
      store: storeWithPolicy("manual"),
      bookingPort: port,
    });
    assert.equal(createCalls.length, 1);
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R03 missing field defaults to manual", async () => {
    const { port, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Default Guest" },
        partySize: 1,
      },
      store: storeWithPolicy(undefined),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R04 covers free/paid × manual/auto registration outcomes and obligation", async () => {
    const cases = [
      { mode: "manual", paymentCollection: "paid", status: "pending", obligation: "2500000" },
      { mode: "auto", paymentCollection: "paid", status: "approved", obligation: "2500000" },
      { mode: "manual", paymentCollection: "free", status: "pending", obligation: "0" },
      { mode: "auto", paymentCollection: "free", status: "approved", obligation: "0" },
    ] as const;

    for (const [index, scenario] of cases.entries()) {
      const { port } = trackingPort();
      const created = await createDenaliRegistration({
        tenantId: TENANT_ID,
        workspaceType: "denali",
        guestUserId: `${GUEST_USER_ID.slice(0, -3)}${String(index + 300).padStart(3, "0")}`,
        body: {
          tourId: `${TOUR_ID.slice(0, -3)}${String(index + 500).padStart(3, "0")}`,
          contact: { fullName: `Matrix Guest ${index}` },
          partySize: 1,
        },
        store: storeWithPolicy(scenario.mode, scenario.paymentCollection),
        bookingPort: port,
      });

      assert.equal(
        created.status,
        scenario.status,
        `${scenario.paymentCollection}:${scenario.mode}`
      );
      const obligation = resolveDenaliRegistrationObligationMinor({
        tourCanonical: {
          data: {
            pricing: {
              paymentCollection: scenario.paymentCollection,
              basePricePerPerson: 2_500_000,
              paymentMode: "offline_receipt",
            },
          },
        },
        partySize: 1,
      });
      assert.equal(
        obligation?.obligationMinor,
        scenario.obligation,
        `${scenario.paymentCollection}:${scenario.mode}`
      );
    }
  });
});
