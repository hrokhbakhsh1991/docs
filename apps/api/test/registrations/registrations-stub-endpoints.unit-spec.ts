import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { TypeOrmRegistrationsWriteRepository } from "../../src/modules/registrations/repositories/typeorm-registrations-write.repository";
import { RegistrationPaymentUpdatedLedgerListener } from "../../src/modules/finance/listeners/registration-payment-updated-ledger.listener";
import { RegistrationFinancialMutationAdapter } from "../../src/modules/registrations/repositories/registration-finance-port.adapters";
import { LedgerCommandBus } from "../../src/modules/finance/ledger/ledger-command-bus";
import { BookingLedgerAuthorityService } from "../../src/modules/finance/ledger/booking-ledger-authority.service";
import { mockLedgerPersistEntityManager } from "../../src/modules/finance/ledger/test/mock-ledger-entity-manager";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";
import { PaymentEntity } from "../../src/modules/payments/entities/payment.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import {
  WaitlistItemEntity,
  WaitlistItemStatus
} from "../../src/modules/registrations/waitlist-item.entity";
import { TEST_REGISTRATION_ID } from "../helpers/finance-contract-fixtures";
import {
  createLeaderRequestContext,
  createRegistrationsApplicationFacade,
} from "../helpers/registrations-application.harness";

function createServiceHarness() {
  const registration = {
    id: TEST_REGISTRATION_ID,
    tenantId: "11111111-1111-4111-8111-111111111111",
    tourId: "tour-1",
    tourDepartureId: "tour-1",
    participantFullName: "User One",
    participantContactPhone: "+989120000001",
    transportMode: "group_vehicle",
    entryMode: "web",
    status: RegistrationStatus.PENDING,
    paymentStatus: RegistrationPaymentStatus.NOT_PAID,
    paidAmount: undefined,
    quotedCurrencyCode: "IRR",
    rowVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  } as RegistrationEntity;
  const tour = {
    id: "tour-1",
    tenantId: registration.tenantId,
    totalCapacity: 2,
    acceptedCount: 0,
    lifecycleStatus: TourLifecycleStatus.OPEN
  } as TourEntity;
  const waitlist = {
    id: "wait-1",
    tenantId: registration.tenantId,
    tourId: "tour-1",
    tourDepartureId: "tour-1",
    participantFullName: "Wait One",
    participantContactPhone: "+989120000111",
    transportMode: "group_vehicle",
    entryMode: "web",
    status: WaitlistItemStatus.WAITING,
    conversionReason: undefined,
    cancelReason: undefined,
    promotedRegistrationId: undefined,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  } as WaitlistItemEntity;
  const events: string[] = [];

  const waitlistRepoBuilder = {
    setLock() {
      return this;
    },
    setOnLocked() {
      return this;
    },
    where(_: string, params: Record<string, string>) {
      if (params.waitlistItemId && params.waitlistItemId !== waitlist.id) {
        return {
          ...this,
          getOne: async () => null
        };
      }
      return this;
    },
    andWhere() {
      return this;
    },
    orderBy() {
      return this;
    },
    async getOne() {
      return { ...waitlist };
    }
  };

  const tourRepoBuilder = {
    setLock() {
      return this;
    },
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    async getOne() {
      return { ...tour };
    }
  };

  const manager = {
    async query(sql: string) {
      if (sql.includes("INSERT INTO ledger_journal_lines")) {
        return [{ id: "line-inserted" }];
      }
      if (sql.includes("ledger_journal_batches") || sql.includes("account_balances")) {
        return [];
      }
      return [];
    },
    async update() {
      return { affected: 1, raw: [], generatedMaps: [] };
    },
    async exists(
      entity: unknown,
      options: { where: Record<string, unknown> | Record<string, unknown>[] }
    ): Promise<boolean> {
      const name = (entity as { name?: string }).name;
      const clauses = Array.isArray(options.where) ? options.where : [options.where];
      if (name === RegistrationEntity.name) {
        return clauses.some((c) => (c as { id?: string }).id === registration.id);
      }
      if (name === BookingPriceSnapshotEntity.name) {
        return clauses.some(
          (c) =>
            (c as { bookingId?: string }).bookingId === registration.id &&
            (c as { tenantId?: string }).tenantId === registration.tenantId,
        );
      }
      if (name === PaymentEntity.name) {
        return false;
      }
      return false;
    },
    async findOne(
      entity: unknown,
      options: {
        where:
          | { id?: string; tenantId?: string; deletedAt?: unknown; select?: unknown }
          | Array<{ id?: string; tenantId?: string; participantContactPhone?: string }>;
      }
    ) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        const clauses = Array.isArray(options.where) ? options.where : [options.where];
        if (clauses.length === 1) {
          const w = clauses[0] as Record<string, unknown>;
          if (
            typeof w.id === "string" &&
            typeof w.tenantId === "string" &&
            !("participantContactPhone" in w)
          ) {
            if (w.tenantId === registration.tenantId) {
              if (w.id === registration.id) {
                return { ...registration };
              }
              return { id: w.id, tenantId: w.tenantId };
            }
          }
        }
        const match = clauses.find((clause) => {
          const w = clause as Record<string, unknown>;
          return (
            w.id === registration.id &&
            (!w.tenantId || w.tenantId === registration.tenantId) &&
            (!w.participantContactPhone ||
              w.participantContactPhone === registration.participantContactPhone)
          );
        });
        return match ? { ...registration } : null;
      }
      return null;
    },
    async save(entityOrClass?: unknown, maybeEntity?: unknown) {
      const target =
        maybeEntity !== undefined ? (entityOrClass as { name?: string }) : undefined;
      const entity = maybeEntity !== undefined ? maybeEntity : entityOrClass;

      if (target?.name === BookingPriceSnapshotEntity.name) {
        const row = entity as Record<string, unknown>;
        return { ...row, snapshotId: "snap-stub-1" };
      }

      const waitlistCandidate = entity as WaitlistItemEntity;
      if (
        waitlistCandidate.id === waitlist.id &&
        ("cancelReason" in waitlistCandidate || "conversionReason" in waitlistCandidate)
      ) {
        Object.assign(waitlist, waitlistCandidate);
        waitlist.updatedAt = new Date("2026-01-02T00:00:00.000Z");
        return { ...waitlist };
      }
      const registrationCandidate = entity as RegistrationEntity;
      if (registrationCandidate.tourId && registrationCandidate.participantContactPhone) {
        if (registrationCandidate.id === registration.id) {
          const prevV = registration.rowVersion ?? 1;
          Object.assign(registration, registrationCandidate);
          registration.rowVersion = prevV + 1;
          registration.updatedAt = new Date("2026-01-02T00:00:00.000Z");
          return { ...registration };
        }
        const promoted = {
          ...registrationCandidate,
          id: registrationCandidate.id ?? "reg-promoted-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z")
        };
        return promoted;
      }
      const tourCandidate = entity as TourEntity;
      if (tourCandidate.id === tour.id) {
        Object.assign(tour, tourCandidate);
        return { ...tour };
      }
      return entity;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    getRepository(entity: unknown) {
      if ((entity as { name?: string }).name === WaitlistItemEntity.name) {
        return {
          createQueryBuilder() {
            return waitlistRepoBuilder;
          }
        };
      }
      if ((entity as { name?: string }).name === TourEntity.name) {
        return {
          createQueryBuilder() {
            return tourRepoBuilder;
          }
        };
      }
      throw new Error("unsupported repository");
    }
  };

  const outboxService = {
    async addEvent(
      _manager: unknown,
      event: { eventType: string }
    ): Promise<void> {
      events.push(event.eventType);
    }
  };

  const tourCatalogState = {
    id: tour.id,
    tenantId: tour.tenantId,
    acceptedCount: tour.acceptedCount,
    totalCapacity: tour.totalCapacity,
    lifecycleStatus: tour.lifecycleStatus,
  };
  Object.defineProperty(tour, "acceptedCount", {
    configurable: true,
    enumerable: true,
    get() {
      return tourCatalogState.acceptedCount;
    },
    set(value: number) {
      tourCatalogState.acceptedCount = value;
    },
  });

  const writeRepo = new TypeOrmRegistrationsWriteRepository(
    { manager } as never,
    outboxService as never
  );
  const service = createRegistrationsApplicationFacade({
    manager: manager as EntityManager,
    tour: tourCatalogState,
    captureOutboxEventTypes: events,
    requestContext: createLeaderRequestContext(registration.tenantId),
    records: [registration],
  });

  return { service, writeRepo, registration, waitlist, tour, events, manager };
}

test("saveRegistrationPaymentUpdate emits registration.payment_updated for finance listener", async () => {
  const { writeRepo, registration, events, manager } = createServiceHarness();
  const updated = await writeRepo.saveRegistrationPaymentUpdate(
    registration as any,
    RegistrationPaymentStatus.PAID,
    "2500",
    "idem-stub-1",
    "actor-1"
  );
  assert.equal(updated.paymentStatus, RegistrationPaymentStatus.PAID);
  assert.ok(events.includes("registration.payment_updated"));
  assert.equal(events.includes("finance.ledger.double_entry_applied"), false);

  const ledgerBus = new LedgerCommandBus(new BookingLedgerAuthorityService({
    async addEvent(_manager: unknown, event: { eventType: string }) {
      events.push(event.eventType);
    },
  } as never));
  const listener = new RegistrationPaymentUpdatedLedgerListener(
    ledgerBus,
    new RegistrationFinancialMutationAdapter()
  );
  const ledgerManager = {
    ...mockLedgerPersistEntityManager(),
    findOne: manager.findOne.bind(manager),
    save: manager.save.bind(manager),
  };
  await listener.handle(
    ledgerManager as never,
    registration.tenantId,
    "outbox-stub-1",
    {
      entityId: registration.id,
      metadata: {
        paymentStatus: RegistrationPaymentStatus.PAID,
        paidAmount: "2500",
        idempotencyKey: "idem-stub-1",
      },
    }
  );

  const reloaded = (await manager.findOne(RegistrationEntity, {
    where: { id: registration.id, tenantId: registration.tenantId },
  })) as RegistrationEntity | null;
  assert.equal(reloaded?.paidAmount, "2500");
  assert.ok(events.includes("finance.ledger.double_entry_applied"));
});

test("convertWaitlistItem converts waiting item and emits conversion events", async () => {
  const { service, waitlist, tour, events } = createServiceHarness();
  const converted = await service.convertWaitlistItem(waitlist.id, {
    conversionReason: "capacity_available"
  });
  assert.equal(converted.status, WaitlistItemStatus.CONVERTED);
  assert.equal(converted.conversionReason, "capacity_available");
  assert.equal(tour.acceptedCount, 1);
  assert.deepEqual(events, [
    "booking.created",
    "waitlist.converted",
    "registration.accepted",
  ]);
});

test("cancelWaitlistItem cancels waiting item and emits cancellation event", async () => {
  const { service, waitlist, events } = createServiceHarness();
  const cancelled = await service.cancelWaitlistItem(waitlist.id, {
    reason: "participant_requested"
  });
  assert.equal(cancelled.status, WaitlistItemStatus.CANCELLED);
  assert.equal(cancelled.cancelReason, "participant_requested");
  assert.deepEqual(events, ["waitlist.cancelled"]);
});

test("cancelWaitlistItem rejects non-waiting items", async () => {
  const { service, waitlist } = createServiceHarness();
  await service.cancelWaitlistItem(waitlist.id, { reason: "first" });
  await assert.rejects(
    () => service.cancelWaitlistItem(waitlist.id, { reason: "second" }),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "STATE_TRANSITION_INVALID"
  );
});
