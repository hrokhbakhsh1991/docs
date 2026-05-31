import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { runWithIdempotentEntityManager } from "../../src/modules/idempotency/idempotent-transaction.context";
import { PaymentEntity, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { stubPaymentGatewayFactoryForTests } from "../helpers/noop-payment-gateway-factory";
import { TypeOrmRegistrationsApplicationService } from "../../src/modules/registrations/repositories/typeorm-registrations-application.service";
import type { RegistrationCreationService } from "../../src/modules/registrations/services/registration-creation.service";
import type { RegistrationStateMachineService } from "../../src/modules/registrations/services/registration-state-machine.service";
import type { RegistrationWaitlistService } from "../../src/modules/registrations/services/registration-waitlist.service";
import { RegistrationPublicFlowMetrics } from "../../src/modules/registrations/services/registration-public-flow-metrics";
import { UserRole } from "../../src/common/auth/user-role.enum";
import {
  createRegistrationQueryService,
  createTransactionRunner,
  harness,
  unexpectedHarnessCall,
} from "../helpers/registrations-application.harness";
import type { EntityManager } from "typeorm";
import { syntheticBookingContactPhone } from "../../src/common/security/ownership-scope";
import {
  paymentEntityContractFixture,
  TEST_PAYMENT_ID,
  TEST_REGISTRATION_ID,
  TEST_TENANT_ID,
} from "../helpers/finance-contract-fixtures";

type Actor = {
  role?: UserRole;
  tenantId?: string;
  userId?: string;
};

function buildRegistrationsServiceHarness(actor: Actor) {
  const memberUserId = "11111111-1111-4111-8111-111111111111";
  const ownPhone = syntheticBookingContactPhone(memberUserId);
  const records: RegistrationEntity[] = [
    {
      id: "reg-own",
      rowVersion: 1,
      tenantId: "tenant-a",
      tourId: "tour-1",
      tourDepartureId: "tour-1",
      participantFullName: "Own",
      participantContactPhone: ownPhone,
      bookingTarget: "self",
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      createdAt: new Date(),
      updatedAt: new Date()
    } as RegistrationEntity,
    {
      id: "reg-other",
      rowVersion: 1,
      tenantId: "tenant-a",
      tourId: "tour-1",
      tourDepartureId: "tour-1",
      participantFullName: "Other",
      participantContactPhone: "+989120000999",
      bookingTarget: "self",
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      createdAt: new Date(),
      updatedAt: new Date()
    } as RegistrationEntity,
    {
      id: "reg-cross-tenant",
      rowVersion: 1,
      tenantId: "tenant-b",
      tourId: "tour-2",
      tourDepartureId: "tour-2",
      participantFullName: "Cross",
      participantContactPhone: "+989120000998",
      bookingTarget: "self",
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      createdAt: new Date(),
      updatedAt: new Date()
    } as RegistrationEntity
  ];

  const matchOne = (row: RegistrationEntity, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && "_type" in (value as Record<string, unknown>)) {
        return row.deletedAt == null;
      }
      return (row as unknown as Record<string, unknown>)[key] === value;
    });

  const manager = {
    async findOne(entity: unknown, opts: { where: unknown }) {
      const name = (entity as { name?: string }).name;
      if (name === "UserEntity") {
        return {
          id: actor.userId,
          telegramUserId: null,
          deletedAt: null
        };
      }
      if (name === "RegistrationEntity") {
        const where = opts.where as Record<string, unknown> | Array<Record<string, unknown>>;
        if (Array.isArray(where)) {
          return records.find((row) => where.some((w) => matchOne(row, w))) ?? null;
        }
        return records.find((row) => matchOne(row, where)) ?? null;
      }
      return null;
    }
  };

  const requestContext = {
    getRole: () => actor.role ?? UserRole.Member,
    resolveEffectiveTenantId: () => actor.tenantId,
    getTenantId: () => actor.tenantId,
    getUserId: () => actor.userId,
    getRequestId: () => "req-test",
  };

  const queryService = createRegistrationQueryService({
    manager: manager as EntityManager,
    records,
    requestContext,
  });

  const service = new TypeOrmRegistrationsApplicationService(
    harness(createTransactionRunner(manager as EntityManager)),
    harness({
      getTenantIdForTourOrThrow: async () =>
        unexpectedHarnessCall("RegistrationTourAccessService.getTenantIdForTourOrThrow"),
      requireTourInTenant: async () =>
        unexpectedHarnessCall("RegistrationTourAccessService.requireTourInTenant"),
      requireTourInTenantForUpdate: async () =>
        unexpectedHarnessCall("RegistrationTourAccessService.requireTourInTenantForUpdate"),
      assertTourNationalIdRegistrationPolicyOrThrow: async () => undefined,
    }),
    queryService,
    harness<RegistrationCreationService>({
      createRegistration: async () =>
        unexpectedHarnessCall("RegistrationCreationService.createRegistration"),
      createBooking: async () => unexpectedHarnessCall("RegistrationCreationService.createBooking"),
      createPublicRegistrationOrWaitlist: async () =>
        unexpectedHarnessCall("RegistrationCreationService.createPublicRegistrationOrWaitlist"),
    }),
    harness<RegistrationStateMachineService>({
      updateRegistrationStatus: async () =>
        unexpectedHarnessCall("RegistrationStateMachineService.updateRegistrationStatus"),
      updatePaymentStatus: async () =>
        unexpectedHarnessCall("RegistrationStateMachineService.updatePaymentStatus"),
      transitionRegistrationForPayment: async () =>
        unexpectedHarnessCall("RegistrationStateMachineService.transitionRegistrationForPayment"),
    }),
    harness<RegistrationWaitlistService>({
      createWaitlistItem: async () =>
        unexpectedHarnessCall("RegistrationWaitlistService.createWaitlistItem"),
      convertWaitlistItem: async () =>
        unexpectedHarnessCall("RegistrationWaitlistService.convertWaitlistItem"),
      cancelWaitlistItem: async () =>
        unexpectedHarnessCall("RegistrationWaitlistService.cancelWaitlistItem"),
    }),
    new RegistrationPublicFlowMetrics(),
  );
  return { service };
}

test("member accesses own registration only", async () => {
  const { service } = buildRegistrationsServiceHarness({
    role: UserRole.Member,
    tenantId: "tenant-a",
    userId: "11111111-1111-4111-8111-111111111111"
  });
  const own = await service.getRegistrationById("reg-own");
  assert.equal(own.id, "reg-own");

  await assert.rejects(
    () => service.getRegistrationById("reg-other"),
    (err) => err instanceof NotFoundException
  );
});

test("leader can access any registration in tenant", async () => {
  const { service } = buildRegistrationsServiceHarness({
    role: UserRole.Owner,
    tenantId: "tenant-a",
    userId: "leader-1"
  });
  const row = await service.getRegistrationById("reg-other");
  assert.equal(row.id, "reg-other");
});

test("admin scoped to JWT tenant cannot load registration from another tenant", async () => {
  const { service } = buildRegistrationsServiceHarness({
    role: UserRole.Admin,
    tenantId: "tenant-a",
    userId: "admin-1"
  });
  await assert.rejects(
    () => service.getRegistrationById("reg-cross-tenant"),
    (err) => err instanceof NotFoundException
  );
});

test("admin can load registration in their tenant", async () => {
  const { service } = buildRegistrationsServiceHarness({
    role: UserRole.Admin,
    tenantId: "tenant-a",
    userId: "admin-1"
  });
  const row = await service.getRegistrationById("reg-other");
  assert.equal(row.id, "reg-other");
  assert.equal(row.tenantId, "tenant-a");
});

test("payment intent denies member access to other member registration", async () => {
  const memberUserId = "11111111-1111-4111-8111-111111111111";
  const ownPhone = syntheticBookingContactPhone(memberUserId);
  const manager = {
    async findOne(entity: unknown, opts: { where: unknown }) {
      const name = (entity as { name?: string }).name;
      if (name === "UserEntity") {
        return {
          id: memberUserId,
          telegramUserId: null,
          deletedAt: null
        };
      }
      if (name === "RegistrationEntity") {
        const where = opts.where as Array<Record<string, unknown>>;
        const owns = where.some(
          (clause) =>
            clause.participantContactPhone === ownPhone &&
            clause.id === TEST_REGISTRATION_ID &&
            clause.tenantId === TEST_TENANT_ID
        );
        if (!owns) return null;
        return {
          id: TEST_REGISTRATION_ID,
          tenantId: TEST_TENANT_ID,
          tourId: "tour-1",
          status: RegistrationStatus.ACCEPTED,
          paymentStatus: RegistrationPaymentStatus.NOT_PAID,
          quotedTotalMinor: "100",
          quotedListPriceMinor: "100",
          quotedCurrencyCode: "USD",
          quotedPricingVersion: "v1"
        };
      }
      return null;
    },
    getRepository(entity: unknown) {
      if (entity === BookingPriceSnapshotEntity) {
        return {
          findOne: async () => ({
            computedTotalMinor: "100",
            currency: "USD",
            pricingRuleVersion: "v1"
          })
        };
      }
      throw new Error("unexpected getRepository");
    },
    async exists(entity: unknown, opts: { where: Record<string, unknown> }) {
      const w = opts.where;
      if (entity === BookingPriceSnapshotEntity) {
        return w.bookingId === TEST_REGISTRATION_ID && w.tenantId === TEST_TENANT_ID;
      }
      if (entity === PaymentEntity) {
        if (w.registrationId !== TEST_REGISTRATION_ID || w.tenantId !== TEST_TENANT_ID) {
          return false;
        }
        if (w.status === PaymentStatus.PENDING) {
          return !Object.prototype.hasOwnProperty.call(w, "id");
        }
        if (w.status === PaymentStatus.PAID) {
          return false;
        }
      }
      return false;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return payload;
    },
    async save(entity: unknown) {
      return paymentEntityContractFixture({
        ...(entity as Record<string, unknown>),
        id: TEST_PAYMENT_ID,
        tenantId: TEST_TENANT_ID,
        registrationId: TEST_REGISTRATION_ID,
        status: PaymentStatus.PENDING,
      });
    }
  };

  const paymentRepository = {
    async runInTransaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    },
    async existsBookingPriceSnapshot() {
      return true;
    },
    async findCanonicalBookingPriceSnapshot() {
      return { computedTotalMinor: "100", currency: "USD" };
    },
    async findPendingForRegistration() {
      return null;
    },
    async findPaidForRegistration() {
      return null;
    },
    async existsPendingForRegistration() {
      return false;
    },
    async existsPaidForRegistration() {
      return false;
    },
    createPayment(_manager: unknown, payload: Record<string, unknown>) {
      return payload;
    },
    async savePayment(_manager: unknown, entity: unknown) {
      return paymentEntityContractFixture({
        ...(entity as Record<string, unknown>),
        id: TEST_PAYMENT_ID,
        tenantId: TEST_TENANT_ID,
        registrationId: TEST_REGISTRATION_ID,
        status: PaymentStatus.PENDING,
      });
    },
  };

  const resolverStub = {
    async resolveRegistrationForCreateIntent(m: typeof manager, dto: { registrationId: string }) {
      const reg = await m.findOne(RegistrationEntity, {
        where: [
          {
            id: dto.registrationId,
            participantContactPhone: ownPhone,
            tenantId: TEST_TENANT_ID
          }
        ]
      });
      if (!reg) {
        throw new NotFoundException({
          error: { code: "RESOURCE_NOT_FOUND", message: "Registration not found" }
        });
      }
      return reg;
    }
  };

  const service = new PaymentsService(
    paymentRepository as never,
    {
      getRole: () => "member",
      resolveEffectiveTenantId: () => TEST_TENANT_ID,
      getTenantId: () => TEST_TENANT_ID,
      getUserId: () => memberUserId
    } as never,
    {} as never,
    {
      executeWithIdempotency: async (
        _params: unknown,
        handler: () => Promise<Record<string, unknown>>
      ) => ({
        statusCode: 200,
        responseBody: await handler(),
        replayed: false
      }),
      createRequestHash: () => "hash"
    } as never,
    { addEvent: async () => undefined } as never,
    resolverStub as never,
    stubPaymentGatewayFactoryForTests,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await assert.rejects(
    () =>
      runWithIdempotentEntityManager(manager as never, () =>
        service.createPaymentIntent({
          registrationId: "88888888-8888-4888-8888-888888888888",
          amount: 100,
          currency: "USD",
          paymentProvider: "mock_provider"
        })
      ),
    (err) => err instanceof NotFoundException
  );

  const ownIntent = await runWithIdempotentEntityManager(manager as never, () =>
    service.createPaymentIntent({
      registrationId: TEST_REGISTRATION_ID,
      amount: 100,
      currency: "USD",
      paymentProvider: "mock_provider"
    })
  );
  assert.equal(ownIntent.registrationId, TEST_REGISTRATION_ID);
});
