import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { TourEntity } from "../../src/modules/tours/entities/tour.entity";
import {
  WaitlistItemEntity,
  WaitlistItemStatus
} from "../../src/modules/registrations/waitlist-item.entity";

type TourRecord = {
  id: string;
  tenantId: string;
  totalCapacity: number;
  acceptedCount: number;
};

type WaitlistRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: string;
  entryMode: string;
  status: WaitlistItemStatus;
  promotedRegistrationId?: string;
  createdAt: Date;
};

type Store = {
  tour: TourRecord;
  registrations: Map<string, RegistrationEntity>;
  waitlist: WaitlistRecord[];
};

type FixtureOptions = {
  initialStatus?: RegistrationStatus;
  acceptedCount?: number;
  totalCapacity?: number;
  waitlist?: WaitlistRecord[];
  registrations?: RegistrationEntity[];
};

type Fixture = {
  service: RegistrationsService;
  outboxCalls: Array<{ eventType: string; payload: unknown }>;
  store: Store;
};

function buildRegistration(
  status: RegistrationStatus,
  id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
): RegistrationEntity {
  return {
    id,
    tenantId: "11111111-1111-4111-8111-111111111111",
    tourId: "22222222-2222-4222-8222-222222222222",
    participantFullName: "Test User",
    participantContactPhone: "+989121234567",
    transportMode: "group_vehicle",
    entryMode: "web",
    status,
    paymentStatus: RegistrationPaymentStatus.NOT_PAID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  } as RegistrationEntity;
}

function createMutex(): {
  acquire: () => Promise<() => void>;
} {
  let queue = Promise.resolve();
  return {
    async acquire() {
      let release: () => void = () => {};
      const ticket = new Promise<void>((resolve) => {
        release = resolve;
      });
      const previous = queue;
      queue = queue.then(() => ticket);
      await previous;
      return release;
    }
  };
}

function createServiceFixture(options: FixtureOptions = {}): Fixture {
  const tour: TourRecord = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    totalCapacity: options.totalCapacity ?? 5,
    acceptedCount: options.acceptedCount ?? 0
  };
  const registrations =
    options.registrations ??
    [buildRegistration(options.initialStatus ?? RegistrationStatus.PENDING)];
  const store: Store = {
    tour,
    registrations: new Map(registrations.map((item) => [item.id, item])),
    waitlist: options.waitlist ?? []
  };
  const outboxCalls: Array<{ eventType: string; payload: unknown }> = [];
  const tourLock = createMutex();
  const lockedWaitlistIds = new Set<string>();

  let activeReleasers: Array<() => void> = [];

  const manager = {
    async findOne(
      entity: unknown,
      options: {
        where:
          | { id?: string; tenantId?: string; deletedAt?: unknown }
          | Array<{ id?: string; tenantId?: string; participantContactPhone?: string }>;
      }
    ) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        const first = Array.isArray(options.where)
          ? options.where[0]
          : options.where;
        if (
          !first ||
          typeof first !== "object" ||
          !("id" in first) ||
          typeof first.id !== "string"
        ) {
          return null;
        }
        const w = first as { id: string; tenantId?: string };
        const row = store.registrations.get(w.id) ?? null;
        if (!row) return null;
        if (
          typeof w.tenantId === "string" &&
          w.tenantId.length > 0 &&
          row.tenantId !== w.tenantId
        ) {
          return null;
        }
        return row;
      }
      if ((entity as { name?: string }).name === TourEntity.name) {
        if (Array.isArray(options.where)) {
          return null;
        }
        const tw = options.where as { id?: string };
        const byId = tw.id === store.tour.id;
        return byId ? ({ ...store.tour } as TourEntity) : null;
      }
      return null;
    },
    async save(entity: unknown) {
      const named = entity as { id?: string; totalCapacity?: number; acceptedCount?: number };
      if (typeof named.totalCapacity === "number" && typeof named.acceptedCount === "number") {
        store.tour = {
          ...store.tour,
          totalCapacity: named.totalCapacity,
          acceptedCount: named.acceptedCount
        };
        return { ...store.tour } as TourEntity;
      }
      const waitlistItem = entity as WaitlistItemEntity;
      if (
        typeof waitlistItem.participantContactPhone === "string" &&
        typeof waitlistItem.participantFullName === "string" &&
        typeof waitlistItem.status === "string" &&
        Object.values(WaitlistItemStatus).includes(waitlistItem.status as WaitlistItemStatus)
      ) {
        const index = store.waitlist.findIndex((item) => item.id === waitlistItem.id);
        if (index >= 0) {
          store.waitlist[index] = {
            ...store.waitlist[index],
            status: waitlistItem.status as WaitlistItemStatus,
            promotedRegistrationId: waitlistItem.promotedRegistrationId
          };
        }
        return waitlistItem;
      }
      const registration = entity as RegistrationEntity;
      if (!registration.id) {
        registration.id = `promoted-${store.registrations.size + 1}`;
      }
      const saved = {
        ...registration,
        updatedAt: new Date("2026-01-02T00:00:00.000Z")
      } as RegistrationEntity;
      store.registrations.set(saved.id, saved);
      return saved;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    getRepository(entity: unknown) {
      if ((entity as { name?: string }).name === TourEntity.name) {
        const state: {
          tourId?: string;
          tenantId?: string;
        } = {};
        return {
          createQueryBuilder() {
            return {
              setLock() {
                return this;
              },
              where(_: string, params: { tourId: string }) {
                state.tourId = params.tourId;
                return this;
              },
              andWhere(_: string, params: { tenantId: string }) {
                state.tenantId = params.tenantId;
                return this;
              },
              async getOne() {
                const release = await tourLock.acquire();
                activeReleasers.push(release);
                const matches =
                  state.tourId === store.tour.id && state.tenantId === store.tour.tenantId;
                return matches ? ({ ...store.tour } as TourEntity) : null;
              }
            };
          }
        };
      }
      if ((entity as { name?: string }).name === WaitlistItemEntity.name) {
        const state: {
          tenantId?: string;
          tourId?: string;
          status?: WaitlistItemStatus;
        } = {};
        return {
          createQueryBuilder() {
            return {
              where(_: string, params: { tenantId: string }) {
                state.tenantId = params.tenantId;
                return this;
              },
              andWhere(_: string, params: { tourId?: string; status?: WaitlistItemStatus }) {
                if (params.tourId !== undefined) {
                  state.tourId = params.tourId;
                }
                if (params.status !== undefined) {
                  state.status = params.status;
                }
                return this;
              },
              orderBy() {
                return this;
              },
              setLock() {
                return this;
              },
              setOnLocked() {
                return this;
              },
              async getOne() {
                const candidates = store.waitlist
                  .filter((item) => item.tenantId === state.tenantId)
                  .filter((item) => item.tourId === state.tourId)
                  .filter((item) => item.status === state.status)
                  .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                const available = candidates.find((item) => !lockedWaitlistIds.has(item.id));
                if (!available) {
                  return null;
                }

                lockedWaitlistIds.add(available.id);
                activeReleasers.push(() => {
                  lockedWaitlistIds.delete(available.id);
                });
                return { ...available } as WaitlistItemEntity;
              }
            };
          }
        };
      }
      throw new Error("Unsupported repository in test fixture");
    }
  };

  const dataSource = {
    async transaction<T>(fn: (transactionManager: typeof manager) => Promise<T>): Promise<T> {
      const prevReleasers = activeReleasers;
      activeReleasers = [];
      try {
        return await fn(manager);
      } finally {
        const toRelease = activeReleasers;
        activeReleasers = prevReleasers;
        for (const release of toRelease.reverse()) {
          release();
        }
      }
    }
  };

  const requestContextService = {
    getTenantId(): string {
      return "11111111-1111-4111-8111-111111111111";
    },
    getUserId(): string {
      return "99999999-9999-4999-8999-999999999999";
    },
    /** Leader-facing registration updates (matches Role.LEADER = "owner" in JWT). */
    getRole(): string {
      return "owner";
    }
  };

  const outboxService = {
    async addEvent(
      _manager: unknown,
      event: { eventType: string; payload: Record<string, unknown> }
    ): Promise<void> {
      outboxCalls.push({ eventType: event.eventType, payload: event.payload });
    }
  };

  const service = new RegistrationsService(
    {} as never,
    {} as never,
    dataSource as never,
    requestContextService as never,
    outboxService as never
  );

  return { service, outboxCalls, store };
}

function buildWaitlist(
  id: string,
  createdAt: string,
  status: WaitlistItemStatus = WaitlistItemStatus.WAITING
): WaitlistRecord {
  return {
    id,
    tenantId: "11111111-1111-4111-8111-111111111111",
    tourId: "22222222-2222-4222-8222-222222222222",
    participantFullName: `Waitlist ${id}`,
    participantContactPhone: `+98912000${id.slice(0, 3)}`,
    transportMode: "group_vehicle",
    entryMode: "web",
    status,
    createdAt: new Date(createdAt)
  };
}

test("A) status transition emits one audit event with mapped event name", async () => {
  const cases: Array<{
    from: RegistrationStatus;
    to: RegistrationStatus;
    expectedEvent: string;
  }> = [
    {
      from: RegistrationStatus.PENDING,
      to: RegistrationStatus.ACCEPTED,
      expectedEvent: "registration.accepted"
    },
    {
      from: RegistrationStatus.PENDING,
      to: RegistrationStatus.REJECTED,
      expectedEvent: "registration.rejected"
    },
    {
      from: RegistrationStatus.PENDING,
      to: RegistrationStatus.CANCELLED,
      expectedEvent: "registration.cancelled"
    },
    {
      from: RegistrationStatus.ACCEPTED,
      to: RegistrationStatus.NO_SHOW,
      expectedEvent: "registration.no_show"
    }
  ];

  for (const item of cases) {
    const { service, outboxCalls } = createServiceFixture({ initialStatus: item.from });
    await service.updateRegistrationStatus("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      targetStatus: item.to
    });

    assert.equal(
      outboxCalls.length,
      1,
      `expected one outbox enqueue for ${item.from} -> ${item.to}`
    );
    assert.equal(outboxCalls[0]?.eventType, item.expectedEvent);
  }
});

test("B) no-op transition does not emit audit event", async () => {
  const { service, outboxCalls } = createServiceFixture({
    initialStatus: RegistrationStatus.PENDING
  });

  await service.updateRegistrationStatus("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    targetStatus: RegistrationStatus.PENDING
  });

  assert.equal(outboxCalls.length, 0);
});

test("C) audit payload contains required fields", async () => {
  const { service, outboxCalls } = createServiceFixture({
    initialStatus: RegistrationStatus.PENDING
  });

  await service.updateRegistrationStatus("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    targetStatus: RegistrationStatus.REJECTED
  });

  assert.equal(outboxCalls.length, 1);
  const call = outboxCalls[0];
  assert.equal(call?.eventType, "registration.rejected");
  const payload = call?.payload as Record<string, unknown>;
  assert.equal(payload.entityType, "registration");
  assert.equal(payload.entityId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(payload.actorId, "99999999-9999-4999-8999-999999999999");
  assert.equal(typeof payload.timestamp, "string");
  assert.deepEqual(payload.metadata, {
    previousStatus: RegistrationStatus.PENDING,
    newStatus: RegistrationStatus.REJECTED,
    tourId: "22222222-2222-4222-8222-222222222222",
    scheduleId: null
  });
});

test("counter increments when entering Accepted", async () => {
  const { service, store } = createServiceFixture({
    initialStatus: RegistrationStatus.PENDING,
    acceptedCount: 0,
    totalCapacity: 2
  });

  await service.updateRegistrationStatus("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    targetStatus: RegistrationStatus.ACCEPTED
  });

  assert.equal(store.tour.acceptedCount, 1);
});

test("counter decrements when leaving Accepted", async () => {
  const { service, store } = createServiceFixture({
    initialStatus: RegistrationStatus.ACCEPTED,
    acceptedCount: 1,
    totalCapacity: 3
  });

  await service.updateRegistrationStatus("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    targetStatus: RegistrationStatus.CANCELLED
  });

  assert.equal(store.tour.acceptedCount, 0);
});

test("counter never becomes negative", async () => {
  const { service, store } = createServiceFixture({
    initialStatus: RegistrationStatus.ACCEPTED,
    acceptedCount: 0,
    totalCapacity: 3
  });

  await service.updateRegistrationStatus("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    targetStatus: RegistrationStatus.REJECTED
  });

  assert.equal(store.tour.acceptedCount, 0);
});

test("concurrent accepts do not exceed totalCapacity", async () => {
  const registrationA = buildRegistration(
    RegistrationStatus.PENDING,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );
  const registrationB = buildRegistration(
    RegistrationStatus.PENDING,
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  );
  const { service, store } = createServiceFixture({
    registrations: [registrationA, registrationB],
    acceptedCount: 0,
    totalCapacity: 1
  });

  const op1 = service.updateRegistrationStatus(registrationA.id, {
    targetStatus: RegistrationStatus.ACCEPTED
  });
  const op2 = service.updateRegistrationStatus(registrationB.id, {
    targetStatus: RegistrationStatus.ACCEPTED
  });

  const results = await Promise.allSettled([op1, op2]);
  const fulfilled = results.filter((item) => item.status === "fulfilled");
  const rejected = results.filter((item) => item.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const rejectedError = rejected[0];
  if (rejectedError?.status === "rejected") {
    assert.equal(rejectedError.reason instanceof ConflictException, true);
    assert.equal(
      (rejectedError.reason.getResponse() as { error?: { code?: string } }).error?.code,
      "CAPACITY_FULL"
    );
  }

  assert.equal(store.tour.acceptedCount, 1);
  const acceptedRegistrations = Array.from(store.registrations.values()).filter(
    (item) => item.status === RegistrationStatus.ACCEPTED
  );
  assert.equal(acceptedRegistrations.length, 1);
});

test("FIFO promotion promotes oldest waiting item first", async () => {
  const registration = buildRegistration(RegistrationStatus.ACCEPTED);
  const waitlistA = buildWaitlist("wait-a", "2026-01-01T00:00:00.000Z");
  const waitlistB = buildWaitlist("wait-b", "2026-01-01T00:01:00.000Z");
  const waitlistC = buildWaitlist("wait-c", "2026-01-01T00:02:00.000Z");
  const { service, store } = createServiceFixture({
    registrations: [registration],
    acceptedCount: 1,
    totalCapacity: 1,
    waitlist: [waitlistC, waitlistA, waitlistB]
  });

  await service.updateRegistrationStatus(registration.id, {
    targetStatus: RegistrationStatus.CANCELLED
  });

  const promotedA = store.waitlist.find((item) => item.id === "wait-a");
  const promotedB = store.waitlist.find((item) => item.id === "wait-b");
  const promotedC = store.waitlist.find((item) => item.id === "wait-c");
  assert.equal(promotedA?.status, WaitlistItemStatus.CONVERTED);
  assert.equal(typeof promotedA?.promotedRegistrationId, "string");
  assert.equal(promotedB?.status, WaitlistItemStatus.WAITING);
  assert.equal(promotedC?.status, WaitlistItemStatus.WAITING);
});

test("promotion respects capacity and only one item is accepted", async () => {
  const registration = buildRegistration(RegistrationStatus.ACCEPTED);
  const waitlistA = buildWaitlist("wait-a", "2026-01-01T00:00:00.000Z");
  const waitlistB = buildWaitlist("wait-b", "2026-01-01T00:01:00.000Z");
  const { service, store } = createServiceFixture({
    registrations: [registration],
    acceptedCount: 1,
    totalCapacity: 1,
    waitlist: [waitlistA, waitlistB]
  });

  await service.updateRegistrationStatus(registration.id, {
    targetStatus: RegistrationStatus.REJECTED
  });

  const convertedCount = store.waitlist.filter(
    (item) => item.status === WaitlistItemStatus.CONVERTED
  ).length;
  assert.equal(convertedCount, 1);
  assert.equal(store.tour.acceptedCount, 1);
});

test("concurrent promotion triggers do not double-promote same waitlist entry", async () => {
  const registrationA = buildRegistration(
    RegistrationStatus.ACCEPTED,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );
  const registrationB = buildRegistration(
    RegistrationStatus.ACCEPTED,
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  );
  const waitlistA = buildWaitlist("wait-a", "2026-01-01T00:00:00.000Z");
  const { service, store } = createServiceFixture({
    registrations: [registrationA, registrationB],
    acceptedCount: 2,
    totalCapacity: 2,
    waitlist: [waitlistA]
  });

  await Promise.all([
    service.updateRegistrationStatus(registrationA.id, {
      targetStatus: RegistrationStatus.CANCELLED
    }),
    service.updateRegistrationStatus(registrationB.id, {
      targetStatus: RegistrationStatus.REJECTED
    })
  ]);

  const convertedItems = store.waitlist.filter(
    (item) => item.status === WaitlistItemStatus.CONVERTED
  );
  assert.equal(convertedItems.length, 1);
  assert.equal(typeof convertedItems[0]?.promotedRegistrationId, "string");
  assert.equal(store.tour.acceptedCount, 1);
});

test("counter integrity after promotion equals accepted registrations count", async () => {
  const registration = buildRegistration(RegistrationStatus.ACCEPTED);
  const waitlistA = buildWaitlist("wait-a", "2026-01-01T00:00:00.000Z");
  const { service, store } = createServiceFixture({
    registrations: [registration],
    acceptedCount: 1,
    totalCapacity: 1,
    waitlist: [waitlistA]
  });

  await service.updateRegistrationStatus(registration.id, {
    targetStatus: RegistrationStatus.NO_SHOW
  });

  const acceptedCountByStatus = Array.from(store.registrations.values()).filter(
    (item) => item.status === RegistrationStatus.ACCEPTED
  ).length;
  assert.equal(store.tour.acceptedCount, acceptedCountByStatus);
});
