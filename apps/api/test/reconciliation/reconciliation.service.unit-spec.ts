import assert from "node:assert/strict";
import test from "node:test";
import type { DataSource, EntityManager, Repository } from "typeorm";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import { TenantEntity as IdentityTenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { ReconciliationService } from "../../src/modules/reconciliation/reconciliation.service";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import { WaitlistItemStatus } from "../../src/modules/registrations/waitlist-item.entity";
import { TourEntity } from "../../src/modules/tours/entities/tour.entity";

type ReconcilePriv = (
  manager: EntityManager,
  tour: TourEntity
) => Promise<{ drift: boolean; promotions: number }>;

function asReconcile(svc: ReconciliationService): ReconcilePriv {
  const probe = svc as unknown as { reconcileSingleTour: ReconcilePriv };
  return probe.reconcileSingleTour.bind(svc);
}

test("reconciliation raises acceptedCount when stored counter is below real Accepted registrations", async () => {
  const tour: TourEntity = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    title: "t",
    totalCapacity: 10,
    acceptedCount: 1,
    lifecycleStatus: undefined as never
  } as unknown as TourEntity;

  const outbox: Array<{ eventType: string; payload: Record<string, unknown> }> =
    [];

  const registrationsService = {
    async lockTourRowForUpdate(
      _m: EntityManager,
      _tourId: string,
      _tenantId: string
    ) {
      return tour;
    },
    async promoteNextWaitlistSlotIfEligible() {
      return false;
    }
  } as unknown as RegistrationsService;

  const outboxService = {
    async addEvent(
      _m: EntityManager,
      event: { eventType: string; payload: Record<string, unknown> }
    ) {
      outbox.push({ eventType: event.eventType, payload: event.payload });
    }
  } as unknown as OutboxService;

  const manager = {
    async count() {
      return 4;
    },
    async save(entity: TourEntity) {
      tour.acceptedCount = entity.acceptedCount;
      return entity;
    },
    async exists() {
      return false;
    }
  } as unknown as EntityManager;

  const svc = new ReconciliationService(
    {} as never,
    outboxService,
    registrationsService,
    {} as Repository<IdentityTenantEntity>
  );

  const result = await asReconcile(svc)(manager, tour);
  assert.equal(result.drift, true);
  assert.equal(tour.acceptedCount, 4);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]?.eventType, "tour.capacity.reconciled");
  assert.equal(outbox[0]?.payload.oldAcceptedCount, 1);
  assert.equal(outbox[0]?.payload.correctedAcceptedCount, 4);
  assert.equal(typeof outbox[0]?.payload.detectedAt, "string");
});

test("reconciliation lowers acceptedCount when stored counter is above real Accepted registrations", async () => {
  const tour: TourEntity = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    title: "t",
    totalCapacity: 10,
    acceptedCount: 9,
    lifecycleStatus: undefined as never
  } as unknown as TourEntity;

  const outbox: Array<{ eventType: string; payload: Record<string, unknown> }> =
    [];

  const registrationsService = {
    async lockTourRowForUpdate() {
      return tour;
    },
    async promoteNextWaitlistSlotIfEligible() {
      return false;
    }
  } as unknown as RegistrationsService;

  const outboxService = {
    async addEvent(
      _m: EntityManager,
      event: { eventType: string; payload: Record<string, unknown> }
    ) {
      outbox.push({ eventType: event.eventType, payload: event.payload });
    }
  } as unknown as OutboxService;

  const manager = {
    async count() {
      return 2;
    },
    async save(entity: TourEntity) {
      tour.acceptedCount = entity.acceptedCount;
      return entity;
    },
    async exists() {
      return false;
    }
  } as unknown as EntityManager;

  const svc = new ReconciliationService(
    {} as never,
    outboxService,
    registrationsService,
    {} as Repository<IdentityTenantEntity>
  );

  await asReconcile(svc)(manager, tour);
  assert.equal(tour.acceptedCount, 2);
  assert.equal(outbox[0]?.eventType, "tour.capacity.reconciled");
  assert.equal(outbox[0]?.payload.correctedAcceptedCount, 2);
});

test("reconciliation triggers canonical promotion while capacity and Waiting items exist", async () => {
  const locked = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    title: "t",
    totalCapacity: 4,
    acceptedCount: 2,
    lifecycleStatus: undefined as never
  } as unknown as TourEntity;

  let existsWaiting = true;
  let promoteCalls = 0;

  const registrationsService = {
    async lockTourRowForUpdate() {
      return locked;
    },
    async promoteNextWaitlistSlotIfEligible(
      _m: EntityManager,
      _tenantId: string,
      _tourId: string,
      t: TourEntity
    ) {
      promoteCalls += 1;
      if (t.acceptedCount >= t.totalCapacity) {
        return false;
      }
      t.acceptedCount += 1;
      return true;
    }
  } as unknown as RegistrationsService;

  const outboxService = {
    async addEvent() {}
  } as unknown as OutboxService;

  const manager = {
    async count() {
      return 2;
    },
    async save() {
      return locked;
    },
    async exists(_entity: unknown, opts: { where: { status?: string } }) {
      return opts.where.status === WaitlistItemStatus.WAITING && existsWaiting;
    }
  } as unknown as EntityManager;

  const svc = new ReconciliationService(
    {} as never,
    outboxService,
    registrationsService,
    {} as Repository<IdentityTenantEntity>
  );

  const { drift, promotions } = await asReconcile(svc)(manager, locked);
  assert.equal(drift, false);
  assert.equal(promotions, 2);
  assert.equal(locked.acceptedCount, 4);
  assert.equal(promoteCalls, 2);
});

test("reconciliation stops promotion loop when promote fails", async () => {
  const locked = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    title: "t",
    totalCapacity: 10,
    acceptedCount: 1,
    lifecycleStatus: undefined as never
  } as unknown as TourEntity;

  const registrationsService = {
    async lockTourRowForUpdate() {
      return locked;
    },
    async promoteNextWaitlistSlotIfEligible() {
      throw new Error("simulated promotion failure");
    }
  } as unknown as RegistrationsService;

  const outboxService = {
    async addEvent() {}
  } as unknown as OutboxService;

  const manager = {
    async count() {
      return 1;
    },
    async save() {
      return locked;
    },
    async exists() {
      return true;
    }
  } as unknown as EntityManager;

  const svc = new ReconciliationService(
    {} as never,
    outboxService,
    registrationsService,
    {} as Repository<IdentityTenantEntity>
  );

  const { promotions } = await asReconcile(svc)(manager, locked);
  assert.equal(promotions, 0);
});

test("runReconciliationCycle aggregates drift and promotion totals across tours", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const tourA: TourEntity = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId,
    title: "a",
    totalCapacity: 3,
    acceptedCount: 0,
    lifecycleStatus: undefined as never
  } as unknown as TourEntity;

  const events: Array<{ eventType: string }> = [];

  const registrationsService = {
    async lockTourRowForUpdate() {
      return tourA;
    },
    async promoteNextWaitlistSlotIfEligible(
      _m: EntityManager,
      _tid: string,
      _tourId: string,
      t: TourEntity
    ) {
      if (t.acceptedCount >= t.totalCapacity) {
        return false;
      }
      t.acceptedCount += 1;
      return true;
    }
  } as unknown as RegistrationsService;

  const outboxService = {
    async addEvent(
      _m: EntityManager,
      event: { eventType: string }
    ) {
      events.push({ eventType: event.eventType });
    }
  } as unknown as OutboxService;

  const identityTenantRepository = {
    async find() {
      return [{ id: tenantId } as IdentityTenantEntity];
    }
  } as unknown as Repository<IdentityTenantEntity>;

  const unifiedMgr = {
    async query() {},
    async find(_entity: unknown, opts?: { skip?: number }) {
      if ((opts?.skip ?? 0) > 0) {
        return [];
      }
      return [tourA];
    },
    async count() {
      return 2;
    },
    async save(entity: TourEntity) {
      tourA.acceptedCount = entity.acceptedCount;
      return entity;
    },
    async exists() {
      return true;
    }
  } as unknown as EntityManager;

  const dataSource = {
    async transaction<T>(fn: (m: EntityManager) => Promise<T>): Promise<T> {
      return fn(unifiedMgr);
    }
  } as unknown as DataSource;

  const svc = new ReconciliationService(
    dataSource,
    outboxService,
    registrationsService,
    identityTenantRepository
  );

  await svc.runReconciliationCycle();

  const snap = svc.getSnapshot();
  assert.equal(snap.lastRunHadDrift, true);
  assert.equal(snap.promotedInLastRun, 1);
  assert.equal(snap.totalDriftsDetected >= 1, true);
  assert.equal(snap.totalCorrectionsApplied >= 1, true);
  assert.equal(snap.totalPromotionsTriggered >= 1, true);
  assert.equal(events.some((e) => e.eventType === "tour.capacity.reconciled"), true);
  assert.equal(tourA.acceptedCount, 3);
});
