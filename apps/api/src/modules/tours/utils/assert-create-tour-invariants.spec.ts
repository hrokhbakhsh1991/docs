import test from "node:test";
import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";

import { TourLifecycleStatus } from "../entities/tour.entity";
import type { CreateTourDto } from "../dto/create-tour.dto";
import {
  assertCreateTourInvariants,
  validateTripDetailsCanonical
} from "./assert-create-tour-invariants";

function minimalDto(overrides: Partial<CreateTourDto> = {}): CreateTourDto {
  return {
    title: "1234567890ab",
    total_capacity: 10,
    lifecycle_status: TourLifecycleStatus.DRAFT,
    ...overrides
  };
}

test("allows private_car when fuelShareToman is set", () => {
  assert.doesNotThrow(() =>
    assertCreateTourInvariants(
      minimalDto({
        tripDetails: {
          logistics: {
            primaryTransportMode: "private_car",
            fuelShareToman: 100_000
          }
        }
      } as CreateTourDto)
    )
  );
});

test("rejects private_car without fuelShareToman", () => {
  try {
    assertCreateTourInvariants(
      minimalDto({
        tripDetails: {
          logistics: { primaryTransportMode: "private_car" }
        }
      } as CreateTourDto)
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /fuelShareToman/);
  }
});

test("validateTripDetailsCanonical rejects invalid merged tripDetails (ages)", () => {
  try {
    validateTripDetailsCanonical({
      participation: { minimumAge: 18, maximumAge: 10 }
    } as never);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
  }
});

test("rejects segmentActivities day beyond schedule duration", () => {
  try {
    assertCreateTourInvariants(
      minimalDto({
        tripDetails: {
          logistics: {
            departureDate: "2026-01-01",
            returnDate: "2026-01-02"
          },
          itinerary: {
            segmentActivities: [
              {
                dayNumber: 5,
                segments: []
              }
            ]
          }
        }
      } as unknown as CreateTourDto)
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /scheduled date range/);
  }
});
