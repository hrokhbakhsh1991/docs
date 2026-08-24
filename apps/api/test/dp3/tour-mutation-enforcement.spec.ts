/**
 * DP-3 — tour mutation safety enforcement on PATCH write path
 * @see docs/workspaces/denali/tour-mutation-safety.mdoc
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  DENALI_TOUR_MUTATION_BLOCKED,
  DENALI_TOUR_MUTATION_OVERRIDE_REQUIRED,
} from "@app-tour/workspace-denali/host/http";

import { assertWorkspaceTourMutationPolicy } from "../../src/tours/assert-workspace-tour-mutation-policy";
import { getBookingsRepository, resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository";
import {
  listTourMutationOutboxForTests,
  resetTourMutationOutboxForTests,
} from "../../src/tours/emit-tour-mutation-side-effects";
import { resolveTourMutationFacts } from "../../src/tours/resolve-tour-mutation-facts";
import {
  getSettingsResourcesRepository,
  resetSettingsResourcesRepositorySingletonForTests,
} from "../../src/settings/create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "../../src/settings/seed-operator-smoke-catalog";
import { OPERATOR_SMOKE } from "../fixtures/operator-smoke-e2e-tenant";
import { seedOperatorBookingsFixture } from "../fixtures/operator-bookings-fixture";
import { seedOperatorIdentityFixture } from "../fixtures/operator-identity-fixture";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "../test-helpers";

installMemoryStorageDriverForDescribe();

const ownerAuth: TenantAuthContext = {
  userId: OPERATOR_SMOKE.ownerUserId,
  tenantId: OPERATOR_SMOKE.tenantId,
  role: "owner",
  status: "ACTIVE",
  workspaceId: "ws-operator-smoke",
};

async function loadSmokeTourData() {
  const store = createSharedMemoryTourStoreForHttpTests();
  const toursService = createTestToursService(store);
  const tour = await toursService.getTourById(ownerAuth, OPERATOR_SMOKE.seedTourId);
  assert.ok(tour);
  return {
    store,
    toursService,
    tour,
    beforeData: tour.canonical.data as Record<string, unknown>,
  };
}

describe("dp3/tour-mutation-enforcement", () => {
  before(async () => {
    resetTourMutationOutboxForTests();
    seedOperatorIdentityFixture();
    seedOperatorBookingsFixture();
    resetSettingsResourcesRepositorySingletonForTests();
    const settingsRepo = getSettingsResourcesRepository();
    await seedOperatorSmokeCatalog(settingsRepo);
  });

  it("DP3-POLICY-01 blocks frozen destination with stable error", async () => {
    const { beforeData } = await loadSmokeTourData();
    const facts = await resolveTourMutationFacts({
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourData: beforeData,
    });

    await expectBlocked(
      () =>
        assertWorkspaceTourMutationPolicy({
          workspaceType: "denali",
          auth: ownerAuth,
          beforeData,
          afterData: {
            ...beforeData,
            basicInfo: {
              ...(beforeData.basicInfo as Record<string, unknown>),
              destinationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            },
          },
          facts,
        }),
      DENALI_TOUR_MUTATION_BLOCKED,
      "FIELD_FROZEN_AFTER_REGISTRATION"
    );
  });

  it("DP3-API-02 safe title edit after registrations succeeds on write path", async () => {
    const { toursService, tour } = await loadSmokeTourData();

    const updated = await toursService.updateTour(ownerAuth, OPERATOR_SMOKE.seedTourId, {
      rowVersion: tour.rowVersion,
      data: {
        basicInfo: {
          title: "North Ridge Trek (updated copy)",
        },
      },
    });

    const title = (updated.canonical.data as { basicInfo?: { title?: string } }).basicInfo?.title;
    assert.equal(title, "North Ridge Trek (updated copy)");
  });

  it("DP3-POLICY-03 price change after payment is blocked", async () => {
    const store = createSharedMemoryTourStoreForHttpTests();
    const toursService = createTestToursService(store);
    const paidTourId = OPERATOR_SMOKE_DRAFT_TOUR_ID;
    const tour = await toursService.getTourById(ownerAuth, paidTourId);
    assert.ok(tour);
    const beforeData = tour.canonical.data as Record<string, unknown>;
    const facts = await resolveTourMutationFacts({
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: paidTourId,
      tourData: beforeData,
    });

    await expectBlocked(
      () =>
        assertWorkspaceTourMutationPolicy({
          workspaceType: "denali",
          auth: ownerAuth,
          beforeData,
          afterData: {
            ...beforeData,
            pricingPayment: {
              ...(beforeData.pricingPayment as Record<string, unknown>),
              basePricePerPerson: 999_999,
            },
          },
          facts,
        }),
      DENALI_TOUR_MUTATION_BLOCKED,
      "FIELD_FROZEN_AFTER_PAYMENT"
    );
  });

  it("DP3-API-04 approved-unpaid price change emits repricing side effect", async () => {
    resetTourMutationOutboxForTests();
    const { toursService, tour, beforeData } = await loadSmokeTourData();
    const repo = getBookingsRepository();

    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000399",
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "North Ridge Trek",
      guestLabel: "Approved Guest",
      partySize: 2,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      submittedAt: new Date().toISOString(),
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: new Date().toISOString(),
      registrationIntake: { tourCapacityMax: 12 },
    });

    await toursService.updateTour(ownerAuth, OPERATOR_SMOKE.seedTourId, {
      rowVersion: tour.rowVersion,
      data: {
        pricingPayment: {
          ...((beforeData.pricingPayment as Record<string, unknown> | undefined) ?? {}),
          basePricePerPerson: 650_000,
        },
      },
    });

    const outbox = listTourMutationOutboxForTests();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.eventType, "tour.mutation.repricing_required");
  });

  it("DP3-API-05 schedule change emits notification side effect", async () => {
    resetTourMutationOutboxForTests();
    const { toursService, tour, beforeData } = await loadSmokeTourData();

    await toursService.updateTour(ownerAuth, OPERATOR_SMOKE.seedTourId, {
      rowVersion: tour.rowVersion,
      data: {
        basicInfo: {
          ...((beforeData.basicInfo as Record<string, unknown> | undefined) ?? {}),
          startDateTime: "2026-12-01T08:00:00.000Z",
        },
      },
    });

    const outbox = listTourMutationOutboxForTests();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.eventType, "tour.mutation.notification_required");
  });

  it("DP3-POLICY-06 capacity below occupied rejected", async () => {
    const { beforeData } = await loadSmokeTourData();
    const repo = getBookingsRepository();

    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000398",
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "North Ridge Trek",
      guestLabel: "Big Party",
      partySize: 8,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      submittedAt: new Date().toISOString(),
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: new Date().toISOString(),
      registrationIntake: { tourCapacityMax: 12 },
    });

    const facts = await resolveTourMutationFacts({
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourData: beforeData,
    });

    await expectBlocked(
      () =>
        assertWorkspaceTourMutationPolicy({
          workspaceType: "denali",
          auth: ownerAuth,
          beforeData,
          afterData: {
            ...beforeData,
            basicInfo: {
              ...(beforeData.basicInfo as Record<string, unknown>),
              capacityMax: 4,
            },
          },
          facts,
        }),
      DENALI_TOUR_MUTATION_BLOCKED,
      "CAPACITY_BELOW_OCCUPIED"
    );
  });

  it("DP3-API-07 capacity increase allowed", async () => {
    const { toursService, tour, beforeData } = await loadSmokeTourData();

    const updated = await toursService.updateTour(ownerAuth, OPERATOR_SMOKE.seedTourId, {
      rowVersion: tour.rowVersion,
      data: {
        basicInfo: {
          ...((beforeData.basicInfo as Record<string, unknown> | undefined) ?? {}),
          capacityMax: 30,
        },
      },
    });

    const capacity = (updated.canonical.data as { basicInfo?: { capacityMax?: number } }).basicInfo
      ?.capacityMax;
    assert.equal(capacity, 30);
  });

  it("DP3-POLICY-08 transport mutation with allocations requires override", async () => {
    const { beforeData } = await loadSmokeTourData();
    const facts = await resolveTourMutationFacts({
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourData: {
        ...beforeData,
        transport: {
          ...(beforeData.transport as Record<string, unknown>),
          allocations: [{ seatId: "A1" }],
        },
      },
    });

    await expectBlocked(
      () =>
        assertWorkspaceTourMutationPolicy({
          workspaceType: "denali",
          auth: ownerAuth,
          beforeData,
          afterData: {
            ...beforeData,
            transport: {
              ...(beforeData.transport as Record<string, unknown>),
              transportMode: "none",
              allocations: [{ seatId: "A1" }],
            },
          },
          facts,
        }),
      DENALI_TOUR_MUTATION_OVERRIDE_REQUIRED,
      "TRANSPORT_ALLOCATIONS_LOCKED"
    );
  });

  it("DP3-API-09 owner override allows capacity decrease above occupied", async () => {
    resetBookingsRepositoryForTests();
    seedOperatorBookingsFixture();
    const { toursService, tour, beforeData } = await loadSmokeTourData();
    const repo = getBookingsRepository();

    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000397",
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "North Ridge Trek",
      guestLabel: "Party",
      partySize: 4,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      submittedAt: new Date().toISOString(),
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: new Date().toISOString(),
      registrationIntake: { tourCapacityMax: 12 },
    });

    const updated = await toursService.updateTour(ownerAuth, OPERATOR_SMOKE.seedTourId, {
      rowVersion: tour.rowVersion,
      operatorMutationOverride: true,
      data: {
        basicInfo: {
          ...((beforeData.basicInfo as Record<string, unknown> | undefined) ?? {}),
          capacityMax: 8,
        },
      },
    });

    const capacity = (updated.canonical.data as { basicInfo?: { capacityMax?: number } }).basicInfo
      ?.capacityMax;
    assert.equal(capacity, 8);
    assert.ok((await repo.getById("00000000-0000-4000-8000-000000000397", OPERATOR_SMOKE.tenantId)) !== null);
  });
});

const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";

function expectBlocked(run: () => void, code: string, reasonCode: string): void {
  assert.throws(
    run,
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { code?: string }).code, code);
      assert.equal((error as { reasonCode?: string }).reasonCode, reasonCode);
      return true;
    }
  );
}
