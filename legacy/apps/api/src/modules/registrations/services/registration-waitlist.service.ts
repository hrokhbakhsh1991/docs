import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { OutboxService } from "../../outbox/outbox.service";
import { ConvertWaitlistItemDto } from "../dto/convert-waitlist-item.dto";
import { CreateWaitlistItemDto } from "../dto/create-waitlist-item.dto";
import { WaitlistItemResponseDto } from "../dto/get-registration.dto";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../registration.entity";
import { WaitlistItemEntity, WaitlistItemStatus } from "../waitlist-item.entity";
import { RegistrationQuoteApplicationService } from "../application/registration-quote.application.service";
import {
  emitWaitlistCancelledEvent,
  emitWaitlistConvertedAndAcceptedEvents,
} from "../registrations-effects";
import {
  assertJwtTenantMatchesTourForAuthenticatedMutation,
} from "../registrations-policy";
import {
  assertNoDuplicateWaitlist,
  assertTourAllowsWaitlist,
  assertWaitlistPromotionAllowed,
} from "../policies/waitlist-integrity.policy";
import { assertTourIsOpenForRegistration } from "../domain/tour-registration.policy";
import { bookableTourDepartureId } from "../domain/bookable-departure-id";
import {
  REGISTRATIONS_TOUR_CATALOG_PORT,
  type RegistrationsTourCatalogPort,
  type TourCatalogSnapshot,
} from "../domain/ports/registrations-tour-catalog.port";
import type { TourBookingLockRecord } from "../domain/registration-write.types";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import type { CancelWaitlistItemCommand } from "../domain/ports/registrations-application.port";
import { RegistrationTransactionRunner } from "./registration-transaction.runner";
import { RegistrationTourAccessService } from "./registration-tour-access.service";
import { RegistrationCapacityService } from "./registration-capacity.service";
import { RegistrationPersistenceService } from "./registration-persistence.service";
import { RegistrationPricingService } from "./registration-pricing.service";
import { RegistrationPublicFlowMetrics } from "./registration-public-flow-metrics";
import {
  tourCapacityPolicyFromCatalogSnapshot,
  toWaitlistResponse,
} from "./registration-response.mapper";

@Injectable()
export class RegistrationWaitlistService {
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
    @Inject(RegistrationPricingService)
    private readonly pricingService: RegistrationPricingService,
    @Inject(RegistrationPublicFlowMetrics)
    private readonly metrics: RegistrationPublicFlowMetrics,
  ) {}

  async createWaitlistItem(createDto: CreateWaitlistItemDto): Promise<WaitlistItemResponseDto> {
    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const tour = await this.registrationsTourCatalogPort.getTourSnapshot(manager, createDto.tourId);
      if (!tour) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }
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

      await this.persistence.ensureNoActiveRegistrationDuplicate(manager, scopedPayload);
      const existingWaitlistItems = await manager.find(WaitlistItemEntity, {
        where: {
          tenantId,
          tourId: createDto.tourId,
          participantContactPhone: createDto.participantContactPhone,
        },
      });
      assertNoDuplicateWaitlist(existingWaitlistItems);
      assertTourAllowsWaitlist(tourCapacityPolicyFromCatalogSnapshot(tour));
      await this.persistence.ensureNoWaitingWaitlistDuplicate(manager, {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone,
      });

      const waitlistItem = manager.create(WaitlistItemEntity, {
        tenantId,
        tourId: createDto.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
        participantFullName: createDto.participantFullName,
        participantContactPhone: createDto.participantContactPhone,
        transportMode: createDto.transportMode,
        entryMode: createDto.entryMode,
        status: WaitlistItemStatus.WAITING,
      });

      const saved = await manager.save(waitlistItem);
      this.metrics.registrationWaitlistedTotal += 1;
      return toWaitlistResponse(saved);
    });
  }

  async convertWaitlistItem(
    waitlistItemId: string,
    payload: ConvertWaitlistItemDto,
  ): Promise<WaitlistItemResponseDto> {
    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const waitlistItem = await this.persistence.requireWaitlistItemForUpdate(
        manager,
        waitlistItemId,
      );
      if (waitlistItem.status !== WaitlistItemStatus.WAITING) {
        throw new ConflictException({
          error: {
            code: "STATE_TRANSITION_INVALID",
            message: "Only waiting waitlist items can be converted",
          },
        });
      }
      const head = await this.persistence.getOldestWaitingWaitlistItemForUpdate(
        manager,
        waitlistItem.tenantId,
        waitlistItem.tourId,
      );
      if (!head || head.id !== waitlistItem.id) {
        throw new ConflictException({
          error: {
            code: "STATE_TRANSITION_INVALID",
            message: "Only the earliest waiting item can be converted",
          },
        });
      }
      await this.persistence.ensureNoActiveRegistrationDuplicate(manager, {
        tenantId: waitlistItem.tenantId,
        tourId: waitlistItem.tourId,
        participantContactPhone: waitlistItem.participantContactPhone,
      });
      const tour = await this.tourAccess.requireTourInTenant(
        manager,
        waitlistItem.tourId,
        waitlistItem.tenantId,
      );
      assertTourIsOpenForRegistration(tourCapacityPolicyFromCatalogSnapshot(tour));
      assertWaitlistPromotionAllowed(tourCapacityPolicyFromCatalogSnapshot(tour));
      await this.capacityService.consumeAcceptedCapacitySlot(manager, tour);

      const convertedRegistration = manager.create(RegistrationEntity, {
        tenantId: waitlistItem.tenantId,
        tourId: waitlistItem.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
        ...(await this.registrationQuoteApplication.buildQuoteSnapshot(manager, tour, null)),
        participantFullName: waitlistItem.participantFullName,
        participantContactPhone: waitlistItem.participantContactPhone,
        transportMode: waitlistItem.transportMode,
        entryMode: waitlistItem.entryMode,
        status: RegistrationStatus.ACCEPTED,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      });
      const savedRegistration = await this.persistence.saveRegistrationOrVersionConflict(
        manager,
        convertedRegistration,
      );
      const savedRegistrationWithSnapshot = await this.pricingService.createAndStampSnapshot(
        manager,
        savedRegistration,
      );
      waitlistItem.status = WaitlistItemStatus.CONVERTED;
      waitlistItem.promotedRegistrationId = savedRegistrationWithSnapshot.id;
      waitlistItem.conversionReason = payload.conversionReason;
      const savedWaitlist = await manager.save(waitlistItem);

      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await emitWaitlistConvertedAndAcceptedEvents({
        manager,
        outboxService: this.outboxService,
        waitlistItem: savedWaitlist,
        promotedRegistration: savedRegistrationWithSnapshot,
        actorId,
        reason: payload.conversionReason ?? undefined,
        source: "manual_waitlist_conversion",
      });

      return toWaitlistResponse(savedWaitlist);
    });
  }

  async cancelWaitlistItem(
    waitlistItemId: string,
    command: CancelWaitlistItemCommand,
  ): Promise<WaitlistItemResponseDto> {
    const payload = command as { cancelReason?: string; reason?: string };
    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const waitlistItem = await this.persistence.requireWaitlistItemForUpdate(
        manager,
        waitlistItemId,
      );
      if (waitlistItem.status !== WaitlistItemStatus.WAITING) {
        throw new ConflictException({
          error: {
            code: "STATE_TRANSITION_INVALID",
            message: "Only waiting waitlist items can be cancelled",
          },
        });
      }
      waitlistItem.status = WaitlistItemStatus.CANCELLED;
      waitlistItem.cancelReason = payload.cancelReason ?? payload.reason;
      const saved = await manager.save(waitlistItem);
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await emitWaitlistCancelledEvent({
        manager,
        outboxService: this.outboxService,
        waitlistItem: saved,
        actorId,
      });
      return toWaitlistResponse(saved);
    });
  }

  async promoteNextWaitlistSlotIfEligible(
    tenantId: string,
    tourId: string,
    lockedTour: TourBookingLockRecord,
  ): Promise<boolean> {
    const manager = this.transactionRunner.activeManager;
    const tourEntity = await this.registrationsTourCatalogPort.getTourSnapshot(manager, lockedTour.id);
    if (!tourEntity) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    const anchor = manager.create(RegistrationEntity, {
      tenantId,
      tourId,
      tourDepartureId: bookableTourDepartureId(tourEntity),
      participantFullName: "__reconciliation_promotion_anchor__",
      participantContactPhone: "__system__",
      transportMode: "other",
      entryMode: "web",
      status: RegistrationStatus.PENDING,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      paidAmount: undefined,
    });
    return this.promoteNextWaitlistItem(manager, anchor, tourEntity);
  }

  async promoteNextWaitlistItemForPaymentFlow(
    releasedRegistration: RegistrationWriteRecord,
    lockedTour: TourBookingLockRecord | null,
  ): Promise<boolean> {
    const manager = this.transactionRunner.activeManager;
    const reg = await manager.findOne(RegistrationEntity, {
      where: { id: releasedRegistration.id, tenantId: releasedRegistration.tenantId },
    });
    if (!reg) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    const tourEntity =
      lockedTour != null
        ? await this.registrationsTourCatalogPort.getTourSnapshot(manager, lockedTour.id)
        : null;
    return this.promoteNextWaitlistItem(manager, reg, tourEntity);
  }

  async promoteNextWaitlistItem(
    manager: EntityManager,
    registration: RegistrationEntity,
    lockedTour?: TourCatalogSnapshot | null,
  ): Promise<boolean> {
    const tour =
      lockedTour ??
      (await this.tourAccess.requireTourInTenant(
        manager,
        registration.tourId,
        registration.tenantId,
      ));
    assertTourIsOpenForRegistration(tourCapacityPolicyFromCatalogSnapshot(tour));
    assertWaitlistPromotionAllowed(tourCapacityPolicyFromCatalogSnapshot(tour));
    if (tour.acceptedCount >= tour.totalCapacity) {
      return false;
    }

    const waitlistItem = await manager
      .getRepository(WaitlistItemEntity)
      .createQueryBuilder("w")
      .where("w.tenant_id = :tenantId", { tenantId: registration.tenantId })
      .andWhere("w.tour_id = :tourId", { tourId: registration.tourId })
      .andWhere("w.status = :status", { status: WaitlistItemStatus.WAITING })
      .orderBy("w.created_at", "ASC")
      .setLock("pessimistic_write")
      .setOnLocked("skip_locked")
      .getOne();

    if (!waitlistItem) {
      return false;
    }

    try {
      await this.capacityService.consumeAcceptedCapacitySlot(manager, tour);
    } catch {
      return false;
    }

    const promotedRegistration = manager.create(RegistrationEntity, {
      tenantId: waitlistItem.tenantId,
      tourId: waitlistItem.tourId,
      tourDepartureId: bookableTourDepartureId(tour),
      ...(await this.registrationQuoteApplication.buildQuoteSnapshot(manager, tour, null)),
      participantFullName: waitlistItem.participantFullName,
      participantContactPhone: waitlistItem.participantContactPhone,
      transportMode: waitlistItem.transportMode,
      entryMode: waitlistItem.entryMode,
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      paidAmount: undefined,
    });

    const savedPromotedRegistration = await this.persistence.saveRegistrationOrVersionConflict(
      manager,
      promotedRegistration,
    );
    const savedPromotedWithSnapshot = await this.pricingService.createAndStampSnapshot(
      manager,
      savedPromotedRegistration,
    );

    waitlistItem.status = WaitlistItemStatus.CONVERTED;
    waitlistItem.promotedRegistrationId = savedPromotedWithSnapshot.id;
    await manager.save(waitlistItem);

    const actorId = this.requestContextService.getUserId() ?? "system";
    await emitWaitlistConvertedAndAcceptedEvents({
      manager,
      outboxService: this.outboxService,
      waitlistItem,
      promotedRegistration: savedPromotedWithSnapshot,
      actorId,
      source: "waitlist_promotion",
    });
    return true;
  }
}
