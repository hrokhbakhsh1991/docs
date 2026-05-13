import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";

type MockManager = {
  findOne: (entity: unknown, options: { where: Record<string, unknown> | Record<string, unknown>[] }) =>
    Promise<RegistrationEntity | null>;
  save: (entity: RegistrationEntity) => Promise<RegistrationEntity>;
};

function createServiceWithState(initial: RegistrationEntity | null): {
  service: RegistrationsService;
  getRegistration: () => RegistrationEntity | null;
} {
  let current = initial;

  const registrationMatchesWhere = (
    row: RegistrationEntity,
    clause: Record<string, unknown>
  ): boolean =>
    clause.id === row.id &&
    (clause.tenantId === undefined || clause.tenantId === row.tenantId) &&
    (clause.participantContactPhone === undefined ||
      clause.participantContactPhone === row.participantContactPhone) &&
    (clause.telegramUserId === undefined || clause.telegramUserId === row.telegramUserId);

  const manager: MockManager = {
    async findOne(entity, options) {
      const name = (entity as { name?: string }).name;
      if (name === UserEntity.name) {
        return null;
      }
      if (name === RegistrationEntity.name) {
        const w = options.where;
        if (current == null) return null;
        const reg = current;
        if (Array.isArray(w)) {
          return w.some((c) => registrationMatchesWhere(reg, c as Record<string, unknown>))
            ? reg
            : null;
        }
        return registrationMatchesWhere(reg, w as Record<string, unknown>) ? reg : null;
      }
      return null;
    },
    async save(entity: RegistrationEntity) {
      current = {
        ...entity,
        updatedAt: new Date()
      };
      return current;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (transactionManager: MockManager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const requestContextService = {
    resolveEffectiveTenantId(): string {
      return "11111111-1111-4111-8111-111111111111";
    },
    getTenantId(): string {
      return "11111111-1111-4111-8111-111111111111";
    },
    getUserId(): string {
      return "99999999-9999-4999-8999-999999999999";
    },
    getRole(): UserRole {
      return UserRole.Owner;
    }
  };
  const outboxService = {
    async addEvent(): Promise<void> {}
  };

  const service = new RegistrationsService(
    {} as never,
    {} as never,
    dataSource as never,
    {} as never,
    requestContextService as never,
    outboxService as never
  );

  return {
    service,
    getRegistration: () => current
  };
}

function buildRegistration(
  registrationStatus: RegistrationStatus,
  paymentStatus: RegistrationPaymentStatus
): RegistrationEntity {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId: "11111111-1111-4111-8111-111111111111",
    tourId: "22222222-2222-4222-8222-222222222222",
    tourDepartureId: "22222222-2222-4222-8222-222222222222",
    participantFullName: "Test User",
    participantContactPhone: "+989121234567",
    transportMode: "group_vehicle",
    entryMode: "web",
    status: registrationStatus,
    paymentStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  } as RegistrationEntity;
}

test("payment transition allowed: NotPaid -> Paid", async () => {
  const { service, getRegistration } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.NOT_PAID)
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.PAID
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.PAID);
  assert.equal(getRegistration()?.paymentStatus, RegistrationPaymentStatus.PAID);
});

test("payment transition allowed: NotPaid -> Failed", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.NOT_PAID)
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.FAILED
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.FAILED);
});

test("payment transition allowed: Paid -> Refunded", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.PAID)
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.REFUNDED
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.REFUNDED);
});

test("payment transition allowed: Failed -> Paid", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.FAILED)
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.PAID
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.PAID);
});

test("payment transition allowed: Failed -> NotPaid", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.FAILED)
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.NOT_PAID
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.NOT_PAID);
});

test("payment transition forbidden: Paid -> NotPaid", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.PAID)
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.NOT_PAID
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID"
  );
});

test("payment transition forbidden: Refunded -> Paid", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.REFUNDED)
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.PAID
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID"
  );
});

test("payment transition forbidden: Refunded -> NotPaid", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.REFUNDED)
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.NOT_PAID
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID"
  );
});

test("payment transition forbidden for cancelled registration", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.CANCELLED, RegistrationPaymentStatus.NOT_PAID)
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.PAID
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID"
  );
});

test("payment transition forbidden for rejected registration", async () => {
  const { service } = createServiceWithState(
    buildRegistration(RegistrationStatus.REJECTED, RegistrationPaymentStatus.NOT_PAID)
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.PAID
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID"
  );
});
