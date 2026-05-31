import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { UserRole } from "../../src/common/auth/user-role.enum";
import type { RequestContextService } from "../../src/common/request-context/request-context.service";
import type { OutboxService } from "../../src/modules/outbox/outbox.service";
import { TypeOrmRegistrationsApplicationService } from "../../src/modules/registrations/repositories/typeorm-registrations-application.service";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../../src/modules/registrations/registration.entity";
import type { RegistrationCreationService } from "../../src/modules/registrations/services/registration-creation.service";
import type { RegistrationQueryService } from "../../src/modules/registrations/services/registration-query.service";
import { RegistrationPublicFlowMetrics } from "../../src/modules/registrations/services/registration-public-flow-metrics";
import type { RegistrationCapacityService } from "../../src/modules/registrations/services/registration-capacity.service";
import type { RegistrationPersistenceService } from "../../src/modules/registrations/services/registration-persistence.service";
import { RegistrationStateMachineService } from "../../src/modules/registrations/services/registration-state-machine.service";
import type { RegistrationTourAccessService } from "../../src/modules/registrations/services/registration-tour-access.service";
import type { RegistrationTransactionRunner } from "../../src/modules/registrations/services/registration-transaction.runner";
import type { RegistrationWaitlistService } from "../../src/modules/registrations/services/registration-waitlist.service";
import { createRegistrationsReadRepositoryPortTestDouble } from "./stub-registrations-read-repository";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function harness<T>(partial: object): T {
  return partial as unknown as T;
}

function unexpectedHarnessCall(label: string): never {
  throw new Error(`Unexpected harness invocation: ${label}`);
}

function createPaymentHarness(initial: RegistrationEntity | null): {
  service: TypeOrmRegistrationsApplicationService;
  getRegistration: () => RegistrationEntity | null;
} {
  let current = initial;

  const registrationRepository = {
    async findOne({ where }: { where: Record<string, unknown> }) {
      if (!current) {
        return null;
      }
      if (where.id !== current.id || where.tenantId !== current.tenantId) {
        return null;
      }
      return { ...current };
    },
  };

  const manager = {
    async findOne(entity: unknown, opts?: { where?: Record<string, unknown> }) {
      if (entity !== RegistrationEntity || !current || !opts?.where) {
        return null;
      }
      const where = opts.where;
      if (where.id !== current.id || where.tenantId !== current.tenantId) {
        return null;
      }
      return { ...current };
    },
    async save(entity: RegistrationEntity) {
      current = entity;
      return entity;
    },
  } as EntityManager;

  const requestContextService = {
    resolveEffectiveTenantId: () => TENANT_ID,
    getRole: () => UserRole.Owner,
    getTenantId: () => TENANT_ID,
    getUserId: () => USER_ID,
  } satisfies Pick<
    RequestContextService,
    "resolveEffectiveTenantId" | "getRole" | "getTenantId" | "getUserId"
  >;

  const transactionRunner = {
    get activeManager() {
      return manager;
    },
    runInIdempotentOrOwnTransaction: async <T>(fn: (_manager: EntityManager) => Promise<T>) =>
      fn(manager),
  } satisfies Pick<
    RegistrationTransactionRunner,
    "activeManager" | "runInIdempotentOrOwnTransaction"
  >;

  const registrationsReadRepository = createRegistrationsReadRepositoryPortTestDouble(
    registrationRepository,
    manager,
  );

  const persistenceService = {
    saveRegistrationOrVersionConflict: async (_manager: EntityManager, registration: RegistrationEntity) => {
      current = registration;
      return registration;
    },
  } satisfies Pick<RegistrationPersistenceService, "saveRegistrationOrVersionConflict">;

  const outboxService = {
    addEvent: async () => undefined,
  } satisfies Pick<OutboxService, "addEvent">;

  const tourAccessService = {
    getTenantIdForTourOrThrow: async () => unexpectedHarnessCall("RegistrationTourAccessService.getTenantIdForTourOrThrow"),
    requireTourInTenant: async () => unexpectedHarnessCall("RegistrationTourAccessService.requireTourInTenant"),
    requireTourInTenantForUpdate: async () =>
      unexpectedHarnessCall("RegistrationTourAccessService.requireTourInTenantForUpdate"),
    assertTourNationalIdRegistrationPolicyOrThrow: async () => undefined,
  } satisfies Pick<
    RegistrationTourAccessService,
    | "getTenantIdForTourOrThrow"
    | "requireTourInTenant"
    | "requireTourInTenantForUpdate"
    | "assertTourNationalIdRegistrationPolicyOrThrow"
  >;

  const capacityService = {
    calculateAcceptedCounterDelta: () => unexpectedHarnessCall("RegistrationCapacityService.calculateAcceptedCounterDelta"),
  } satisfies Pick<RegistrationCapacityService, "calculateAcceptedCounterDelta">;

  const waitlistService = {
    promoteNextWaitlistItem: async () =>
      unexpectedHarnessCall("RegistrationWaitlistService.promoteNextWaitlistItem"),
  } satisfies Pick<RegistrationWaitlistService, "promoteNextWaitlistItem">;

  const stateMachineService = new RegistrationStateMachineService(
    harness<RequestContextService>(requestContextService),
    harness<OutboxService>(outboxService),
    registrationsReadRepository,
    harness<RegistrationTransactionRunner>(transactionRunner),
    harness<RegistrationTourAccessService>(tourAccessService),
    harness<RegistrationCapacityService>(capacityService),
    harness<RegistrationPersistenceService>(persistenceService),
    harness<RegistrationWaitlistService>(waitlistService),
    new RegistrationPublicFlowMetrics(),
  );

  const service = new TypeOrmRegistrationsApplicationService(
    harness<RegistrationTransactionRunner>(transactionRunner),
    harness<RegistrationTourAccessService>(tourAccessService),
    harness<RegistrationQueryService>({
      resolveAuthenticatedBookingInput: async () =>
        unexpectedHarnessCall("RegistrationQueryService.resolveAuthenticatedBookingInput"),
    }),
    harness<RegistrationCreationService>({
      createRegistration: async () =>
        unexpectedHarnessCall("RegistrationCreationService.createRegistration"),
      createBooking: async () => unexpectedHarnessCall("RegistrationCreationService.createBooking"),
    }),
    stateMachineService,
    harness<RegistrationWaitlistService>({
      createWaitlistItem: async () =>
        unexpectedHarnessCall("RegistrationWaitlistService.createWaitlistItem"),
    }),
    new RegistrationPublicFlowMetrics(),
  );

  return {
    service,
    getRegistration: () => current,
  };
}

function buildRegistration(
  registrationStatus: RegistrationStatus,
  paymentStatus: RegistrationPaymentStatus,
): RegistrationEntity {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId: TENANT_ID,
    tourId: "22222222-2222-4222-8222-222222222222",
    tourDepartureId: "22222222-2222-4222-8222-222222222222",
    participantFullName: "Test User",
    participantContactPhone: "+989121234567",
    transportMode: "group_vehicle",
    entryMode: "web",
    status: registrationStatus,
    paymentStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as RegistrationEntity;
}

test("payment transition allowed: NotPaid -> Paid", async () => {
  const { service, getRegistration } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.NOT_PAID),
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.PAID,
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.PAID);
  assert.equal(getRegistration()?.paymentStatus, RegistrationPaymentStatus.PAID);
});

test("payment transition allowed: NotPaid -> Failed", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.NOT_PAID),
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.FAILED,
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.FAILED);
});

test("payment transition allowed: Paid -> Refunded", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.PAID),
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.REFUNDED,
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.REFUNDED);
});

test("payment transition allowed: Failed -> Paid", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.FAILED),
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.PAID,
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.PAID);
});

test("payment transition allowed: Failed -> NotPaid", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.FAILED),
  );

  const result = await service.updatePaymentStatus(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    RegistrationPaymentStatus.NOT_PAID,
  );

  assert.equal(result.paymentStatus, RegistrationPaymentStatus.NOT_PAID);
});

test("payment transition forbidden: Paid -> NotPaid", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.PAID),
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.NOT_PAID,
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID",
  );
});

test("payment transition forbidden: Refunded -> Paid", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.REFUNDED),
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.PAID,
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID",
  );
});

test("payment transition forbidden: Refunded -> NotPaid", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.PENDING, RegistrationPaymentStatus.REFUNDED),
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.NOT_PAID,
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID",
  );
});

test("payment transition forbidden for cancelled registration", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.CANCELLED, RegistrationPaymentStatus.NOT_PAID),
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.PAID,
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID",
  );
});

test("payment transition forbidden for rejected registration", async () => {
  const { service } = createPaymentHarness(
    buildRegistration(RegistrationStatus.REJECTED, RegistrationPaymentStatus.NOT_PAID),
  );

  await assert.rejects(
    () =>
      service.updatePaymentStatus(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        RegistrationPaymentStatus.PAID,
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "PAYMENT_STATUS_TRANSITION_INVALID",
  );
});
