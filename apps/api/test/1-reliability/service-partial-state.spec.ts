/**
 * Reliability — ToursService.createTour partial-state / fault between validation and persist.
 *
 * Architecture under test:
 *   ToursService.createTour
 *     → CanonicalTourService.writeTour
 *       → runPreTransactionValidation (sync; opens pre-TX gate)
 *         → validateCanonicalBeforePersist (sync; new PlatformWizardEngine per call — CRIT-STATE-01)
 *       → persistViaScopedRepository | persistViaCanonicalTransaction (first await)
 *
 * Fault seam (test-only, no production hook):
 *   {@link FaultAfterValidationRepository} throws on first `createTour` while the
 *   pre-transaction validation gate is still open — models a crash after RULE-003
 *   validation succeeds and before any storage write completes.
 *
 * RuleEngine path: not injectable at repository boundary; spied indirectly via
 * `isPreTransactionValidationGateOpenForTests` at fault time (proves validateCanonical ran).
 * PlatformWizardEngine is constructed per call in canonical-validation.ts — no singleton to leak.
 *
 * Proves application-layer cleanliness on memory driver (not DB rollback):
 *   - No ghost tours / projection rows in {@link InMemoryTourRepository}
 *   - Legacy mirror stays empty
 *   - Validation gate cleared in `finally` ({@link clearPreTransactionValidationGate})
 *   - No TourCreated on domain event bus before persist succeeds
 *   - Retry with a new request succeeds; exactly one tour for the tenant ("clean retry")
 *
 * Atomic Prisma path (`useAtomicCanonicalPersist`) is covered by chaos specs; skipped here.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/1-reliability/service-partial-state.spec.ts
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import type { DomainEventEnvelope } from "@app-tour/platform-events";
import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { isPreTransactionValidationGateOpenForTests } from "../../src/canonical/pre-transaction-validation";
import { deriveTourProjections } from "../../src/canonical/projection-sync";
import type { TourCreatedPayload } from "../../src/canonical/publish-tour-created";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { useAtomicCanonicalPersist } from "../../src/storage/create-tour-storage";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository";
import type { Tour } from "../../src/storage/tour-storage.interface";
import { validateCanonicalBeforePersist } from "../../src/tours/canonical-validation";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const FAULT_ERROR = "P5_FAULT_INJECT_AFTER_VALIDATION";
const VALID_TOUR_BODY = {
  data: { basics: { title: "partial-state-retry" }, details: { summary: "ok" } },
} as const;

class CreateCountingRepository extends InMemoryTourRepository {
  createTourCalls = 0;

  override async createTour(input: {
    tenantId: string;
    canonical: Tour["canonical"];
  }): Promise<Tour> {
    this.createTourCalls += 1;
    return super.createTour(input);
  }
}

/**
 * Storage spy — counts persist boundary calls and detects partial writes via `save`.
 * Simulates process death after validation, at the first persist boundary.
 */
class FaultAfterValidationRepository extends InMemoryTourRepository {
  createTourCalls = 0;
  saveCalls = 0;
  listByTenantCalls = 0;
  faultInjected = false;
  /** Set when fault fires while pre-TX gate is open (RuleEngine path completed). */
  ruleEnginePathConfirmed = false;

  override async save(tour: Tour): Promise<void> {
    this.saveCalls += 1;
    return super.save(tour);
  }

  override async listByTenant(tenantId: string): Promise<Tour[]> {
    this.listByTenantCalls += 1;
    return super.listByTenant(tenantId);
  }

  override async createTour(input: {
    tenantId: string;
    canonical: Tour["canonical"];
  }): Promise<Tour> {
    this.createTourCalls += 1;
    if (!this.faultInjected) {
      assert.equal(
        isPreTransactionValidationGateOpenForTests(input.tenantId),
        true,
        "fault must fire only after runPreTransactionValidation (gate open = RuleEngine path ran)"
      );
      this.ruleEnginePathConfirmed = true;
      this.faultInjected = true;
      throw new Error(FAULT_ERROR);
    }
    return super.createTour(input);
  }
}

type PartialStateHarness = {
  readonly tenantId: string;
  readonly store: FaultAfterValidationRepository;
  readonly service: ToursService;
  readonly legacy: LegacyCanonicalAdapter;
  readonly capturedEvents: DomainEventEnvelope<TourCreatedPayload>[];
};

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "partial-state-user",
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-partial-state",
  };
}

function createPartialStateHarness(): PartialStateHarness {
  const tenantId = integrationTenantId();
  const store = new FaultAfterValidationRepository();
  const legacy = new LegacyCanonicalAdapter();
  const service = new ToursService(
    new CanonicalTourService(new TourStorageDbAdapter(store), legacy),
    { resolveWorkspaceType: async () => "starter" }
  );
  const capturedEvents: DomainEventEnvelope<TourCreatedPayload>[] = [];
  subscribeDomainEvent<TourCreatedPayload>("TourCreated", (evt) => {
    capturedEvents.push(evt);
  });

  return { tenantId, store, service, legacy, capturedEvents };
}

async function tenantTourCount(store: InMemoryTourRepository, tenantId: string): Promise<number> {
  return (await store.listByTenant(tenantId)).length;
}

describe("1-reliability — ToursService partial state (validation → persist fault)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    assert.equal(
      useAtomicCanonicalPersist(),
      false,
      "memory driver must use scoped repository persist (non-atomic app path)"
    );
  });

  beforeEach(() => {
    resetDomainEventBusForTests();
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("REL-PARTIAL-01: propagates persist fault to caller after validation succeeds", async () => {
    const { tenantId, store, service } = createPartialStateHarness();

    await assert.rejects(
      () => service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, FAULT_ERROR);
        return true;
      }
    );

    assert.equal(store.createTourCalls, 1, "persist attempted once then faulted");
    assert.equal(store.ruleEnginePathConfirmed, true, "RuleEngine path ran before persist fault");
  });

  it("REL-PARTIAL-02: leaves zero tours and no partial save after validation→persist fault", async () => {
    const { tenantId, store, service } = createPartialStateHarness();

    await assert.rejects(
      () => service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY }),
      (error: unknown) => error instanceof Error && error.message === FAULT_ERROR
    );

    assert.equal(store.saveCalls, 0, "save must not run when createTour faults before super");
    assert.equal(await tenantTourCount(store, tenantId), 0, "no ghost tour in memory store");

    const listed = await store.listByTenant(tenantId);
    assert.equal(listed.length, 0);
    for (const tour of listed) {
      const projections = deriveTourProjections(tour.canonical);
      assert.fail(`unexpected projection artifact: title=${projections.title}`);
    }
  });

  it("REL-PARTIAL-03: clears pre-transaction validation gate in finally", async () => {
    const { tenantId, store, service } = createPartialStateHarness();

    await assert.rejects(
      () => service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY }),
      (error: unknown) => error instanceof Error && error.message === FAULT_ERROR
    );

    assert.equal(
      isPreTransactionValidationGateOpenForTests(tenantId),
      false,
      "finally must clear pre-transaction validation gate"
    );
    assert.equal(store.ruleEnginePathConfirmed, true);
  });

  it("REL-PARTIAL-04: does not publish TourCreated or pollute legacy mirror on persist fault", async () => {
    const { tenantId, store, service, legacy, capturedEvents } = createPartialStateHarness();

    await assert.rejects(
      () => service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY }),
      (error: unknown) => error instanceof Error && error.message === FAULT_ERROR
    );

    assert.equal(
      capturedEvents.length,
      0,
      "TourCreated must not publish before successful persist"
    );
    assert.equal(legacy.listMirroredTours().length, 0, "no legacy mirror pollution");
    assert.equal(store.saveCalls, 0);
  });

  it("REL-PARTIAL-05: clean retry persists exactly one tour after validation→persist fault", async () => {
    const { tenantId, store, service } = createPartialStateHarness();

    await assert.rejects(
      () => service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY }),
      (error: unknown) => error instanceof Error && error.message === FAULT_ERROR
    );

    assert.equal(await tenantTourCount(store, tenantId), 0);

    const record = await service.createTour(authForTenant(tenantId), {
      data: { basics: { title: "partial-state-retry-2" }, details: { summary: "ok" } },
    });

    assert.equal(store.createTourCalls, 2, "first fault + one successful persist");
    assert.equal(store.saveCalls, 1, "exactly one save on successful retry");
    assert.equal(await tenantTourCount(store, tenantId), 1);
    assert.ok(record.id.length > 0);
    assert.equal(record.tenantId, tenantId);
    assert.equal(
      isPreTransactionValidationGateOpenForTests(tenantId),
      false,
      "gate cleared after successful write"
    );

    const loaded = await service.getTourById(authForTenant(tenantId), record.id);
    assert.ok(loaded !== null);
    assert.equal(loaded.id, record.id);

    const projections = deriveTourProjections(loaded.canonical);
    assert.equal(projections.title, "partial-state-retry-2");
  });

  it("REL-PARTIAL-06: RuleEngine is per-call — validation path does not retain partial tour state", async () => {
    const { tenantId, store, service } = createPartialStateHarness();

    await assert.rejects(
      () => service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY }),
      (error: unknown) => error instanceof Error && error.message === FAULT_ERROR
    );

    assert.equal(store.ruleEnginePathConfirmed, true);

    const independentValidation = await validateCanonicalBeforePersist({
      body: {
        data: { basics: { title: "independent-validation" }, details: { summary: "ok" } },
      },
      tenantId,
      workspaceType: "starter",
    });
    assert.equal(
      (independentValidation.data?.basics as { title?: string } | undefined)?.title,
      "independent-validation",
      "fresh PlatformWizardEngine per call — no leaked partial document from failed write"
    );
  });

  it("REL-PARTIAL-07: successful create does not leave validation gate open", async () => {
    const tenantId = integrationTenantId();
    const store = new CreateCountingRepository();
    const service = new ToursService(
      new CanonicalTourService(new TourStorageDbAdapter(store), new LegacyCanonicalAdapter()),
      { resolveWorkspaceType: async () => "starter" }
    );

    await service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY });

    assert.equal(store.createTourCalls, 1);
    assert.equal(await tenantTourCount(store, tenantId), 1);
    assert.equal(isPreTransactionValidationGateOpenForTests(tenantId), false);
  });

  it.skip("atomic Prisma persist: covered by chaos/atomic-rollback-stress (requires DATABASE_URL)", () => {
    if (!useAtomicCanonicalPersist()) {
      return;
    }
    // persistViaCanonicalTransaction + P5_CHAOS_ABORT — see apps/api/test/chaos/
  });
});
