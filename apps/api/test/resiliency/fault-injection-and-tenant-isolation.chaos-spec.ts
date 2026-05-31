/**
 * Deterministic chaos / fault-injection tests for multi-tenant capacity compensation
 * and tenant isolation guardrails.
 *
 * Uses Node test runner spies (`mock.fn`) as the Jest-spy equivalent in this repo.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { CommandBus } from "@nestjs/cqrs";
import { NotFoundException } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import pg from "pg";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TypeOrmRegistrationsApplicationService } from "../../src/modules/registrations/repositories/typeorm-registrations-application.service";
import type { EntityManager } from "typeorm";
import {
  createLeaderRequestContext,
  createRegistrationCreationService,
  createRegistrationsApplicationFacade,
} from "../helpers/registrations-application.harness";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../../src/modules/registrations/registration.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import type { TourCapacityReservationPort } from "../../src/modules/tours/domain/ports/tour-capacity-reservation.port";
import { CapacityExceededException } from "../../src/common/errors/capacity-exceeded.exception";
import type { TourCatalogPortTestDoubleState } from "../registrations/stub-registrations-tour-catalog.port";

const TENANT_ALPHA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_BETA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOUR_BETA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REGISTRATION_BETA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type TrackedCapacityPort = {
  port: TourCapacityReservationPort;
  getRemainingSlots: () => number;
  reserveSpy: ReturnType<typeof mock.fn>;
  releaseSpy: ReturnType<typeof mock.fn>;
};

function createTrackedTourCapacityReservationPort(
  tour: TourCatalogPortTestDoubleState,
): TrackedCapacityPort {
  let virtualRemaining: number | null = null;

  const remainingFromTour = (): number =>
    Math.max(0, tour.totalCapacity - tour.acceptedCount);

  const getRemainingSlots = (): number => virtualRemaining ?? remainingFromTour();

  const baseReserve = async (input: {
    tenantId: string;
    tourId: string;
    totalCapacity: number;
  }): Promise<void> => {
    if (input.tourId !== tour.id || input.tenantId !== tour.tenantId) {
      throw new CapacityExceededException();
    }
    const rem = getRemainingSlots();
    if (rem <= 0) {
      throw new CapacityExceededException();
    }
    virtualRemaining = rem - 1;
  };

  const baseRelease = async (input: {
    tenantId: string;
    tourId: string;
    totalCapacity: number;
  }): Promise<void> => {
    if (input.tourId !== tour.id || input.tenantId !== tour.tenantId) {
      return;
    }
    const rem = getRemainingSlots();
    virtualRemaining = Math.min(input.totalCapacity, rem + 1);
  };

  const reserveSpy = mock.fn(baseReserve);
  const releaseSpy = mock.fn(baseRelease);

  return {
    port: {
      reserveTicket: reserveSpy,
      releaseTicket: releaseSpy,
      async syncRemainingFromSnapshot(input) {
        if (input.tourId !== tour.id || input.tenantId !== tour.tenantId) {
          return;
        }
        virtualRemaining = Math.max(0, input.totalCapacity - input.acceptedCount);
      },
    },
    getRemainingSlots,
    reserveSpy,
    releaseSpy,
  };
}

type CapacityCompensationFixture = {
  service: TypeOrmRegistrationsApplicationService;
  commandBus: Pick<CommandBus, "execute">;
  tour: TourCatalogPortTestDoubleState;
  capacity: TrackedCapacityPort;
  injectPostCapacityFault: (_enabled: boolean) => void;
};

function createCapacityCompensationFixture(options?: {
  totalCapacity?: number;
  acceptedCount?: number;
}): CapacityCompensationFixture {
  const tour: TourCatalogPortTestDoubleState = {
    id: TOUR_BETA,
    tenantId: TENANT_ALPHA,
    totalCapacity: options?.totalCapacity ?? 10,
    acceptedCount: options?.acceptedCount ?? 0,
    lifecycleStatus: TourLifecycleStatus.OPEN,
    autoAcceptRegistrations: false,
  };

  const registration = {
    id: REGISTRATION_BETA,
    tenantId: TENANT_ALPHA,
    tourId: tour.id,
    tourDepartureId: tour.id,
    participantFullName: "Resiliency Participant",
    participantContactPhone: "+989121234567",
    transportMode: "group_vehicle",
    entryMode: "web",
    status: RegistrationStatus.PENDING,
    paymentStatus: RegistrationPaymentStatus.NOT_PAID,
    rowVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as RegistrationEntity;

  const store = {
    tour,
    registration: { ...registration },
  };

  let faultAfterCapacityConsume = false;

  const manager = {
    async findOne(entity: unknown, options: { where: Record<string, unknown> }) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        const where = options.where as { id?: string; tenantId?: string };
        if (where.id !== store.registration.id) {
          return null;
        }
        if (
          typeof where.tenantId === "string" &&
          where.tenantId.length > 0 &&
          store.registration.tenantId !== where.tenantId
        ) {
          return null;
        }
        return { ...store.registration };
      }
      if ((entity as { name?: string }).name === TourEntity.name) {
        const where = options.where as { id?: string };
        return where.id === store.tour.id ? ({ ...store.tour } as TourEntity) : null;
      }
      return null;
    },
    async exists(entity: unknown, options: { where: Record<string, unknown> }) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        return (options.where as { id: string }).id === store.registration.id;
      }
      return false;
    },
    async update() {
      return { affected: 1, raw: [], generatedMaps: [] };
    },
    async save(entity: unknown) {
      if (faultAfterCapacityConsume) {
        throw new QueryFailedError(
          "UPDATE registrations SET status = $1",
          [],
          new Error("connection terminated unexpectedly"),
        );
      }
      const row = entity as RegistrationEntity;
      if (typeof row.status === "string") {
        store.registration = {
          ...store.registration,
          ...row,
          rowVersion: (store.registration.rowVersion ?? 1) + 1,
        };
        return { ...store.registration };
      }
      return entity;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    getRepository(entity: unknown) {
      if ((entity as { name?: string }).name === TourEntity.name) {
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
                const matches =
                  ctx.tourId === store.tour.id && ctx.tenantId === store.tour.tenantId;
                return matches ? ({ ...store.tour } as TourEntity) : null;
              },
            };
          },
        };
      }
      throw new Error(`Unsupported repository in resiliency fixture: ${String(entity)}`);
    },
  };

  const capacity = createTrackedTourCapacityReservationPort(store.tour);

  const service = createRegistrationsApplicationFacade({
    manager: manager as EntityManager,
    tour: store.tour,
    records: [store.registration],
    requestContext: createLeaderRequestContext(TENANT_ALPHA),
    capacityReservationPort: capacity.port,
  });

  type UpdateStatusCommand = {
    registrationId: string;
    payload: { targetStatus: RegistrationStatus; expected_row_version: number };
  };

  const commandBus = {
    execute: mock.fn(async (command: UpdateStatusCommand) =>
      service.updateRegistrationStatus(command.registrationId, command.payload),
    ),
  } as unknown as Pick<CommandBus, "execute">;

  return {
    service,
    commandBus,
    tour: store.tour,
    capacity,
    injectPostCapacityFault(enabled: boolean) {
      faultAfterCapacityConsume = enabled;
    },
  };
}

function createCrossTenantServiceFixture(): {
  service: TypeOrmRegistrationsApplicationService;
  betaRegistrationId: string;
  betaTourId: string;
} {
  const betaRegistration = {
    id: REGISTRATION_BETA,
    tenantId: TENANT_BETA,
    tourId: TOUR_BETA,
    tourDepartureId: TOUR_BETA,
    participantFullName: "Tenant Beta Participant",
    participantContactPhone: "+989129999999",
    transportMode: "group_vehicle",
    entryMode: "web",
    status: RegistrationStatus.PENDING,
    paymentStatus: RegistrationPaymentStatus.NOT_PAID,
    rowVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as RegistrationEntity;

  const betaTour: TourCatalogPortTestDoubleState = {
    id: TOUR_BETA,
    tenantId: TENANT_BETA,
    totalCapacity: 20,
    acceptedCount: 0,
    lifecycleStatus: TourLifecycleStatus.OPEN,
  };

  const manager = {
    async findOne(entity: unknown, options: { where: Record<string, unknown> }) {
      if ((entity as { name?: string }).name === RegistrationEntity.name) {
        const where = options.where as { id?: string; tenantId?: string };
        if (where.id !== betaRegistration.id) {
          return null;
        }
        if (
          typeof where.tenantId === "string" &&
          where.tenantId.length > 0 &&
          betaRegistration.tenantId !== where.tenantId
        ) {
          return null;
        }
        return { ...betaRegistration };
      }
      if ((entity as { name?: string }).name === TourEntity.name) {
        const where = options.where as { id?: string };
        return where.id === betaTour.id ? ({ ...betaTour } as TourEntity) : null;
      }
      return null;
    },
    async exists() {
      return false;
    },
    async update() {
      return { affected: 0, raw: [], generatedMaps: [] };
    },
    async save(entity: unknown) {
      return entity;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    getRepository() {
      throw new Error("Unexpected repository access in cross-tenant fixture");
    },
  };

  /** Authenticated workspace context bound to tenant-alpha. */
  const tenantAlphaRequestContext = {
    resolveEffectiveTenantId(): string {
      return TENANT_ALPHA;
    },
    getTenantId(): string {
      return TENANT_ALPHA;
    },
    getUserId(): string {
      return "88888888-8888-4888-8888-888888888888";
    },
    getRole(): UserRole {
      return UserRole.Owner;
    },
    getRequestId(): string {
      return "tenant-alpha-request";
    },
  };

  const service = createRegistrationsApplicationFacade({
    manager: manager as EntityManager,
    tour: betaTour,
    records: [betaRegistration],
    requestContext: tenantAlphaRequestContext,
    creationService: createRegistrationCreationService({
      manager: manager as EntityManager,
      tour: betaTour,
      requestContext: tenantAlphaRequestContext,
    }),
  });

  return {
    service,
    betaRegistrationId: betaRegistration.id,
    betaTourId: betaTour.id,
  };
}

test("Angle 1: Post-Reservation PostgreSQL Rollback Compensation", async (t) => {
  await t.test(
    "releases Redis capacity via releaseTicket when PG save fails after reserveTicket",
    async () => {
      const fixture = createCapacityCompensationFixture({
        totalCapacity: 10,
        acceptedCount: 0,
      });

      assert.equal(fixture.capacity.getRemainingSlots(), 10, "precondition: 10 slots remain");

      fixture.injectPostCapacityFault(true);

      await assert.rejects(
        () =>
          fixture.commandBus.execute({
            registrationId: REGISTRATION_BETA,
            payload: {
              targetStatus: RegistrationStatus.ACCEPTED,
              expected_row_version: 1,
            },
          }),
        (error: unknown) => error instanceof QueryFailedError || error instanceof Error,
        "registration command must abort on injected PostgreSQL failure",
      );

      assert.equal(fixture.capacity.reserveSpy.mock.calls.length, 1, "reserveTicket invoked once");
      assert.equal(
        fixture.capacity.releaseSpy.mock.calls.length,
        1,
        "compensating releaseTicket invoked once after transaction rollback",
      );
      assert.equal(
        fixture.capacity.getRemainingSlots(),
        10,
        "Redis remaining slots restored to 10 (zero drift)",
      );
      assert.equal(
        fixture.tour.acceptedCount,
        1,
        "in-memory PG counter incremented before fault (rolled back in real DB; compensation covers Redis)",
      );
    },
  );
});

test("Angle 2: Cross-Tenant Multi-Tenant Breach Protection", async (t) => {
  await t.test(
    "tenant-alpha actor cannot mutate tenant-beta registration (defense-in-depth scope filter)",
    async () => {
      const { service, betaRegistrationId } = createCrossTenantServiceFixture();

      await assert.rejects(
        () =>
          service.updateRegistrationStatus(betaRegistrationId, {
            targetStatus: RegistrationStatus.ACCEPTED,
            expected_row_version: 1,
          }),
        (error: unknown) => error instanceof NotFoundException,
        "cross-tenant registration mutation must fail closed as not found in alpha scope",
      );
    },
  );

  await t.test(
    "tenant-alpha actor cannot register against tenant-beta tour (JWT tenant mismatch guard)",
    async () => {
      const { service, betaTourId } = createCrossTenantServiceFixture();

      await assert.rejects(
        () =>
          service.createRegistration({
            tourId: betaTourId,
            participantFullName: "Cross Tenant Attacker",
            participantContactPhone: "+989120000001",
            transportMode: "group_vehicle",
            entryMode: "web",
          } as never),
        (error: unknown) => error instanceof NotFoundException,
        "authenticated alpha context must reject beta tour registration as out of scope",
      );
    },
  );

  await t.test(
    "PostgreSQL RLS + app.tenant_id GUC blocks cross-tenant tour reads and mutations",
    async (ctx) => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        ctx.skip("DATABASE_URL is required for PostgreSQL RLS chaos integration");
        return;
      }

      const client = new pg.Client({ connectionString });
      await client.connect();

      const tourId = randomUUID();
      const originalTitle = "Tenant Beta Private Tour";
      const mutatedTitle = "Cross-Tenant Hijack Attempt";

      try {
        await client.query(
          `INSERT INTO tenants (id, name, subdomain, description, enabled_modules)
           VALUES ($1, $2, $3, $4, '[]'::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [TENANT_ALPHA, "Tenant Alpha", "tenant-alpha", "resiliency chaos spec"],
        );
        await client.query(
          `INSERT INTO tenants (id, name, subdomain, description, enabled_modules)
           VALUES ($1, $2, $3, $4, '[]'::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [TENANT_BETA, "Tenant Beta", "tenant-beta", "resiliency chaos spec"],
        );

        await client.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_BETA]);
        await client.query(
          `INSERT INTO tours (id, tenant_id, title, total_capacity, accepted_count, lifecycle_status)
           VALUES ($1, $2, $3, 10, 0, 'open')`,
          [tourId, TENANT_BETA, originalTitle],
        );

        await client.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_ALPHA]);
        const crossRead = await client.query(`SELECT id, title FROM tours WHERE id = $1`, [tourId]);
        assert.equal(
          crossRead.rows.length,
          0,
          "tenant-alpha GUC must not observe tenant-beta tour rows",
        );

        const crossUpdate = await client.query(
          `UPDATE tours SET title = $1 WHERE id = $2 RETURNING id`,
          [mutatedTitle, tourId],
        );
        assert.equal(
          crossUpdate.rows.length,
          0,
          "tenant-alpha GUC must not mutate tenant-beta tour rows",
        );

        await client.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_BETA]);
        const betaView = await client.query(`SELECT title FROM tours WHERE id = $1`, [tourId]);
        assert.equal(betaView.rows.length, 1);
        assert.equal(betaView.rows[0]?.title, originalTitle, "beta tour data must remain intact");
      } finally {
        await client.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_BETA]);
        await client.query(`DELETE FROM tours WHERE id = $1`, [tourId]);
        await client.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [
          [TENANT_ALPHA, TENANT_BETA],
        ]);
        await client.query("RESET app.tenant_id");
        await client.end();
      }
    },
  );
});
