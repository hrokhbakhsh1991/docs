import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateDenaliTourMutation } from "../src/tours/tour-mutation-policy";
import type { DenaliTourOperationalFacts } from "../src/tours/tour-mutation-policy";

const BASE_TOUR: Record<string, unknown> = {
  basicInfo: {
    title: "Ridge Trek",
    startDateTime: "2026-07-01T08:00:00.000Z",
    endDateTime: "2026-07-01T18:00:00.000Z",
    capacityMax: 12,
    destinationId: "dest-1",
    tourType: "mountain_day",
  },
  programNature: {
    shortDescription: "A scenic day hike",
    itinerary: [],
  },
  pricingPayment: {
    basePricePerPerson: 500_000,
    paymentMode: "offline_receipt",
    requiresPayment: true,
  },
  transport: {
    transportMode: "bus",
    dongAmount: 50_000,
    allowPersonalCar: true,
  },
};

function facts(overrides: Partial<DenaliTourOperationalFacts> = {}): DenaliTourOperationalFacts {
  return {
    activeRegistrationCount: 0,
    approvedRegistrationCount: 0,
    paidRegistrationCount: 0,
    occupiedApprovedPartySize: 0,
    hasTransportAllocations: false,
    ...overrides,
  };
}

function evaluate(
  after: Record<string, unknown>,
  operationalFacts: DenaliTourOperationalFacts,
  options?: { operatorMutationOverride?: boolean; operatorIsOwner?: boolean }
) {
  return evaluateDenaliTourMutation({
    beforeData: BASE_TOUR,
    afterData: after,
    facts: operationalFacts,
    operatorMutationOverride: options?.operatorMutationOverride,
    operatorIsOwner: options?.operatorIsOwner,
  });
}

describe("tour-mutation-policy — DP-3 matrix", () => {
  it("no-registration tour remains freely editable", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          title: "New title",
          capacityMax: 4,
        },
        pricingPayment: {
          ...(BASE_TOUR.pricingPayment as Record<string, unknown>),
          basePricePerPerson: 900_000,
        },
      },
      facts()
    );
    assert.equal(decision.decision, "ALLOW");
  });

  it("safe content edit after registrations is allowed", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          title: "Updated marketing title",
        },
      },
      facts({ activeRegistrationCount: 2, approvedRegistrationCount: 1, occupiedApprovedPartySize: 3 })
    );
    assert.equal(decision.decision, "ALLOW");
  });

  it("frozen destination field rejected after registration", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          destinationId: "dest-2",
        },
      },
      facts({ activeRegistrationCount: 1 })
    );
    assert.equal(decision.decision, "DENY");
    if (decision.decision === "DENY") {
      assert.equal(decision.reasonCode, "FIELD_FROZEN_AFTER_REGISTRATION");
      assert.ok(decision.fields.includes("destinationId"));
    }
  });

  it("price change after approval triggers repricing side effect", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        pricingPayment: {
          ...(BASE_TOUR.pricingPayment as Record<string, unknown>),
          basePricePerPerson: 650_000,
        },
      },
      facts({ activeRegistrationCount: 2, approvedRegistrationCount: 2, occupiedApprovedPartySize: 4 })
    );
    assert.equal(decision.decision, "ALLOW_WITH_SIDE_EFFECT");
    if (decision.decision === "ALLOW_WITH_SIDE_EFFECT") {
      assert.deepEqual(decision.sideEffects[0]?.kind, "repricing_required");
    }
  });

  it("price change after payment is denied", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        pricingPayment: {
          ...(BASE_TOUR.pricingPayment as Record<string, unknown>),
          basePricePerPerson: 650_000,
        },
      },
      facts({
        activeRegistrationCount: 2,
        approvedRegistrationCount: 2,
        paidRegistrationCount: 1,
        occupiedApprovedPartySize: 4,
      })
    );
    assert.equal(decision.decision, "DENY");
    if (decision.decision === "DENY") {
      assert.equal(decision.reasonCode, "FIELD_FROZEN_AFTER_PAYMENT");
    }
  });

  it("date change uses notification-required path", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          startDateTime: "2026-07-02T08:00:00.000Z",
        },
      },
      facts({ activeRegistrationCount: 1, approvedRegistrationCount: 1 })
    );
    assert.equal(decision.decision, "ALLOW_WITH_SIDE_EFFECT");
    if (decision.decision === "ALLOW_WITH_SIDE_EFFECT") {
      assert.deepEqual(decision.sideEffects[0]?.kind, "notification_required");
    }
  });

  it("capacity below occupied is rejected", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          capacityMax: 3,
        },
      },
      facts({ activeRegistrationCount: 2, approvedRegistrationCount: 2, occupiedApprovedPartySize: 5 })
    );
    assert.equal(decision.decision, "DENY");
    if (decision.decision === "DENY") {
      assert.equal(decision.reasonCode, "CAPACITY_BELOW_OCCUPIED");
    }
  });

  it("capacity increase is allowed", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          capacityMax: 20,
        },
      },
      facts({ activeRegistrationCount: 2, approvedRegistrationCount: 2, occupiedApprovedPartySize: 5 })
    );
    assert.equal(decision.decision, "ALLOW");
  });

  it("capacity decrease requires override when above occupied", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          capacityMax: 8,
        },
      },
      facts({ activeRegistrationCount: 2, approvedRegistrationCount: 2, occupiedApprovedPartySize: 5 })
    );
    assert.equal(decision.decision, "REQUIRE_OVERRIDE");
  });

  it("transport mutation with allocations requires override", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        transport: {
          ...(BASE_TOUR.transport as Record<string, unknown>),
          transportMode: "none",
          allocations: [{ id: "seat-1" }],
        },
      },
      facts({
        activeRegistrationCount: 2,
        approvedRegistrationCount: 2,
        hasTransportAllocations: true,
        occupiedApprovedPartySize: 2,
      })
    );
    assert.equal(decision.decision, "REQUIRE_OVERRIDE");
    if (decision.decision === "REQUIRE_OVERRIDE") {
      assert.equal(decision.reasonCode, "TRANSPORT_ALLOCATIONS_LOCKED");
    }
  });

  it("operator override authorizes capacity decrease", () => {
    const decision = evaluate(
      {
        ...BASE_TOUR,
        basicInfo: {
          ...(BASE_TOUR.basicInfo as Record<string, unknown>),
          capacityMax: 8,
        },
      },
      facts({ activeRegistrationCount: 2, approvedRegistrationCount: 2, occupiedApprovedPartySize: 5 }),
      { operatorMutationOverride: true, operatorIsOwner: true }
    );
    assert.equal(decision.decision, "ALLOW");
  });
});
