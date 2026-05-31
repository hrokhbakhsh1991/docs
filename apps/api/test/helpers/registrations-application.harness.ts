import type { EntityManager } from "typeorm";

import { UserRole } from "../../src/common/auth/user-role.enum";
import type { RequestContextService } from "../../src/common/request-context/request-context.service";
import type { OutboxService } from "../../src/modules/outbox/outbox.service";
import { RegistrationEntity, RegistrationStatus } from "../../src/modules/registrations/registration.entity";
import {
  clearRegistrationCapacityCompensations,
  runWithRegistrationCapacityCompensation,
  takePendingRegistrationCapacityCompensations,
} from "../../src/modules/registrations/repositories/registration-capacity-compensation.scope";
import { TypeOrmRegistrationsApplicationService } from "../../src/modules/registrations/repositories/typeorm-registrations-application.service";
import { RegistrationCapacityService } from "../../src/modules/registrations/services/registration-capacity.service";
import { RegistrationCreationService as RegistrationCreationServiceImpl } from "../../src/modules/registrations/services/registration-creation.service";
import type { RegistrationCreationService } from "../../src/modules/registrations/services/registration-creation.service";
import type { RegistrationCapacityService } from "../../src/modules/registrations/services/registration-capacity.service";
import type { RegistrationPersistenceService } from "../../src/modules/registrations/services/registration-persistence.service";
import type { RegistrationPlacementService } from "../../src/modules/registrations/services/registration-placement.service";
import type { RegistrationPricingService } from "../../src/modules/registrations/services/registration-pricing.service";
import type { OutboxService } from "../../src/modules/outbox/outbox.service";
import { createRegistrationsTourCatalogPortTestDouble } from "../registrations/stub-registrations-tour-catalog.port";
import { RegistrationPersistenceService } from "../../src/modules/registrations/services/registration-persistence.service";
import type { RegistrationPricingService } from "../../src/modules/registrations/services/registration-pricing.service";
import { RegistrationPublicFlowMetrics } from "../../src/modules/registrations/services/registration-public-flow-metrics";
import { RegistrationQueryService } from "../../src/modules/registrations/services/registration-query.service";
import { RegistrationStateMachineService } from "../../src/modules/registrations/services/registration-state-machine.service";
import { RegistrationTourAccessService } from "../../src/modules/registrations/services/registration-tour-access.service";
import type { RegistrationTransactionRunner } from "../../src/modules/registrations/services/registration-transaction.runner";
import { RegistrationWaitlistService } from "../../src/modules/registrations/services/registration-waitlist.service";
import type { IRegistrationLookupPort } from "../../src/modules/registrations/domain/ports/registration-lookup.port";
import type { RegistrationsTourCatalogPort } from "../../src/modules/registrations/domain/ports/registrations-tour-catalog.port";
import type { TourCapacityReservationPort } from "../../src/modules/tours/domain/ports/tour-capacity-reservation.port";
import type { TenantBootstrapService } from "../../src/modules/tenant/tenant-bootstrap.service";
import { TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { stubRegistrationQuoteApplication } from "../registrations/stub-pricing-engine";
import { createRegistrationsReadRepositoryPortTestDouble } from "../registrations/stub-registrations-read-repository";
import {
  createRegistrationsTourCatalogPortTestDouble,
  type TourCatalogPortTestDoubleState,
} from "../registrations/stub-registrations-tour-catalog.port";

export function harness<T>(partial: object): T {
  return partial as unknown as T;
}

export function unexpectedHarnessCall(label: string): never {
  throw new Error(`Unexpected harness invocation: ${label}`);
}

export function createTransactionRunner(
  manager: EntityManager,
  options?: {
    capacityReservationPort?: TourCapacityReservationPort;
  },
): Pick<RegistrationTransactionRunner, "activeManager" | "runInIdempotentOrOwnTransaction"> {
  if (options?.capacityReservationPort) {
    const capacityReservationPort = options.capacityReservationPort;
    return {
      get activeManager() {
        return manager;
      },
      runInIdempotentOrOwnTransaction: async <T>(fn: (_m: EntityManager) => Promise<T>) =>
        runWithRegistrationCapacityCompensation(async () => {
          try {
            const result = await fn(manager);
            clearRegistrationCapacityCompensations();
            return result;
          } catch (error) {
            const pending = takePendingRegistrationCapacityCompensations();
            for (const slot of pending) {
              await capacityReservationPort.releaseTicket(slot);
            }
            throw error;
          }
        }),
    };
  }

  return {
    get activeManager() {
      return manager;
    },
    runInIdempotentOrOwnTransaction: async <T>(fn: (_m: EntityManager) => Promise<T>) => fn(manager),
  };
}

type RequestContextStub = Pick<
  RequestContextService,
  "getRole" | "resolveEffectiveTenantId" | "getTenantId" | "getUserId" | "getRequestId"
>;

export function createRegistrationRepositoryStub(
  manager: EntityManager,
  records: RegistrationEntity[],
): {
  manager: EntityManager;
  findOne: (opts: { where: unknown }) => Promise<RegistrationEntity | null>;
} {
  const matchOne = (row: RegistrationEntity, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && "_type" in (value as Record<string, unknown>)) {
        return row.deletedAt == null;
      }
      return (row as unknown as Record<string, unknown>)[key] === value;
    });

  return {
    manager,
    async findOne({ where }: { where: unknown }) {
      const clauses = Array.isArray(where) ? where : [where];
      for (const clause of clauses) {
        const row = records.find((item) => matchOne(item, clause as Record<string, unknown>));
        if (row) {
          return row;
        }
      }
      return null;
    },
  };
}

export function createRegistrationQueryService(options: {
  manager: EntityManager;
  records: RegistrationEntity[];
  requestContext: RequestContextStub;
  catalogPort?: RegistrationsTourCatalogPort;
}): RegistrationQueryService {
  const registrationRepository = createRegistrationRepositoryStub(options.manager, options.records);
  const readRepository = createRegistrationsReadRepositoryPortTestDouble(
    registrationRepository,
    options.manager,
  );
  const tourCatalogPort =
    options.catalogPort ??
    createRegistrationsTourCatalogPortTestDouble({
      id: "tour-1",
      tenantId: options.requestContext.resolveEffectiveTenantId() ?? "tenant-a",
      acceptedCount: 0,
      totalCapacity: 10,
      lifecycleStatus: TourLifecycleStatus.OPEN,
    });

  return new RegistrationQueryService(
    harness(registrationRepository),
    harness({
      findOne: async () => ({
        id: options.requestContext.getUserId(),
        telegramUserId: null,
        deletedAt: null,
      }),
    }),
    harness(options.requestContext),
    harness<IRegistrationLookupPort>({
      resolveAuthenticatedBookingInput: async () =>
        unexpectedHarnessCall("IRegistrationLookupPort.resolveAuthenticatedBookingInput"),
    }),
    readRepository,
    tourCatalogPort,
    harness(createTransactionRunner(options.manager)),
    harness<RegistrationTourAccessService>({
      getTenantIdForTourOrThrow: async () =>
        unexpectedHarnessCall("RegistrationTourAccessService.getTenantIdForTourOrThrow"),
      requireTourInTenant: async () =>
        unexpectedHarnessCall("RegistrationTourAccessService.requireTourInTenant"),
      requireTourInTenantForUpdate: async () =>
        unexpectedHarnessCall("RegistrationTourAccessService.requireTourInTenantForUpdate"),
      assertTourNationalIdRegistrationPolicyOrThrow: async () => undefined,
    }),
  );
}

export function createRegistrationStateMachineStack(options: {
  manager: EntityManager;
  tour: TourCatalogPortTestDoubleState;
  outboxCalls?: Array<{ eventType: string; payload: unknown }>;
  captureOutboxEventTypes?: string[];
  requestContext: RequestContextStub;
  waitlistService?: RegistrationWaitlistService;
  capacityReservationPort?: TourCapacityReservationPort;
}): RegistrationStateMachineService {
  const outboxCalls = options.outboxCalls ?? [];
  const recordOutboxEvent = (event: { eventType: string; payload: unknown }) => {
    outboxCalls.push(event);
    options.captureOutboxEventTypes?.push(event.eventType);
  };
  const catalogPort = createRegistrationsTourCatalogPortTestDouble(options.tour);
  const transactionRunner = createTransactionRunner(options.manager, {
    capacityReservationPort: options.capacityReservationPort,
  });
  const readRepository = createRegistrationsReadRepositoryPortTestDouble(
    {
      async findOne({ where }) {
        const row = await options.manager.findOne(RegistrationEntity, { where: where as never });
        return row;
      },
    },
    options.manager,
  );

  const requestContext = options.requestContext;
  const tourAccessService = new RegistrationTourAccessService(
    harness<TenantBootstrapService>({
      resolveTenantFromTourId: async (tourId: string) =>
        tourId === options.tour.id ? options.tour.tenantId : null,
    }),
    catalogPort,
    harness(requestContext),
  );

  const capacityService = new RegistrationCapacityService(
    catalogPort,
    harness(
      options.capacityReservationPort ?? {
        reserveTicket: async () => undefined,
        releaseTicket: async () => undefined,
      },
    ),
  );

  const persistenceService = new RegistrationPersistenceService(
    harness(requestContext),
    harness<OutboxService>({
      addEvent: async (_manager, event) => {
        recordOutboxEvent({ eventType: event.eventType, payload: event.payload });
      },
    }),
    readRepository,
    harness<RegistrationPricingService>({
      restoreImmutableRegistrationQuoteColumns: async () => undefined,
      ensureBookingPriceSnapshotLockedAndEmit: async () => undefined,
    }),
  );

  return new RegistrationStateMachineService(
    harness(requestContext),
    harness<OutboxService>({
      addEvent: async (_manager, event) => {
        recordOutboxEvent({ eventType: event.eventType, payload: event.payload });
      },
    }),
    readRepository,
    harness(transactionRunner),
    tourAccessService,
    capacityService,
    persistenceService,
    options.waitlistService ??
      createRegistrationWaitlistService({
        manager: options.manager,
        tour: options.tour,
        requestContext,
        outboxCalls,
        captureOutboxEventTypes: options.captureOutboxEventTypes,
        catalogPort,
        transactionRunner,
        tourAccessService,
        capacityService,
        persistenceService,
      }),
    new RegistrationPublicFlowMetrics(),
  );
}

export function createRegistrationWaitlistService(options: {
  manager: EntityManager;
  tour: TourCatalogPortTestDoubleState;
  requestContext: RequestContextStub;
  outboxCalls?: Array<{ eventType: string; payload: unknown }>;
  captureOutboxEventTypes?: string[];
  catalogPort: RegistrationsTourCatalogPort;
  transactionRunner: Pick<
    RegistrationTransactionRunner,
    "activeManager" | "runInIdempotentOrOwnTransaction"
  >;
  tourAccessService: RegistrationTourAccessService;
  capacityService: RegistrationCapacityService;
  persistenceService: RegistrationPersistenceService;
}): RegistrationWaitlistService {
  const outboxCalls = options.outboxCalls ?? [];
  const recordOutboxEvent = (event: { eventType: string; payload: unknown }) => {
    outboxCalls.push(event);
    options.captureOutboxEventTypes?.push(event.eventType);
  };

  return new RegistrationWaitlistService(
    harness(options.requestContext),
    harness<OutboxService>({
      addEvent: async (_manager, event) => {
        recordOutboxEvent({ eventType: event.eventType, payload: event.payload });
      },
    }),
    stubRegistrationQuoteApplication,
    options.catalogPort,
    harness(options.transactionRunner),
    options.tourAccessService,
    options.capacityService,
    options.persistenceService,
    harness<RegistrationPricingService>({
      restoreImmutableRegistrationQuoteColumns: async () => undefined,
      ensureBookingPriceSnapshotLockedAndEmit: async () => undefined,
      createAndStampSnapshot: async (_manager, registration) => registration,
    }),
    new RegistrationPublicFlowMetrics(),
  );
}

export function createRegistrationsApplicationFacade(options: {
  manager: EntityManager;
  tour: TourCatalogPortTestDoubleState;
  outboxCalls?: Array<{ eventType: string; payload: unknown }>;
  captureOutboxEventTypes?: string[];
  requestContext: RequestContextStub;
  records?: RegistrationEntity[];
  waitlistService?: RegistrationWaitlistService;
  capacityReservationPort?: TourCapacityReservationPort;
  catalogPort?: RegistrationsTourCatalogPort;
  creationService?: RegistrationCreationService;
  waitlistFacadeService?: Pick<
    RegistrationWaitlistService,
    "createWaitlistItem" | "convertWaitlistItem" | "cancelWaitlistItem"
  >;
}): TypeOrmRegistrationsApplicationService {
  const outboxCalls = options.outboxCalls ?? [];
  const recordOutboxEvent = (event: { eventType: string; payload: unknown }) => {
    outboxCalls.push(event);
    options.captureOutboxEventTypes?.push(event.eventType);
  };
  const transactionRunner = createTransactionRunner(options.manager, {
    capacityReservationPort: options.capacityReservationPort,
  });
  const catalogPort =
    options.catalogPort ?? createRegistrationsTourCatalogPortTestDouble(options.tour);
  const tourAccessService = new RegistrationTourAccessService(
    harness<TenantBootstrapService>({
      resolveTenantFromTourId: async (tourId: string) =>
        tourId === options.tour.id ? options.tour.tenantId : null,
    }),
    catalogPort,
    harness(options.requestContext),
  );

  const capacityService = new RegistrationCapacityService(
    catalogPort,
    harness(
      options.capacityReservationPort ?? {
        reserveTicket: async () => undefined,
        releaseTicket: async () => undefined,
      },
    ),
  );

  const readRepository = createRegistrationsReadRepositoryPortTestDouble(
    {
      async findOne({ where }) {
        const row = await options.manager.findOne(RegistrationEntity, { where: where as never });
        return row;
      },
    },
    options.manager,
  );

  const persistenceService = new RegistrationPersistenceService(
    harness(options.requestContext),
    harness<OutboxService>({
      addEvent: async (_manager, event) => {
        recordOutboxEvent({ eventType: event.eventType, payload: event.payload });
      },
    }),
    readRepository,
    harness<RegistrationPricingService>({
      restoreImmutableRegistrationQuoteColumns: async () => undefined,
      ensureBookingPriceSnapshotLockedAndEmit: async () => undefined,
    }),
  );

  const waitlistService =
    options.waitlistFacadeService ??
    options.waitlistService ??
    createRegistrationWaitlistService({
      manager: options.manager,
      tour: options.tour,
      requestContext: options.requestContext,
      outboxCalls,
      captureOutboxEventTypes: options.captureOutboxEventTypes,
      catalogPort,
      transactionRunner,
      tourAccessService,
      capacityService,
      persistenceService,
    });

  const queryService =
    options.records !== undefined
      ? createRegistrationQueryService({
          manager: options.manager,
          records: options.records,
          requestContext: options.requestContext,
          catalogPort,
        })
      : harness<RegistrationQueryService>({
          resolveAuthenticatedBookingInput: async () =>
            unexpectedHarnessCall("RegistrationQueryService.resolveAuthenticatedBookingInput"),
          listRegistrationsForTour: async () =>
            unexpectedHarnessCall("RegistrationQueryService.listRegistrationsForTour"),
          getRegistrationById: async () =>
            unexpectedHarnessCall("RegistrationQueryService.getRegistrationById"),
        });

  const stateMachineService = createRegistrationStateMachineStack({
    manager: options.manager,
    tour: options.tour,
    outboxCalls,
    captureOutboxEventTypes: options.captureOutboxEventTypes,
    requestContext: options.requestContext,
    waitlistService,
    capacityReservationPort: options.capacityReservationPort,
  });

  return new TypeOrmRegistrationsApplicationService(
    harness(transactionRunner),
    tourAccessService,
    queryService,
    options.creationService ??
      harness<RegistrationCreationService>({
        createRegistration: async () =>
          unexpectedHarnessCall("RegistrationCreationService.createRegistration"),
        createBooking: async () => unexpectedHarnessCall("RegistrationCreationService.createBooking"),
        createPublicRegistrationOrWaitlist: async () =>
          unexpectedHarnessCall("RegistrationCreationService.createPublicRegistrationOrWaitlist"),
      }),
    stateMachineService,
    waitlistService,
    new RegistrationPublicFlowMetrics(),
  );
}

export function createLeaderRequestContext(
  tenantId: string,
  userId = "99999999-9999-4999-8999-999999999999",
): RequestContextStub {
  return {
    getRole: () => UserRole.Owner,
    resolveEffectiveTenantId: () => tenantId,
    getTenantId: () => tenantId,
    getUserId: () => userId,
    getRequestId: () => "req-test",
  };
}

export function createRegistrationCreationService(options: {
  manager: EntityManager;
  tour: TourCatalogPortTestDoubleState;
  requestContext: RequestContextStub;
  capacityReservationPort?: TourCapacityReservationPort;
  catalogPort?: RegistrationsTourCatalogPort;
}): RegistrationCreationService {
  const catalogPort =
    options.catalogPort ?? createRegistrationsTourCatalogPortTestDouble(options.tour);
  const transactionRunner = createTransactionRunner(options.manager, {
    capacityReservationPort: options.capacityReservationPort,
  });
  const tourAccessService = new RegistrationTourAccessService(
    harness<TenantBootstrapService>({
      resolveTenantFromTourId: async (tourId: string) =>
        tourId === options.tour.id ? options.tour.tenantId : null,
    }),
    catalogPort,
    harness(options.requestContext),
  );
  const readRepository = createRegistrationsReadRepositoryPortTestDouble(
    {
      async findOne({ where }) {
        const row = await options.manager.findOne(RegistrationEntity, { where: where as never });
        return row;
      },
    },
    options.manager,
  );
  const capacityService = new RegistrationCapacityService(
    catalogPort,
    harness(
      options.capacityReservationPort ?? {
        reserveTicket: async () => undefined,
        releaseTicket: async () => undefined,
      },
    ),
  );
  const persistenceService = new RegistrationPersistenceService(
    harness(options.requestContext),
    harness<OutboxService>({ addEvent: async () => undefined }),
    readRepository,
    harness<RegistrationPricingService>({
      restoreImmutableRegistrationQuoteColumns: async () => undefined,
      ensureBookingPriceSnapshotLockedAndEmit: async () => undefined,
      createAndStampSnapshot: async (_manager, registration) => registration,
    }),
  );

  return new RegistrationCreationServiceImpl(
    harness(options.requestContext),
    harness<OutboxService>({ addEvent: async () => undefined }),
    stubRegistrationQuoteApplication,
    catalogPort,
    harness(transactionRunner),
    tourAccessService,
    capacityService,
    persistenceService,
    harness<RegistrationPlacementService>({
      tourRequiresPayment: () => false,
      loadTourTripDetailsForPlacement: async () => ({}),
      assertPrivateCarRegistrationAllowed: () => undefined,
      participantMetadataForPersistence: ({ participantMetadata }) => participantMetadata,
      resolveInitialRegistrationPlacement: () => ({
        status: RegistrationStatus.ACCEPTED,
        consumesAcceptedCapacity: true,
      }),
    }),
    harness<RegistrationPricingService>({
      createAndStampSnapshot: async (_manager, registration) => registration,
    }),
    new RegistrationPublicFlowMetrics(),
    harness<IRegistrationLookupPort>({
      resolveAuthenticatedBookingInput: async () =>
        unexpectedHarnessCall("IRegistrationLookupPort.resolveAuthenticatedBookingInput"),
    }),
  );
}
