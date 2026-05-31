import assert from "node:assert/strict";
import test from "node:test";
import { RegistrationPlacementService } from "../../src/modules/registrations/services/registration-placement.service";
import { RegistrationStatus } from "../../src/modules/registrations/registration.entity";
import type { ParticipantMetadataDto } from "../../src/modules/registrations/dto/participant-metadata.dto";
import type { TourCatalogSnapshot } from "../../src/modules/registrations/domain/ports/registrations-tour-catalog.port";

type PlacementResult = {
  status: RegistrationStatus;
  consumesAcceptedCapacity: boolean;
};

function resolvePlacement(
  service: RegistrationPlacementService,
  tour: Partial<TourCatalogSnapshot>,
  participantMetadata?: ParticipantMetadataDto,
  tripDetails?: Record<string, unknown> | null,
): PlacementResult {
  return service.resolveInitialRegistrationPlacement(
    tour as TourCatalogSnapshot,
    participantMetadata,
    tripDetails ?? null,
  );
}

function placementService(): RegistrationPlacementService {
  return new RegistrationPlacementService({} as never);
}

test("paid tour with autoAcceptRegistrations stays Pending (PLACE-02)", () => {
  const service = placementService();
  const result = resolvePlacement(service, {
    autoAcceptRegistrations: true,
    costContext: { requiresPayment: true }
  });
  assert.equal(result.status, RegistrationStatus.PENDING);
  assert.equal(result.consumesAcceptedCapacity, false);
});

test("free tour with autoAcceptRegistrations accepts immediately", () => {
  const service = placementService();
  const result = resolvePlacement(service, {
    autoAcceptRegistrations: true,
    costContext: { requiresPayment: false }
  });
  assert.equal(result.status, RegistrationStatus.ACCEPTED);
  assert.equal(result.consumesAcceptedCapacity, true);
});

test("paid tour without autoAccept stays Pending", () => {
  const service = placementService();
  const result = resolvePlacement(service, {
    autoAcceptRegistrations: false,
    costContext: { requiresPayment: true }
  });
  assert.equal(result.status, RegistrationStatus.PENDING);
  assert.equal(result.consumesAcceptedCapacity, false);
});

test("requires_payment snake_case forces Pending when auto-accept", () => {
  const service = placementService();
  const result = resolvePlacement(service, {
    autoAcceptRegistrations: true,
    costContext: { requires_payment: true }
  });
  assert.equal(result.status, RegistrationStatus.PENDING);
  assert.equal(result.consumesAcceptedCapacity, false);
});

test("Peak-Experience auto-accepts paid tour when user peaks meet minimum (Phase 16.9)", () => {
  const service = placementService();
  const result = resolvePlacement(
    service,
    {
      autoAcceptRegistrations: true,
      costContext: { requiresPayment: true },
    },
    { userPastPeaksCount: 3 },
    { requirements: { minRequiredPeaks: 2 } },
  );
  assert.equal(result.status, RegistrationStatus.ACCEPTED);
  assert.equal(result.consumesAcceptedCapacity, true);
});

test("Peak-Experience does not auto-accept when user peaks below minimum", () => {
  const service = placementService();
  const result = resolvePlacement(
    service,
    { costContext: { requiresPayment: true } },
    { userPastPeaksCount: 1 },
    { requirements: { minRequiredPeaks: 3 } },
  );
  assert.equal(result.status, RegistrationStatus.PENDING);
  assert.equal(result.consumesAcceptedCapacity, false);
});
