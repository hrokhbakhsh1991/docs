/**
 * High-concurrency chaos tests for capacity races.
 *
 * Capacity is guarded by Redis LUA atomic decrement + conditional SQL-style
 * `accepted_count < total_capacity` updates — no TypeORM `FOR UPDATE` row locks
 * on tour capacity in this harness.
 */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type Redis from "ioredis";
import { ConflictException } from "@nestjs/common";
import { CapacityExceededException } from "../../src/common/errors/capacity-exceeded.exception";
import { DoubleBookingConflictException } from "../../src/common/errors/double-booking-conflict.exception";
import { TypeOrmRegistrationsApplicationService } from "../../src/modules/registrations/repositories/typeorm-registrations-application.service";
import type { EntityManager } from "typeorm";
import {
  createLeaderRequestContext,
  createRegistrationCreationService,
  createRegistrationsApplicationFacade,
} from "../helpers/registrations-application.harness";
import {
  RegistrationEntity,
} from "../../src/modules/registrations/registration.entity";
import {
  WaitlistItemEntity,
  WaitlistItemStatus,
} from "../../src/modules/registrations/waitlist-item.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";
import { PaymentEntity } from "../../src/modules/payments/entities/payment.entity";
import { RedisTourCapacityReservationService } from "../../src/modules/tours/infrastructure/redis-tour-capacity-reservation.service";
import type {
  RegistrationsTourCatalogPort,
  TourCatalogSnapshot,
} from "../../src/modules/registrations/domain/ports/registrations-tour-catalog.port";
import type { TourCatalogPortTestDoubleState } from "../registrations/stub-registrations-tour-catalog.port";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TOUR_ID = "22222222-2222-4222-8222-222222222222";

/** Per-request waitlist convert target — isolates capacity race from FIFO row locks. */
const convertWaitlistTargetStorage = new AsyncLocalStorage<string>();

/** Serializes conditional UPDATE steps (atomic SQL statement simulation). */
function createAtomicStatementGate() {
  let tail = Promise.resolve();
  return {
    run<T>(fn: () => Promise<T> | T): Promise<T> {
      const next = tail.then(fn, fn);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}

/** In-memory Redis with atomic eval (mirrors production LUA scripts). */
class MiniRedis {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.data.set(key, value);
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.data.get(key) ?? "0") + 1;
    this.data.set(key, String(next));
    return next;
  }

  async decr(key: string): Promise<number> {
    const next = Number(this.data.get(key) ?? "0") - 1;
    this.data.set(key, String(next));
    return next;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async eval(script: string, _numKeys: number, key: string, ...args: string[]): Promise<number> {
    if (script.includes("DECR")) {
      const seed = Number(args[0] ?? "0");
      if ((await this.exists(key)) === 0) {
        await this.set(key, String(Math.max(0, seed)));
      }
      return this.decr(key);
    }
    const cap = Number(args[0] ?? "0");
    const current = Number((await this.get(key)) ?? "0");
    if (current >= cap) {
      return current;
    }
    return this.incr(key);
  }
}

function toSnapshot(tour: TourCatalogPortTestDoubleState): TourCatalogSnapshot {
  return {
    id: tour.id,
    tenantId: tour.tenantId,
    title: "Concurrency Chaos Tour",
    lifecycleStatus: tour.lifecycleStatus,
    acceptedCount: tour.acceptedCount,
    totalCapacity: tour.totalCapacity,
    autoAcceptRegistrations: tour.autoAcceptRegistrations ?? true,
    costContext: tour.costContext ?? { requiresPayment: false },
    details: { tripDetails: {} },
    tourDepartureId: tour.id,
    transportModes: tour.transportModes ?? ["bus"],
  };
}

function createConcurrentAtomicTourCatalogPort(
  tour: TourCatalogPortTestDoubleState,
  gate: ReturnType<typeof createAtomicStatementGate>,
): RegistrationsTourCatalogPort {
  return {
    async getTourSnapshot(_manager, tourId) {
      return tourId === tour.id ? toSnapshot(tour) : null;
    },
    async lockTourSnapshot(_manager, tourId, tenantId) {
      if (tourId !== tour.id || tenantId !== tour.tenantId) {
        return null;
      }
      return toSnapshot(tour);
    },
    async getTourTitles(_manager, tourIds, tenantId) {
      const titles = new Map<string, string>();
      if (tourIds.includes(tour.id) && tenantId === tour.tenantId) {
        titles.set(tour.id, "Concurrency Chaos Tour");
      }
      return titles;
    },
    async tryIncrementAcceptedCountAtomic(_manager, tourId, tenantId) {
      return gate.run(() => {
        if (tourId !== tour.id || tenantId !== tour.tenantId) {
          return null;
        }
        if (tour.acceptedCount >= tour.totalCapacity) {
          return null;
        }
        tour.acceptedCount += 1;
        return toSnapshot(tour);
      });
    },
    async tryDecrementAcceptedCountAtomic(_manager, tourId, tenantId) {
      return gate.run(() => {
        if (tourId !== tour.id || tenantId !== tour.tenantId) {
          return null;
        }
        if (tour.acceptedCount <= 0) {
          return null;
        }
        tour.acceptedCount -= 1;
        return toSnapshot(tour);
      });
    },
    async applyAcceptedCounterDelta(_manager, tourId, tenantId, delta) {
      if (delta > 0) {
        const updated = await this.tryIncrementAcceptedCountAtomic(_manager, tourId, tenantId);
        if (!updated) {
          throw new ConflictException("increment failed");
        }
        return;
      }
      if (delta < 0) {
        await this.tryDecrementAcceptedCountAtomic(_manager, tourId, tenantId);
      }
    },
    async syncTourDepartureCapacity() {},
  };
}

type WaitlistRecord = WaitlistItemEntity & { createdAt: Date };

type ConcurrencyStore = {
  tour: TourCatalogPortTestDoubleState;
  registrations: Map<string, RegistrationEntity>;
  waitlist: Map<string, WaitlistRecord>;
  snapshots: Map<string, BookingPriceSnapshotEntity>;
};

function isCapacityRejection(error: unknown): boolean {
  return error instanceof CapacityExceededException || error instanceof DoubleBookingConflictException;
}

function createConcurrencyService(store: ConcurrencyStore, _redisService: RedisTourCapacityReservationService) {
  const gate = createAtomicStatementGate();
  const catalogPort = createConcurrentAtomicTourCatalogPort(store.tour, gate);

  const manager = {
    async find(entity: unknown, options: { where: Record<string, unknown> }) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        const where = options.where as {
          tenantId?: string;
          tourId?: string;
          participantContactPhone?: string;
        };
        return Array.from(store.registrations.values()).filter((row) => {
          if (where.tenantId && row.tenantId !== where.tenantId) return false;
          if (where.tourId && row.tourId !== where.tourId) return false;
          if (where.participantContactPhone && row.participantContactPhone !== where.participantContactPhone) {
            return false;
          }
          return true;
        });
      }
      if ((entity as { name?: string }).name === WaitlistItemEntity.name) {
        const where = options.where as {
          tenantId?: string;
          tourId?: string;
          participantContactPhone?: string;
          status?: WaitlistItemStatus;
        };
        return Array.from(store.waitlist.values()).filter((row) => {
          if (where.tenantId && row.tenantId !== where.tenantId) return false;
          if (where.tourId && row.tourId !== where.tourId) return false;
          if (where.participantContactPhone && row.participantContactPhone !== where.participantContactPhone) {
            return false;
          }
          if (where.status && row.status !== where.status) return false;
          return true;
        });
      }
      return [];
    },
    async findOne(entity: unknown, options: { where: Record<string, unknown> }) {
      const rows = await this.find(entity, options);
      return rows[0] ?? null;
    },
    async exists(entity: unknown, options: { where: Record<string, unknown> }) {
      const name = (entity as { name?: string }).name;
      if (name === BookingPriceSnapshotEntity.name) {
        const where = options.where as { bookingId?: string; tenantId?: string };
        return Array.from(store.snapshots.values()).some(
          (snapshot) =>
            snapshot.bookingId === where.bookingId && snapshot.tenantId === where.tenantId,
        );
      }
      if (name === PaymentEntity.name) {
        return false;
      }
      if (name === RegistrationEntity.name) {
        const where = options.where as { id?: string };
        return where.id ? store.registrations.has(where.id) : false;
      }
      return false;
    },
    async count(entity: unknown, options: { where: Record<string, unknown> }) {
      return (await this.find(entity, options)).length;
    },
    async update(entity: unknown, criteria: Record<string, unknown>, patch: Record<string, unknown>) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        const id = criteria.id as string;
        const tenantId = criteria.tenantId as string;
        const row = store.registrations.get(id);
        if (row && row.tenantId === tenantId) {
          store.registrations.set(id, { ...row, ...patch } as RegistrationEntity);
        }
      }
      return { affected: 1, raw: [], generatedMaps: [] };
    },
    async save(entity: unknown, payload?: unknown) {
      const entityName = (entity as { name?: string } | undefined)?.name;
      const row = (payload ?? entity) as Record<string, unknown>;

      if (
        entityName === BookingPriceSnapshotEntity.name ||
        (typeof row.bookingId === "string" &&
          typeof row.computedTotalMinor === "string" &&
          typeof row.listPriceMinor === "string")
      ) {
        const snapshotId = randomUUID();
        const snapshot = { ...row, snapshotId } as BookingPriceSnapshotEntity;
        store.snapshots.set(snapshotId, snapshot);
        return snapshot;
      }

      if (typeof row.participantContactPhone === "string" && typeof row.status === "string") {
        if (Object.values(WaitlistItemStatus).includes(row.status as WaitlistItemStatus)) {
          const id = (row.id as string | undefined) ?? randomUUID();
          const saved = { ...row, id, updatedAt: new Date() } as WaitlistRecord;
          store.waitlist.set(id, saved);
          return saved;
        }
        const id = (row.id as string | undefined) ?? randomUUID();
        const saved = {
          ...row,
          id,
          rowVersion: Number(row.rowVersion ?? 1),
          createdAt: (row.createdAt as Date | undefined) ?? new Date(),
          updatedAt: new Date(),
        } as RegistrationEntity;
        store.registrations.set(id, saved);
        return saved;
      }
      return row;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    getRepository(entity: unknown) {
      const name = (entity as { name?: string }).name;
      if (name === WaitlistItemEntity.name) {
        const state: {
          waitlistItemId?: string;
          tenantId?: string;
          tourId?: string;
          status?: WaitlistItemStatus;
          orderByCreatedAt?: boolean;
        } = {};
        return {
          createQueryBuilder() {
            return {
              setLock() {
                return this;
              },
              setOnLocked() {
                return this;
              },
              where(_clause: string, params?: Record<string, string>) {
                if (params?.waitlistItemId) state.waitlistItemId = params.waitlistItemId;
                if (params?.tenantId) state.tenantId = params.tenantId;
                return this;
              },
              andWhere(_clause: string, params?: Record<string, string>) {
                if (!params) {
                  return this;
                }
                if (params.tenantId) state.tenantId = params.tenantId;
                if (params.tourId) state.tourId = params.tourId;
                if (params.status) state.status = params.status as WaitlistItemStatus;
                return this;
              },
              orderBy() {
                state.orderByCreatedAt = true;
                return this;
              },
              async getOne() {
                const waiting = Array.from(store.waitlist.values())
                  .filter((item) => item.status === WaitlistItemStatus.WAITING)
                  .filter((item) => !state.tenantId || item.tenantId === state.tenantId)
                  .filter((item) => !state.tourId || item.tourId === state.tourId)
                  .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

                if (state.waitlistItemId) {
                  return store.waitlist.get(state.waitlistItemId) ?? null;
                }

                const convertTarget = convertWaitlistTargetStorage.getStore();
                if (convertTarget) {
                  const targeted = store.waitlist.get(convertTarget);
                  if (targeted && targeted.status === WaitlistItemStatus.WAITING) {
                    return { ...targeted };
                  }
                }

                if (state.orderByCreatedAt) {
                  return waiting[0] ? { ...waiting[0] } : null;
                }
                return null;
              },
            };
          },
        };
      }
      if (name === TourEntity.name) {
        return {
          createQueryBuilder() {
            return {
              setLock() {
                return this;
              },
              where(_: string, params: { tourId: string }) {
                (this as { tourId?: string }).tourId = params.tourId;
                return this;
              },
              andWhere(_: string, params: { tenantId: string }) {
                (this as { tenantId?: string }).tenantId = params.tenantId;
                return this;
              },
              async getOne() {
                const ctx = this as { tourId?: string; tenantId?: string };
                if (ctx.tourId === store.tour.id && ctx.tenantId === store.tour.tenantId) {
                  return { ...store.tour } as TourEntity;
                }
                return null;
              },
            };
          },
        };
      }
      throw new Error(`Unsupported repository entity: ${String(name)}`);
    },
  };

  const requestContext = createLeaderRequestContext(TENANT_ID, "public-flow-actor");
  const service = createRegistrationsApplicationFacade({
    manager: manager as EntityManager,
    tour: store.tour,
    requestContext,
    catalogPort,
    capacityReservationPort: _redisService,
    creationService: createRegistrationCreationService({
      manager: manager as EntityManager,
      tour: store.tour,
      requestContext,
      catalogPort,
      capacityReservationPort: _redisService,
    }),
  });

  return { service, manager, catalogPort };
}

function buildWaitlistItem(index: number, createdAt: Date): WaitlistRecord {
  const id = `wait-${index}`;
  return {
    id,
    tenantId: TENANT_ID,
    tourId: TOUR_ID,
    tourDepartureId: TOUR_ID,
    participantFullName: `Waitlist ${index}`,
    participantContactPhone: `+989130${String(1000 + index).slice(-4)}`,
    transportMode: "group_vehicle",
    entryMode: "web",
    status: WaitlistItemStatus.WAITING,
    createdAt,
    updatedAt: createdAt,
  } as WaitlistRecord;
}

async function runConvertWaitlistItem(
  service: TypeOrmRegistrationsApplicationService,
  waitlistItemId: string,
): Promise<unknown> {
  return convertWaitlistTargetStorage.run(waitlistItemId, () =>
    service.convertWaitlistItem(waitlistItemId, { conversionReason: "capacity_opened" }),
  );
}

test("Angle 3.1: Thundering Herd on the Last Remaining Capacity Slot", async (t) => {
  await t.test("50 parallel public registrations → exactly 1 success, 49 capacity rejections", async () => {
    const mini = new MiniRedis();
    const redisService = new RedisTourCapacityReservationService(mini as unknown as Redis);

    const store: ConcurrencyStore = {
      tour: {
        id: TOUR_ID,
        tenantId: TENANT_ID,
        totalCapacity: 20,
        acceptedCount: 19,
        lifecycleStatus: TourLifecycleStatus.OPEN,
        autoAcceptRegistrations: true,
        costContext: { requiresPayment: false },
        transportModes: ["bus"],
      },
      registrations: new Map(),
      waitlist: new Map(),
      snapshots: new Map(),
    };

    const { service } = createConcurrencyService(store, redisService);

    const burstSize = 50;
    const results = await Promise.allSettled(
      Array.from({ length: burstSize }, (_, index) =>
        service.createPublicRegistrationOrWaitlist({
          tourId: TOUR_ID,
          participantFullName: `Burst User ${index}`,
          participantContactPhone: `+9891320${String(10000 + index).slice(-5)}`,
          transportMode: "group_vehicle",
          entryMode: "web",
        }),
      ),
    );

    const successes = results.filter(
      (result) => result.status === "fulfilled" && result.value.type === "registration",
    );
    const capacityRejections = results.filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected" && isCapacityRejection(result.reason),
    );

    assert.equal(successes.length, 1, "exactly one registration must succeed (HTTP 201 equivalent)");
    assert.equal(
      capacityRejections.length,
      burstSize - 1,
      "remaining burst requests must fail with capacity guard exceptions",
    );
    assert.equal(store.tour.acceptedCount, 20, "accepted_count must land at total_capacity without over-booking");
    assert.equal(store.registrations.size, 1, "only one registration row persisted");

    const redisKey = `tours:capacity:remaining:${TENANT_ID}:${TOUR_ID}`;
    assert.equal(await mini.get(redisKey), "0", "Redis remaining counter must reflect zero open slots");
  });
});

test("Angle 3.2: Concurrent Waitlist Promotion Race", async (t) => {
  await t.test(
    "2 open slots + 10 parallel convertWaitlistItem → exactly 2 promotions, 8 remain queued",
    async () => {
      const mini = new MiniRedis();
      const redisService = new RedisTourCapacityReservationService(mini as unknown as Redis);

      const store: ConcurrencyStore = {
        tour: {
          id: TOUR_ID,
          tenantId: TENANT_ID,
          totalCapacity: 20,
          acceptedCount: 18,
          lifecycleStatus: TourLifecycleStatus.OPEN,
          autoAcceptRegistrations: true,
          costContext: { requiresPayment: false },
          transportModes: ["bus"],
        },
        registrations: new Map(),
        waitlist: new Map(
          Array.from({ length: 10 }, (_, index) => {
            const item = buildWaitlistItem(index, new Date(`2026-01-01T00:0${index}:00.000Z`));
            return [item.id, item] as const;
          }),
        ),
        snapshots: new Map(),
      };

      const { service } = createConcurrencyService(store, redisService);

      const convertResults = await Promise.allSettled(
        Array.from({ length: 10 }, (_, index) => runConvertWaitlistItem(service, `wait-${index}`)),
      );

      const converted = convertResults.filter(
        (result) =>
          result.status === "fulfilled" &&
          (result.value as { status: WaitlistItemStatus }).status === WaitlistItemStatus.CONVERTED,
      );
      const safeFailures = convertResults.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected" &&
          (isCapacityRejection(result.reason) ||
            (result.reason instanceof ConflictException &&
              ["STATE_TRANSITION_INVALID", "DOUBLE_BOOKING_CONFLICT", "CAPACITY_FULL"].includes(
                (result.reason.getResponse() as { error?: { code?: string } }).error?.code ?? "",
              ))),
      );

      assert.equal(converted.length, 2, "exactly two waitlist promotions must succeed");
      assert.equal(
        convertResults.length,
        converted.length + safeFailures.length,
        "all non-success paths must be capacity or state-guard rejections (no silent drops)",
      );
      assert.equal(store.tour.acceptedCount, 20, "final accepted_count must remain capped at total_capacity");

      const stillWaiting = Array.from(store.waitlist.values()).filter(
        (item) => item.status === WaitlistItemStatus.WAITING,
      );
      assert.equal(stillWaiting.length, 8, "remaining waitlist items stay queued safely");
    },
  );
});
