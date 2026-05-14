import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { runWithIdempotentEntityManager } from "../../src/modules/idempotency/idempotent-transaction.context";
import { PaymentEntity, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { BookingLedgerAuthorityService } from "../../src/modules/finance/ledger/booking-ledger-authority.service";
import { noopOutboxServiceForTests } from "../helpers/noop-outbox.service";
import { noopPaymentRefundLedgerForTests } from "../helpers/noop-payment-refund-ledger.service";
import { stubPaymentGatewayFactoryForTests } from "../helpers/noop-payment-gateway-factory";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import { stubRegistrationQuoteApplication } from "../registrations/stub-pricing-engine";
import { createRegistrationsReadRepositoryTestDouble } from "../registrations/stub-registrations-read-repository";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { syntheticBookingContactPhone } from "../../src/common/security/ownership-scope";

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

  const registrationRepository = {
    manager,
    async findOne(opts: { where: unknown }) {
      return manager.findOne({ name: "RegistrationEntity" }, opts as never);
    }
  };

  const service = new RegistrationsService(
    registrationRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {
      getRole: () => actor.role,
      resolveEffectiveTenantId: () => actor.tenantId,
      getTenantId: () => actor.tenantId,
      getUserId: () => actor.userId
    } as never,
    { addEvent: async () => undefined } as never,
    stubRegistrationQuoteApplication,
    createRegistrationsReadRepositoryTestDouble(registrationRepository as never),
    new BookingLedgerAuthorityService(noopOutboxServiceForTests)
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
            clause.id === "reg-own" &&
            clause.tenantId === "tenant-a"
        );
        if (!owns) return null;
        return {
          id: "reg-own",
          tenantId: "tenant-a",
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
        return w.bookingId === "reg-own" && w.tenantId === "tenant-a";
      }
      if (entity === PaymentEntity) {
        if (w.registrationId !== "reg-own" || w.tenantId !== "tenant-a") {
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
      return {
        ...(entity as Record<string, unknown>),
        id: "pay-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: PaymentStatus.PENDING
      };
    }
  };

  const dataSource = {
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;

  const resolverStub = {
    async resolveRegistrationForCreateIntent(m: typeof manager, dto: { registrationId: string }) {
      const reg = await m.findOne(RegistrationEntity, {
        where: [
          {
            id: dto.registrationId,
            participantContactPhone: ownPhone,
            tenantId: "tenant-a"
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
    {} as never,
    {} as never,
    {} as never,
    dataSource,
    {
      getRole: () => "member",
      resolveEffectiveTenantId: () => "tenant-a",
      getTenantId: () => "tenant-a",
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
    noopPaymentRefundLedgerForTests,
    stubPaymentGatewayFactoryForTests
  );

  await assert.rejects(
    () =>
      runWithIdempotentEntityManager(manager as never, () =>
        service.createPaymentIntent({
          registrationId: "reg-other",
          amount: 100,
          currency: "USD",
          paymentProvider: "mock_provider"
        })
      ),
    (err) => err instanceof NotFoundException
  );

  const ownIntent = await runWithIdempotentEntityManager(manager as never, () =>
    service.createPaymentIntent({
      registrationId: "reg-own",
      amount: 100,
      currency: "USD",
      paymentProvider: "mock_provider"
    })
  );
  assert.equal(ownIntent.registrationId, "reg-own");
});
