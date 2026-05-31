import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { UserRole } from "../../src/common/auth/user-role.enum";
import type { RequestContextService } from "../../src/common/request-context/request-context.service";
import type { OutboxService } from "../../src/modules/outbox/outbox.service";
import {
  RegistrationEntryModeDto,
  RegistrationTransportModeDto,
} from "../../src/modules/registrations/dto/create-registration.dto";
import {
  RegistrationStatus,
} from "../../src/modules/registrations/registration.entity";
import { TypeOrmRegistrationsApplicationService } from "../../src/modules/registrations/repositories/typeorm-registrations-application.service";
import type { RegistrationCapacityService } from "../../src/modules/registrations/services/registration-capacity.service";
import { RegistrationCreationService as RegistrationCreationServiceImpl } from "../../src/modules/registrations/services/registration-creation.service";
import type { RegistrationCreationService } from "../../src/modules/registrations/services/registration-creation.service";
import type { RegistrationPersistenceService } from "../../src/modules/registrations/services/registration-persistence.service";
import type { RegistrationPlacementService } from "../../src/modules/registrations/services/registration-placement.service";
import type { RegistrationPricingService } from "../../src/modules/registrations/services/registration-pricing.service";
import { RegistrationPublicFlowMetrics } from "../../src/modules/registrations/services/registration-public-flow-metrics";
import type { IRegistrationLookupPort } from "../../src/modules/registrations/domain/ports/registration-lookup.port";
import type { RegistrationQueryService } from "../../src/modules/registrations/services/registration-query.service";
import type { RegistrationStateMachineService } from "../../src/modules/registrations/services/registration-state-machine.service";
import { RegistrationTourAccessService } from "../../src/modules/registrations/services/registration-tour-access.service";
import type { RegistrationTransactionRunner } from "../../src/modules/registrations/services/registration-transaction.runner";
import type { RegistrationWaitlistService } from "../../src/modules/registrations/services/registration-waitlist.service";
import type { TenantBootstrapService } from "../../src/modules/tenant/tenant-bootstrap.service";
import { TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { stubRegistrationQuoteApplication } from "../registrations/stub-pricing-engine";
import { createRegistrationsTourCatalogPortTestDouble } from "../registrations/stub-registrations-tour-catalog.port";

const JWT_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TOUR_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_USER_ID = "33333333-3333-4333-8333-333333333333";

function harness<T>(partial: object): T {
  return partial as unknown as T;
}

function unexpectedHarnessCall(label: string): never {
  throw new Error(`Unexpected harness invocation: ${label}`);
}

function createMemberRequestContext(): Pick<
  RequestContextService,
  "getRole" | "resolveEffectiveTenantId" | "getTenantId" | "getUserId"
> {
  return {
    getRole: () => UserRole.Member,
    resolveEffectiveTenantId: () => JWT_TENANT_ID,
    getTenantId: () => JWT_TENANT_ID,
    getUserId: () => ACTOR_USER_ID,
  };
}

function createTransactionRunner(manager: EntityManager): Pick<
  RegistrationTransactionRunner,
  "activeManager" | "runInIdempotentOrOwnTransaction"
> {
  return {
    get activeManager() {
      return manager;
    },
    runInIdempotentOrOwnTransaction: async <T>(fn: (_m: EntityManager) => Promise<T>) => fn(manager),
  };
}

function sampleCreateDto(): {
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: RegistrationTransportModeDto;
  entryMode: RegistrationEntryModeDto;
} {
  return {
    tourId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    participantFullName: "Test",
    participantContactPhone: "+989121211111",
    transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
    entryMode: RegistrationEntryModeDto.WEB,
  };
}

test("member createRegistration returns 404 when JWT tenant differs from tour.tenantId", async () => {
  const dto = sampleCreateDto();
  const lockedTour = {
    id: dto.tourId,
    tenantId: TOUR_TENANT_ID,
    acceptedCount: 0,
    totalCapacity: 5,
    lifecycleStatus: TourLifecycleStatus.OPEN,
    costContext: {},
  };

  const manager = harness<EntityManager>({
    async find() {
      return [];
    },
    create() {
      return {};
    },
    async save(entity: unknown) {
      return entity;
    },
  });

  const requestContextService = createMemberRequestContext();
  const transactionRunner = createTransactionRunner(manager);
  const catalogPort = createRegistrationsTourCatalogPortTestDouble(lockedTour);

  const tenantBootstrapService = {
    resolveTenantFromTourId: async () => TOUR_TENANT_ID,
  };

  const tourAccessService = new RegistrationTourAccessService(
    harness<TenantBootstrapService>(tenantBootstrapService),
    catalogPort,
    harness<RequestContextService>(requestContextService),
  );

  const creationService = new RegistrationCreationServiceImpl(
    harness<RequestContextService>(requestContextService),
    harness<OutboxService>({ addEvent: async () => undefined }),
    stubRegistrationQuoteApplication,
    catalogPort,
    harness<RegistrationTransactionRunner>(transactionRunner),
    tourAccessService,
    harness<RegistrationCapacityService>({
      consumeAcceptedCapacitySlot: async () =>
        unexpectedHarnessCall("RegistrationCapacityService.consumeAcceptedCapacitySlot"),
    }),
    harness<RegistrationPersistenceService>({
      ensureNoActiveRegistrationDuplicate: async () => undefined,
    }),
    harness<RegistrationPlacementService>({
      tourRequiresPayment: () => false,
      loadTourTripDetailsForPlacement: async () => ({}),
      assertPrivateCarRegistrationAllowed: () => undefined,
      resolveInitialRegistrationPlacement: () => ({
        status: RegistrationStatus.PENDING,
        consumesAcceptedCapacity: false,
      }),
    }),
    harness<RegistrationPricingService>({}),
    new RegistrationPublicFlowMetrics(),
    harness<IRegistrationLookupPort>({
      resolveAuthenticatedBookingInput: async () =>
        unexpectedHarnessCall("IRegistrationLookupPort.resolveAuthenticatedBookingInput"),
    }),
  );

  const service = new TypeOrmRegistrationsApplicationService(
    harness<RegistrationTransactionRunner>(transactionRunner),
    tourAccessService,
    harness<RegistrationQueryService>({}),
    creationService,
    harness<RegistrationStateMachineService>({}),
    harness<RegistrationWaitlistService>({}),
    new RegistrationPublicFlowMetrics(),
  );

  await assert.rejects(
    () => service.createRegistration(dto),
    (err: unknown) => err instanceof NotFoundException,
  );
});

test("getTenantIdForTourOrThrow returns tenant from tour row", async () => {
  const tenantBootstrapService = {
    resolveTenantFromTourId: async () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  };

  const tourAccessService = new RegistrationTourAccessService(
    harness<TenantBootstrapService>(tenantBootstrapService),
    createRegistrationsTourCatalogPortTestDouble({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      acceptedCount: 0,
      totalCapacity: 10,
      lifecycleStatus: TourLifecycleStatus.OPEN,
    }),
    harness<RequestContextService>(createMemberRequestContext()),
  );

  const transactionRunner = createTransactionRunner(harness<EntityManager>({}));

  const service = new TypeOrmRegistrationsApplicationService(
    harness<RegistrationTransactionRunner>(transactionRunner),
    tourAccessService,
    harness<RegistrationQueryService>({}),
    harness<RegistrationCreationService>({}),
    harness<RegistrationStateMachineService>({}),
    harness<RegistrationWaitlistService>({}),
    new RegistrationPublicFlowMetrics(),
  );

  const tenant = await service.getTenantIdForTourOrThrow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(tenant, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
});

test("getTenantIdForTourOrThrow rejects unknown tour id", async () => {
  const tenantBootstrapService = {
    resolveTenantFromTourId: async () => null,
  };

  const tourAccessService = new RegistrationTourAccessService(
    harness<TenantBootstrapService>(tenantBootstrapService),
    createRegistrationsTourCatalogPortTestDouble({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: JWT_TENANT_ID,
      acceptedCount: 0,
      totalCapacity: 10,
      lifecycleStatus: TourLifecycleStatus.OPEN,
    }),
    harness<RequestContextService>(createMemberRequestContext()),
  );

  const transactionRunner = createTransactionRunner(harness<EntityManager>({}));

  const service = new TypeOrmRegistrationsApplicationService(
    harness<RegistrationTransactionRunner>(transactionRunner),
    tourAccessService,
    harness<RegistrationQueryService>({}),
    harness<RegistrationCreationService>({}),
    harness<RegistrationStateMachineService>({}),
    harness<RegistrationWaitlistService>({}),
    new RegistrationPublicFlowMetrics(),
  );

  await assert.rejects(
    () => service.getTenantIdForTourOrThrow("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    (err: unknown) => err instanceof NotFoundException,
  );
});
