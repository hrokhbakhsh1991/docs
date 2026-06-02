import {
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { requestContextStorage } from "../../../common/request-context/request-context";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import type { RegistrationPaymentIntentSnapshot } from "../domain/registration-payment-intent.types";
import {
  CreateRegistrationDto,
  RegistrationBookingTargetDto,
  RegistrationEntryModeDto,
  RegistrationTransportModeDto,
} from "../dto/create-registration.dto";
import { RegistrationResponseDto, WaitlistItemResponseDto } from "../dto/get-registration.dto";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../registration.entity";
import { WaitlistItemEntity, WaitlistItemStatus } from "../waitlist-item.entity";
import { OutboxService } from "../../outbox/outbox.service";
import { RegistrationQuoteApplicationService } from "../application/registration-quote.application.service";
import {
  emitPublicRegistrationAcceptedEvent,
  emitRegistrationCreatedEvent,
  emitRegistrationWaitlistedEvent,
} from "../registrations-effects";
import {
  assertJwtTenantMatchesTourForAuthenticatedMutation,
} from "../registrations-policy";
import { assertUserNotAlreadyRegistered } from "../policies/registration-integrity.policy";
import {
  assertNoDuplicateWaitlist,
  assertTourAllowsWaitlist,
} from "../policies/waitlist-integrity.policy";
import { assertTourIsOpenForRegistration } from "../domain/tour-registration.policy";
import { bookableTourDepartureId } from "../domain/bookable-departure-id";
import {
  REGISTRATIONS_TOUR_CATALOG_PORT,
  type RegistrationsTourCatalogPort,
} from "../domain/ports/registrations-tour-catalog.port";
import type {
  CreateRegistrationCommand,
} from "../domain/ports/registrations-application.port";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import { assertTravelerMeetsPeakRequirementOrThrow } from "../utils/peak-experience-placement";
import { RegistrationTransactionRunner } from "./registration-transaction.runner";
import { RegistrationTourAccessService } from "./registration-tour-access.service";
import { RegistrationCapacityService } from "./registration-capacity.service";
import { RegistrationPersistenceService } from "./registration-persistence.service";
import { RegistrationPlacementService } from "./registration-placement.service";
import { RegistrationPricingService } from "./registration-pricing.service";
import { RegistrationPublicFlowMetrics } from "./registration-public-flow-metrics";
import {
  REGISTRATION_LOOKUP_PORT,
  type IRegistrationLookupPort,
} from "../domain/ports/registration-lookup.port";
import {
  asRegistrationWriteRecord,
  tourCapacityPolicyFromCatalogSnapshot,
  toRegistrationResponse,
  toWaitlistResponse,
} from "./registration-response.mapper";

@Injectable()
export class RegistrationCreationService {
  constructor(
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(RegistrationQuoteApplicationService)
    private readonly registrationQuoteApplication: RegistrationQuoteApplicationService,
    @Inject(REGISTRATIONS_TOUR_CATALOG_PORT)
    private readonly registrationsTourCatalogPort: RegistrationsTourCatalogPort,
    @Inject(RegistrationTransactionRunner)
    private readonly transactionRunner: RegistrationTransactionRunner,
    @Inject(RegistrationTourAccessService)
    private readonly tourAccess: RegistrationTourAccessService,
    @Inject(RegistrationCapacityService)
    private readonly capacityService: RegistrationCapacityService,
    @Inject(RegistrationPersistenceService)
    private readonly persistence: RegistrationPersistenceService,
    @Inject(RegistrationPlacementService)
    private readonly placementService: RegistrationPlacementService,
    @Inject(RegistrationPricingService)
    private readonly pricingService: RegistrationPricingService,
    @Inject(RegistrationPublicFlowMetrics)
    private readonly metrics: RegistrationPublicFlowMetrics,
    @Inject(REGISTRATION_LOOKUP_PORT)
    private readonly registrationLookup: IRegistrationLookupPort,
  ) {}

  async createRegistration(command: CreateRegistrationCommand): Promise<RegistrationResponseDto> {
    const createDto = command as CreateRegistrationDto;
    const result = await this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const tourPeek = await this.registrationsTourCatalogPort.getTourSnapshot(
        manager,
        createDto.tourId,
      );
      if (!tourPeek) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }
      const tour = await this.tourAccess.requireTourInTenant(
        manager,
        createDto.tourId,
        tourPeek.tenantId,
      );
      assertTourIsOpenForRegistration(tourCapacityPolicyFromCatalogSnapshot(tour));
      await this.tourAccess.assertTourNationalIdRegistrationPolicyOrThrow(manager, createDto.tourId, {
        bookingTarget: createDto.bookingTarget,
        participantNationalId: createDto.participantNationalId,
      });
      assertJwtTenantMatchesTourForAuthenticatedMutation({
        role: this.requestContextService.getRole(),
        jwtTenantId: this.requestContextService.resolveEffectiveTenantId(),
        tourTenantId: tour.tenantId,
      });

      const tenantId = tour.tenantId;
      const scopedPayload = {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone,
        telegramUserId: createDto.telegramUserId,
      };

      const existingRegistrations = await manager.find(RegistrationEntity, {
        where: {
          tenantId,
          tourId: createDto.tourId,
          participantContactPhone: createDto.participantContactPhone,
        },
      });
      assertUserNotAlreadyRegistered(tourCapacityPolicyFromCatalogSnapshot(tour), existingRegistrations);

      await this.persistence.ensureNoActiveRegistrationDuplicate(manager, scopedPayload);

      const paymentRequired = this.placementService.tourRequiresPayment(tour.costContext);
      const tripDetails = await this.placementService.loadTourTripDetailsForPlacement(
        manager,
        tour.id,
      );
      this.placementService.assertPrivateCarRegistrationAllowed(
        tour,
        tripDetails,
        createDto.transportMode,
      );
      const placement = this.placementService.resolveInitialRegistrationPlacement(
        tour,
        createDto.participantMetadata,
        tripDetails,
      );

      const registration = manager.create(RegistrationEntity, {
        tenantId,
        tourId: createDto.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
        ...(await this.registrationQuoteApplication.buildQuoteSnapshot(
          manager,
          tour,
          createDto.discountCode ?? null,
        )),
        participantFullName: createDto.participantFullName,
        participantContactPhone: createDto.participantContactPhone,
        bookingTarget: createDto.bookingTarget ?? RegistrationBookingTargetDto.SELF,
        participantNationalId: createDto.participantNationalId,
        transportMode: createDto.transportMode,
        entryMode: createDto.entryMode,
        telegramUserId: createDto.telegramUserId,
        telegramUsername: createDto.telegramUsername,
        vehicleSeatCapacity: createDto.vehicleSeatCapacity,
        participantNote: createDto.participantNote,
        participantMetadata: this.placementService.participantMetadataForPersistence(createDto),
        status: placement.status,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
        paidAmount: undefined,
      });

      if (placement.consumesAcceptedCapacity) {
        await this.capacityService.consumeAcceptedCapacitySlot(manager, tour);
      }

      const saved = await this.persistence.saveRegistrationOrVersionConflict(manager, registration);
      const savedWithSnapshot = await this.pricingService.createAndStampSnapshot(manager, saved);
      this.metrics.registrationCreatedTotal += 1;
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await emitRegistrationCreatedEvent({
        manager,
        outboxService: this.outboxService,
        registration: savedWithSnapshot,
        actorId,
        paymentRequired,
      });
      return toRegistrationResponse(savedWithSnapshot);
    });

    return result;
  }

  async createBooking(tourId: string): Promise<RegistrationResponseDto> {
    const input = await this.registrationLookup.resolveAuthenticatedBookingInput(tourId);
    const createDto = {
      ...input,
      transportMode: input.transportMode as RegistrationTransportModeDto,
      entryMode: input.entryMode as RegistrationEntryModeDto,
    } as CreateRegistrationDto;
    return this.createRegistration(createDto as CreateRegistrationCommand);
  }

  async createPublicRegistrationOrWaitlist(input: {
    tourId: string;
    bookingTarget?: string;
    participantFullName: string;
    participantContactPhone: string;
    participantNationalId?: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
    isDriver?: boolean;
    plateNumber?: string;
    shareFuelCost?: boolean;
    vehicleSeatCapacity?: number;
    participantNote?: string;
    participantMetadata?: Record<string, unknown>;
    selectedServiceIds?: string[];
    discountCode?: string | null;
    createPaymentIntent?: (
      _registration: RegistrationWriteRecord
    ) => Promise<RegistrationPaymentIntentSnapshot>;
  }): Promise<
    | {
        type: "registration";
        registration: RegistrationResponseDto;
        requiresPayment: boolean;
        paymentIntent: RegistrationPaymentIntentSnapshot | null;
      }
    | { type: "waitlist"; waitlistItem: WaitlistItemResponseDto; queuePosition: number }
  > {
    const store = requestContextStorage.getStore();
    const run = async (manager: EntityManager) => {
      const tourPeek = await this.registrationsTourCatalogPort.getTourSnapshot(
        manager,
        input.tourId,
      );
      if (!tourPeek) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }
      const tenantId = tourPeek.tenantId;
      const scopedInput = { ...input, tenantId };
      const tour = await this.tourAccess.requireTourInTenant(manager, input.tourId, tenantId);
      assertTourIsOpenForRegistration(tourCapacityPolicyFromCatalogSnapshot(tour));
      await this.tourAccess.assertTourNationalIdRegistrationPolicyOrThrow(
        manager,
        input.tourId,
        input,
      );
      const existingRegistrations = await manager.find(RegistrationEntity, {
        where: {
          tenantId,
          tourId: input.tourId,
          participantContactPhone: input.participantContactPhone,
        },
      });
      assertUserNotAlreadyRegistered(tourCapacityPolicyFromCatalogSnapshot(tour), existingRegistrations);
      await this.persistence.ensureNoActiveRegistrationDuplicate(manager, scopedInput);
      if (tour.acceptedCount >= tour.totalCapacity) {
        assertTourAllowsWaitlist(tourCapacityPolicyFromCatalogSnapshot(tour));
        const existingWaitlistItems = await manager.find(WaitlistItemEntity, {
          where: {
            tenantId,
            tourId: input.tourId,
            participantContactPhone: input.participantContactPhone,
          },
        });
        assertNoDuplicateWaitlist(existingWaitlistItems);
        await this.persistence.ensureNoWaitingWaitlistDuplicate(manager, scopedInput);
        const waitlist = manager.create(WaitlistItemEntity, {
          tenantId,
          tourId: input.tourId,
          tourDepartureId: bookableTourDepartureId(tour),
          participantFullName: input.participantFullName,
          participantContactPhone: input.participantContactPhone,
          transportMode: input.transportMode,
          entryMode: input.entryMode,
          status: WaitlistItemStatus.WAITING,
        });
        const savedWaitlist = await manager.save(waitlist);
        this.metrics.registrationWaitlistedTotal += 1;
        await emitRegistrationWaitlistedEvent({
          manager,
          outboxService: this.outboxService,
          waitlistItem: savedWaitlist,
          actorId: this.requestContextService.getUserId() ?? "public",
        });
        const queuePosition = await manager.count(WaitlistItemEntity, {
          where: {
            tenantId,
            tourId: input.tourId,
            status: WaitlistItemStatus.WAITING,
          },
        });
        return {
          type: "waitlist" as const,
          waitlistItem: toWaitlistResponse(savedWaitlist),
          queuePosition,
        };
      }

      const tripDetails = await this.placementService.loadTourTripDetailsForPlacement(
        manager,
        tour.id,
      );
      this.placementService.assertPrivateCarRegistrationAllowed(
        tour,
        tripDetails,
        input.transportMode as RegistrationTransportModeDto,
      );
      assertTravelerMeetsPeakRequirementOrThrow(tripDetails, input.participantMetadata);
      const placement = this.placementService.resolveInitialRegistrationPlacement(
        tour,
        input.participantMetadata,
        tripDetails,
      );
      const requiresPayment = this.placementService.tourRequiresPayment(tour.costContext);

      const registration = manager.create(RegistrationEntity, {
        tenantId,
        tourId: input.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
        ...(await this.registrationQuoteApplication.buildQuoteSnapshot(
          manager,
          tour,
          input.discountCode ?? null,
        )),
        participantFullName: input.participantFullName,
        participantContactPhone: input.participantContactPhone,
        bookingTarget: input.bookingTarget ?? RegistrationBookingTargetDto.SELF,
        participantNationalId: input.participantNationalId,
        transportMode: input.transportMode,
        entryMode: input.entryMode,
        telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername,
        vehicleSeatCapacity: input.vehicleSeatCapacity,
        participantNote: input.participantNote,
        participantMetadata: this.placementService.participantMetadataForPersistence({
          participantMetadata: input.participantMetadata,
          transportMode: input.transportMode as RegistrationTransportModeDto,
          isDriver: input.isDriver,
          plateNumber: input.plateNumber,
          shareFuelCost: input.shareFuelCost,
          selectedServiceIds: input.selectedServiceIds,
        }),
        status: placement.status,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
        paidAmount: undefined,
      });
      if (placement.consumesAcceptedCapacity) {
        await this.capacityService.consumeAcceptedCapacitySlot(manager, tour);
      }
      const saved = await this.persistence.saveRegistrationOrVersionConflict(manager, registration);
      const savedWithSnapshot = await this.pricingService.createAndStampSnapshot(manager, saved);
      this.metrics.registrationCreatedTotal += 1;
      const actorId = this.requestContextService.getUserId() ?? "public";
      if (placement.status === RegistrationStatus.ACCEPTED) {
        await emitPublicRegistrationAcceptedEvent({
          manager,
          outboxService: this.outboxService,
          registration: savedWithSnapshot,
          actorId,
        });
      } else {
        await emitRegistrationCreatedEvent({
          manager,
          outboxService: this.outboxService,
          registration: savedWithSnapshot,
          actorId,
          paymentRequired: requiresPayment,
        });
      }
      let paymentIntent: RegistrationPaymentIntentSnapshot | null = null;
      if (requiresPayment && input.createPaymentIntent) {
        paymentIntent = await input.createPaymentIntent(
          asRegistrationWriteRecord(savedWithSnapshot),
        );
      }
      return {
        type: "registration" as const,
        registration: toRegistrationResponse(savedWithSnapshot),
        requiresPayment,
        paymentIntent,
      };
    };
    if (store) {
      return requestContextStorage.run(store, () =>
        this.transactionRunner.runInIdempotentOrOwnTransaction(run),
      );
    }
    return this.transactionRunner.runInIdempotentOrOwnTransaction(run);
  }
}
