/**
 * Portal owned registration due uses authoritative commercial pricing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliRegistrationOwned } from "../src/http/registration-get.service";
import type { BookingPublicPort } from "../src/http/ports/public-booking.port";
import type { RegistrationCommercialPricingPort } from "../src/http/ports/registration-commercial-pricing.port";
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
            title: "Pricing Tour",
            publishStatus: "active",
            capacityMax: 12,
            startDateTime: "2026-06-01T08:00:00.000Z",
            pricing: {
              basePricePerPerson: 10_000_000,
              paymentMode: "offline_receipt",
              allowMembershipDiscount: true,
            },
          },
        },
      };
    },
  };
}

function bookingPort(): BookingPublicPort {
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
      return {
        id: REG_ID,
        status: "approved",
        tourId: TOUR_ID,
        tourTitle: "Pricing Tour",
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
}

describe("registration-commercial-pricing-owned-detail", () => {
  it("DN-READ-07 dueTotalMinor prefers discounted payable from commercial pricing port", async () => {
    const commercialPricingPort: RegistrationCommercialPricingPort = {
      async resolveRegistrationCommercialPricing() {
        return {
          grossMinor: "10000000",
          memberDiscountPercentage: 50,
          memberDiscountMinor: "5000000",
          payableMinor: "5000000",
          currency: "IRR",
          quoteSource: "member_discount",
          quoteStatus: "FROZEN",
        };
      },
    };

    const detail = await getDenaliRegistrationOwned({
      tenantId: TENANT,
      guestUserId: GUEST,
      registrationId: REG_ID,
      bookingPort: bookingPort(),
      store: pricedTourStore(),
      commercialPricingPort,
    });

    assert.equal(detail.dueTotalMinor, "5000000");
    assert.equal(detail.commercialPricing?.payableMinor, "5000000");
    assert.equal(detail.commercialPricing?.grossMinor, "10000000");
  });

  it("DN-READ-08 without commercial pricing port keeps gross catalog due", async () => {
    const detail = await getDenaliRegistrationOwned({
      tenantId: TENANT,
      guestUserId: GUEST,
      registrationId: REG_ID,
      bookingPort: bookingPort(),
      store: pricedTourStore(),
    });

    assert.equal(detail.dueTotalMinor, "10000000");
    assert.equal(detail.commercialPricing, undefined);
  });
});
