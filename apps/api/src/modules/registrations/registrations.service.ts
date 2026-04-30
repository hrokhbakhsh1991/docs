import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { PaymentResponseDto } from "../payments/dto/payment-response.dto";
import { OutboxService } from "../outbox/outbox.service";
import { CancelWaitlistItemDto } from "./dto/cancel-waitlist-item.dto";
import { ConvertWaitlistItemDto } from "./dto/convert-waitlist-item.dto";
import {
  CreateRegistrationDto,
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "./dto/create-registration.dto";
import { CreateWaitlistItemDto } from "./dto/create-waitlist-item.dto";
import {
  RegistrationResponseDto,
  WaitlistItemResponseDto
} from "./dto/get-registration.dto";
import { UpdateRegistrationPaymentDto } from "./dto/update-registration-payment.dto";
import { UpdateRegistrationStatusDto } from "./dto/update-registration-status.dto";
import { TourEntity } from "../tours/entities/tour.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "./registration.entity";
import { WaitlistItemEntity, WaitlistItemStatus } from "./waitlist-item.entity";

@Injectable()
export class RegistrationsService {
  private registrationCreatedTotal = 0;
  private registrationWaitlistedTotal = 0;
  private registrationPaidTotal = 0;

  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    @InjectRepository(WaitlistItemEntity)
    private readonly waitlistItemRepository: Repository<WaitlistItemEntity>,
    private readonly dataSource: DataSource,
    private readonly requestContextService: RequestContextService,
    private readonly outboxService: OutboxService
  ) {}

  async createRegistration(
    createDto: CreateRegistrationDto
  ): Promise<RegistrationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const tour = await this.requireTourInTenant(
        manager,
        createDto.tourId,
        createDto.tenantId
      );

      await this.ensureNoActiveRegistrationDuplicate(manager, createDto);
      if (tour.acceptedCount >= tour.totalCapacity) {
        // TODO: Replace with automatic waitlist creation in next slice.
        throw new ConflictException({
          error: {
            code: "CAPACITY_FULL",
            message: "Acceptance blocked because capacity is full"
          }
        });
      }

      const paymentRequired =
        typeof tour.costContext?.requiresPayment === "boolean"
          ? Boolean(tour.costContext.requiresPayment)
          : false;
      const initialStatus = paymentRequired
        ? RegistrationStatus.ACCEPTED
        : RegistrationStatus.PENDING;

      const registration = manager.create(RegistrationEntity, {
        tenantId: createDto.tenantId,
        tourId: createDto.tourId,
        participantFullName: createDto.participantFullName,
        participantContactPhone: createDto.participantContactPhone,
        transportMode: createDto.transportMode,
        entryMode: createDto.entryMode,
        telegramUserId: createDto.telegramUserId,
        telegramUsername: createDto.telegramUsername,
        vehicleSeatCapacity: createDto.vehicleSeatCapacity,
        participantNote: createDto.participantNote,
        status: initialStatus,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
        paidAmount: undefined
      });

      if (paymentRequired) {
        tour.acceptedCount += 1;
        await manager.save(tour);
      }

      const saved = await manager.save(registration);
      this.registrationCreatedTotal += 1;
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await this.outboxService.addEvent(manager, {
        aggregateType: "Registration",
        aggregateId: saved.id,
        eventType: "registration.created",
        payload: {
          entityType: "registration",
          entityId: saved.id,
          actorId,
          tenantId: saved.tenantId,
          tourId: saved.tourId,
          status: saved.status,
          paymentRequired,
          timestamp: new Date().toISOString()
        }
      });
      return this.toRegistrationResponse(saved);
    });
  }

  async getRegistrationById(
    registrationId: string
  ): Promise<RegistrationResponseDto> {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId }
    });
    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    return this.toRegistrationResponse(registration);
  }

  async updateRegistrationStatus(
    registrationId: string,
    payload: UpdateRegistrationStatusDto
  ): Promise<RegistrationResponseDto> {
    const trustedTenantId = this.requestContextService.getTenantId();
    if (!trustedTenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: registrationId }
      });
      if (!registration) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }

      if (registration.tenantId !== trustedTenantId) {
        throw new ForbiddenException({
          error: {
            code: "TENANT_CONTEXT_INVALID",
            message: "Trusted tenant context is invalid"
          }
        });
      }

      this.validateStatusTransition(registration.status, payload.targetStatus);

      const previousStatus = registration.status;
      const statusChanged = previousStatus !== payload.targetStatus;
      const affectsAcceptedCounter =
        this.isCapacityConsumingStatus(previousStatus) ||
        this.isCapacityConsumingStatus(payload.targetStatus);

      const lockedTour =
        statusChanged && affectsAcceptedCounter
          ? await this.requireTourInTenantForUpdate(
              manager,
              registration.tourId,
              registration.tenantId
            )
          : null;

      await this.ensureCapacityForAcceptance(
        manager,
        registration,
        payload.targetStatus,
        lockedTour
      );

      registration.status = payload.targetStatus;
      if (lockedTour) {
        this.applyAcceptedCounterDelta(lockedTour, previousStatus, payload.targetStatus);
        await manager.save(lockedTour);
      }
      const saved = await manager.save(registration);

      if (
        this.isCapacityConsumingStatus(previousStatus) &&
        !this.isCapacityConsumingStatus(payload.targetStatus)
      ) {
        await this.promoteNextWaitlistItem(manager, saved, lockedTour);
      }

      if (previousStatus !== payload.targetStatus) {
        const eventName = this.mapRegistrationStatusEvent(payload.targetStatus);
        const actorId = this.requestContextService.getUserId() ?? "unknown";
        await this.outboxService.addEvent(manager, {
          aggregateType: "Registration",
          aggregateId: saved.id,
          eventType: eventName,
          payload: {
            entityType: "registration",
            entityId: saved.id,
            actorId,
            metadata: {
              previousStatus,
              newStatus: payload.targetStatus,
              tourId: saved.tourId,
              scheduleId: null
            },
            timestamp: new Date().toISOString()
          }
        });
      }

      return this.toRegistrationResponse(saved);
    });
  }

  async updateRegistrationPayment(
    registrationId: string,
    payload: UpdateRegistrationPaymentDto
  ): Promise<RegistrationResponseDto> {
    void this.registrationRepository;
    return {
      ...this.buildRegistrationStub({
        tenantId: "11111111-1111-4111-8111-111111111111",
        tourId: "22222222-2222-4222-8222-222222222222",
        participantFullName: "Ali Ahmadi",
        participantContactPhone: "+989121234567",
        transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
        entryMode: RegistrationEntryModeDto.WEB
      }),
      id: registrationId,
      paymentStatus: payload.paymentStatus,
      paidAmount:
        payload.paidAmount !== undefined ? payload.paidAmount.toString() : undefined
    };
  }

  async updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>
  ): Promise<RegistrationEntity> {
    const trustedTenantId = this.requestContextService.getTenantId();
    if (!trustedTenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const registration = await manager.findOne(RegistrationEntity, {
        where: { id }
      });
      if (!registration) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }

      if (registration.tenantId !== trustedTenantId) {
        throw new ForbiddenException({
          error: {
            code: "TENANT_CONTEXT_INVALID",
            message: "Trusted tenant context is invalid"
          }
        });
      }

      this.validatePaymentTransition(
        registration.status,
        registration.paymentStatus,
        newPaymentStatus
      );

      registration.paymentStatus = newPaymentStatus;
      if (metadata !== undefined) {
        registration.paymentMetadata = metadata;
      }

      return manager.save(registration);
    });
  }

  async createWaitlistItem(
    createDto: CreateWaitlistItemDto
  ): Promise<WaitlistItemResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.requireTourInTenant(manager, createDto.tourId, createDto.tenantId);

      await this.ensureNoActiveRegistrationDuplicate(manager, createDto);
      await this.ensureNoWaitingWaitlistDuplicate(manager, createDto);

      const waitlistItem = manager.create(WaitlistItemEntity, {
        tenantId: createDto.tenantId,
        tourId: createDto.tourId,
        participantFullName: createDto.participantFullName,
        participantContactPhone: createDto.participantContactPhone,
        transportMode: createDto.transportMode,
        entryMode: createDto.entryMode,
        status: WaitlistItemStatus.WAITING
      });

      const saved = await manager.save(waitlistItem);
      this.registrationWaitlistedTotal += 1;
      return this.toWaitlistResponse(saved);
    });
  }

  async convertWaitlistItem(
    waitlistItemId: string,
    payload: ConvertWaitlistItemDto
  ): Promise<WaitlistItemResponseDto> {
    void this.waitlistItemRepository;
    return {
      ...this.buildWaitlistStub({
        tenantId: "11111111-1111-4111-8111-111111111111",
        tourId: "22222222-2222-4222-8222-222222222222",
        participantFullName: "Sara Mohammadi",
        participantContactPhone: "+989351112233",
        transportMode: RegistrationTransportModeDto.OTHER,
        entryMode: RegistrationEntryModeDto.TELEGRAM
      }),
      id: waitlistItemId,
      status: WaitlistItemStatus.CONVERTED,
      conversionReason: payload.conversionReason
    };
  }

  async cancelWaitlistItem(
    waitlistItemId: string,
    payload: CancelWaitlistItemDto
  ): Promise<WaitlistItemResponseDto> {
    void this.waitlistItemRepository;
    return {
      ...this.buildWaitlistStub({
        tenantId: "11111111-1111-4111-8111-111111111111",
        tourId: "22222222-2222-4222-8222-222222222222",
        participantFullName: "Sara Mohammadi",
        participantContactPhone: "+989351112233",
        transportMode: RegistrationTransportModeDto.OTHER,
        entryMode: RegistrationEntryModeDto.TELEGRAM
      }),
      id: waitlistItemId,
      status: WaitlistItemStatus.CANCELLED,
      cancelReason: payload.cancelReason
    };
  }

  private async requireTourInTenant(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourEntity> {
    const tour = await manager.findOne(TourEntity, { where: { id: tourId } });
    if (!tour) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    if (tour.tenantId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_INVALID",
          message: "Trusted tenant context is invalid"
        }
      });
    }
    return tour;
  }

  private async requireTourInTenantForUpdate(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourEntity> {
    const tour = await manager
      .getRepository(TourEntity)
      .createQueryBuilder("tour")
      .setLock("pessimistic_write")
      .where("tour.id = :tourId", { tourId })
      .andWhere("tour.tenant_id = :tenantId", { tenantId })
      .getOne();

    if (!tour) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    return tour;
  }

  private async ensureNoActiveRegistrationDuplicate(
    manager: EntityManager,
    payload: {
      tenantId: string;
      tourId: string;
      participantContactPhone: string;
      telegramUserId?: string;
    }
  ): Promise<void> {
    const duplicateByPhone = await manager.findOne(RegistrationEntity, {
      where: {
        tenantId: payload.tenantId,
        tourId: payload.tourId,
        participantContactPhone: payload.participantContactPhone,
        status: In([
          RegistrationStatus.PENDING,
          RegistrationStatus.ACCEPTED,
          RegistrationStatus.ACCEPTED_PAID
        ])
      }
    });

    const duplicateByTelegram =
      payload.telegramUserId && payload.telegramUserId.trim() !== ""
        ? await manager.findOne(RegistrationEntity, {
            where: {
              tenantId: payload.tenantId,
              tourId: payload.tourId,
              telegramUserId: payload.telegramUserId,
              status: In([
                RegistrationStatus.PENDING,
                RegistrationStatus.ACCEPTED,
                RegistrationStatus.ACCEPTED_PAID
              ])
            }
          })
        : null;

    const duplicate = duplicateByPhone ?? duplicateByTelegram;
    if (!duplicate) {
      return;
    }

    throw new ConflictException({
      error: {
        code: "REGISTRATION_DUPLICATE_ACTIVE",
        message: "Active registration already exists for participant and tour"
      }
    });
  }

  private async ensureNoWaitingWaitlistDuplicate(
    manager: EntityManager,
    payload: {
      tenantId: string;
      tourId: string;
      participantContactPhone: string;
    }
  ): Promise<void> {
    const existingWaitingItem = await manager.findOne(WaitlistItemEntity, {
      where: {
        tenantId: payload.tenantId,
        tourId: payload.tourId,
        participantContactPhone: payload.participantContactPhone,
        status: WaitlistItemStatus.WAITING
      }
    });

    if (!existingWaitingItem) {
      return;
    }

    throw new ConflictException({
      error: {
        code: "WAITLIST_CONFLICT_ACTIVE_RECORD",
        message: "Conversion blocked due to active registration/waitlist conflict"
      }
    });
  }

  private toRegistrationResponse(
    entity: RegistrationEntity
  ): RegistrationResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      tourId: entity.tourId,
      participantFullName: entity.participantFullName,
      participantContactPhone: entity.participantContactPhone,
      transportMode: entity.transportMode,
      entryMode: entity.entryMode,
      telegramUserId: entity.telegramUserId,
      telegramUsername: entity.telegramUsername,
      vehicleSeatCapacity: entity.vehicleSeatCapacity,
      participantNote: entity.participantNote,
      status: entity.status,
      paymentStatus: entity.paymentStatus,
      paidAmount: entity.paidAmount,
      payment:
        entity.paymentMetadata &&
        typeof entity.paymentMetadata.provider === "string" &&
        typeof entity.paymentMetadata.currency === "string" &&
        typeof entity.paymentMetadata.amount === "string"
          ? {
              status:
                typeof entity.paymentMetadata.status === "string"
                  ? entity.paymentMetadata.status
                  : "Pending",
              amount: entity.paymentMetadata.amount,
              currency: entity.paymentMetadata.currency,
              provider: entity.paymentMetadata.provider,
              providerPaymentId:
                typeof entity.paymentMetadata.providerPaymentId === "string"
                  ? entity.paymentMetadata.providerPaymentId
                  : null
            }
          : undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };
  }

  private toWaitlistResponse(entity: WaitlistItemEntity): WaitlistItemResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      tourId: entity.tourId,
      participantFullName: entity.participantFullName,
      participantContactPhone: entity.participantContactPhone,
      transportMode: entity.transportMode,
      entryMode: entity.entryMode,
      status: entity.status,
      conversionReason: entity.conversionReason,
      cancelReason: entity.cancelReason,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };
  }

  private validateStatusTransition(
    currentStatus: RegistrationStatus,
    targetStatus: RegistrationStatus
  ): void {
    const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
      [RegistrationStatus.PENDING]: [
        RegistrationStatus.ACCEPTED,
        RegistrationStatus.ACCEPTED_PAID,
        RegistrationStatus.REJECTED,
        RegistrationStatus.CANCELLED
      ],
      [RegistrationStatus.ACCEPTED]: [
        RegistrationStatus.ACCEPTED_PAID,
        RegistrationStatus.REJECTED,
        RegistrationStatus.CANCELLED,
        RegistrationStatus.NO_SHOW
      ],
      [RegistrationStatus.ACCEPTED_PAID]: [
        RegistrationStatus.REJECTED,
        RegistrationStatus.CANCELLED,
        RegistrationStatus.REFUNDED
      ],
      [RegistrationStatus.REJECTED]: [],
      [RegistrationStatus.CANCELLED]: [],
      [RegistrationStatus.NO_SHOW]: [],
      [RegistrationStatus.REFUNDED]: []
    };

    if (currentStatus === targetStatus) {
      return;
    }

    if (allowedTransitions[currentStatus].includes(targetStatus)) {
      return;
    }

    throw new ConflictException({
      error: {
        code: "STATE_TRANSITION_INVALID",
        message: "Requested registration status transition is not allowed"
      }
    });
  }

  private validatePaymentTransition(
    registrationStatus: RegistrationStatus,
    currentPaymentStatus: RegistrationPaymentStatus,
    nextPaymentStatus: RegistrationPaymentStatus
  ): void {
    if (
      registrationStatus === RegistrationStatus.CANCELLED ||
      registrationStatus === RegistrationStatus.REJECTED
    ) {
      throw new ConflictException({
        error: {
          code: "PAYMENT_STATUS_TRANSITION_INVALID",
          message:
            "Requested payment update is not allowed for cancelled or rejected registration"
        }
      });
    }

    if (currentPaymentStatus === nextPaymentStatus) {
      return;
    }

    const allowedTransitions: Partial<
      Record<RegistrationPaymentStatus, RegistrationPaymentStatus[]>
    > = {
      [RegistrationPaymentStatus.NOT_PAID]: [
        RegistrationPaymentStatus.PAID,
        RegistrationPaymentStatus.FAILED
      ],
      [RegistrationPaymentStatus.PAID]: [RegistrationPaymentStatus.REFUNDED],
      [RegistrationPaymentStatus.FAILED]: [
        RegistrationPaymentStatus.NOT_PAID,
        RegistrationPaymentStatus.PAID
      ]
    };

    const allowedNext = allowedTransitions[currentPaymentStatus] ?? [];
    if (allowedNext.includes(nextPaymentStatus)) {
      return;
    }

    throw new ConflictException({
      error: {
        code: "PAYMENT_STATUS_TRANSITION_INVALID",
        message: "Requested payment update violates payment status lifecycle rules"
      }
    });
  }

  private async ensureCapacityForAcceptance(
    manager: EntityManager,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus,
    lockedTour?: TourEntity | null
  ): Promise<void> {
    if (
      this.isCapacityConsumingStatus(registration.status) ||
      !this.isCapacityConsumingStatus(targetStatus)
    ) {
      return;
    }

    const tour =
      lockedTour ??
      (await this.requireTourInTenantForUpdate(
        manager,
        registration.tourId,
        registration.tenantId
      ));

    if (tour.acceptedCount >= tour.totalCapacity) {
      throw new ConflictException({
        error: {
          code: "CAPACITY_FULL",
          message: "Tour capacity reached. Cannot accept additional registrations."
        }
      });
    }
  }

  private applyAcceptedCounterDelta(
    tour: TourEntity,
    previousStatus: RegistrationStatus,
    targetStatus: RegistrationStatus
  ): void {
    const wasAccepted = this.isCapacityConsumingStatus(previousStatus);
    const willBeAccepted = this.isCapacityConsumingStatus(targetStatus);
    if (wasAccepted === willBeAccepted) {
      return;
    }

    if (willBeAccepted) {
      tour.acceptedCount += 1;
      return;
    }

    tour.acceptedCount = Math.max(0, tour.acceptedCount - 1);
  }

  /**
   * Phase 4: pessimistic tour lock (same query path as registration flows).
   */
  async lockTourRowForUpdate(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourEntity> {
    return this.requireTourInTenantForUpdate(manager, tourId, tenantId);
  }

  /**
   * Phase 4: one FIFO promotion when capacity allows — delegates to canonical promotion only.
   */
  async promoteNextWaitlistSlotIfEligible(
    manager: EntityManager,
    tenantId: string,
    tourId: string,
    lockedTour: TourEntity
  ): Promise<boolean> {
    const anchor = manager.create(RegistrationEntity, {
      tenantId,
      tourId,
      participantFullName: "__reconciliation_promotion_anchor__",
      participantContactPhone: "__system__",
      transportMode: "other",
      entryMode: "web",
      status: RegistrationStatus.PENDING,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      paidAmount: undefined
    });
    return this.promoteNextWaitlistItem(manager, anchor, lockedTour);
  }

  private async promoteNextWaitlistItem(
    manager: EntityManager,
    registration: RegistrationEntity,
    lockedTour?: TourEntity | null
  ): Promise<boolean> {
    // Phase 2: canonical promotion transaction uses locked Tour counter + FIFO waitlist lock.
    const tour =
      lockedTour ??
      (await this.requireTourInTenantForUpdate(
        manager,
        registration.tourId,
        registration.tenantId
      ));
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

    const promotedRegistration = manager.create(RegistrationEntity, {
      tenantId: waitlistItem.tenantId,
      tourId: waitlistItem.tourId,
      participantFullName: waitlistItem.participantFullName,
      participantContactPhone: waitlistItem.participantContactPhone,
      transportMode: waitlistItem.transportMode,
      entryMode: waitlistItem.entryMode,
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      paidAmount: undefined
    });

    const savedPromotedRegistration = await manager.save(promotedRegistration);

    waitlistItem.status = WaitlistItemStatus.CONVERTED;
    waitlistItem.promotedRegistrationId = savedPromotedRegistration.id;
    await manager.save(waitlistItem);
    tour.acceptedCount += 1;
    await manager.save(tour);

    const actorId = this.requestContextService.getUserId() ?? "system";
    await this.outboxService.addEvent(manager, {
      aggregateType: "WaitlistItem",
      aggregateId: waitlistItem.id,
      eventType: "waitlist.converted",
      payload: {
        entityType: "waitlist_item",
        entityId: waitlistItem.id,
        actorId,
        promotedRegistrationId: savedPromotedRegistration.id,
        tourId: waitlistItem.tourId,
        timestamp: new Date().toISOString()
      }
    });
    await this.outboxService.addEvent(manager, {
      aggregateType: "Registration",
      aggregateId: savedPromotedRegistration.id,
      eventType: "registration.accepted",
      payload: {
        entityType: "registration",
        entityId: savedPromotedRegistration.id,
        actorId,
        metadata: {
          previousStatus: null,
          newStatus: RegistrationStatus.ACCEPTED,
          tourId: savedPromotedRegistration.tourId,
          scheduleId: null,
          source: "waitlist_promotion",
          waitlistItemId: waitlistItem.id
        },
        timestamp: new Date().toISOString()
      }
    });
    return true;
  }

  private mapRegistrationStatusEvent(targetStatus: RegistrationStatus): string {
    switch (targetStatus) {
      case RegistrationStatus.ACCEPTED:
        return "registration.accepted";
      case RegistrationStatus.ACCEPTED_PAID:
        return "registration.accepted_paid";
      case RegistrationStatus.REJECTED:
        return "registration.rejected";
      case RegistrationStatus.CANCELLED:
        return "registration.cancelled";
      case RegistrationStatus.NO_SHOW:
        return "registration.no_show";
      case RegistrationStatus.REFUNDED:
        return "registration.refunded";
      default:
        return "registration.status_changed";
    }
  }

  async transitionRegistrationForPayment(
    manager: EntityManager,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus,
    actorId: string
  ): Promise<RegistrationEntity> {
    const previousStatus = registration.status;
    if (previousStatus === targetStatus) {
      return registration;
    }
    this.validateStatusTransition(previousStatus, targetStatus);
    const affectsAcceptedCounter =
      this.isCapacityConsumingStatus(previousStatus) ||
      this.isCapacityConsumingStatus(targetStatus);
    const lockedTour = affectsAcceptedCounter
      ? await this.requireTourInTenantForUpdate(
          manager,
          registration.tourId,
          registration.tenantId
        )
      : null;
    await this.ensureCapacityForAcceptance(
      manager,
      registration,
      targetStatus,
      lockedTour
    );
    registration.status = targetStatus;
    if (lockedTour) {
      this.applyAcceptedCounterDelta(lockedTour, previousStatus, targetStatus);
      await manager.save(lockedTour);
    }
    const saved = await manager.save(registration);
    if (
      this.isCapacityConsumingStatus(previousStatus) &&
      !this.isCapacityConsumingStatus(targetStatus)
    ) {
      await this.promoteNextWaitlistItem(manager, saved, lockedTour);
    }
    await this.outboxService.addEvent(manager, {
      aggregateType: "Registration",
      aggregateId: saved.id,
      eventType: this.mapRegistrationStatusEvent(targetStatus),
      payload: {
        entityType: "registration",
        entityId: saved.id,
        actorId,
        metadata: {
          previousStatus,
          newStatus: targetStatus,
          tourId: saved.tourId,
          scheduleId: null,
          source: "payment_flow"
        },
        timestamp: new Date().toISOString()
      }
    });
    if (targetStatus === RegistrationStatus.ACCEPTED_PAID) {
      this.registrationPaidTotal += 1;
    }
    return saved;
  }

  getPublicFlowMetrics(): {
    registrationCreatedTotal: number;
    registrationWaitlistedTotal: number;
    registrationPaidTotal: number;
  } {
    return {
      registrationCreatedTotal: this.registrationCreatedTotal,
      registrationWaitlistedTotal: this.registrationWaitlistedTotal,
      registrationPaidTotal: this.registrationPaidTotal
    };
  }

  async createPublicRegistrationOrWaitlist(input: {
    tenantId: string;
    tourId: string;
    participantFullName: string;
    participantContactPhone: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
    vehicleSeatCapacity?: number;
    participantNote?: string;
    createPaymentIntent?: (
      manager: EntityManager,
      registrationId: string
    ) => Promise<PaymentResponseDto>;
  }): Promise<
    | {
        type: "registration";
        registration: RegistrationResponseDto;
        requiresPayment: boolean;
        paymentIntent: PaymentResponseDto | null;
      }
    | { type: "waitlist"; waitlistItem: WaitlistItemResponseDto; queuePosition: number }
  > {
    return this.dataSource.transaction(async (manager) => {
      const tour = await this.requireTourInTenantForUpdate(
        manager,
        input.tourId,
        input.tenantId
      );
      await this.ensureNoActiveRegistrationDuplicate(manager, input);
      if (tour.acceptedCount >= tour.totalCapacity) {
        await this.ensureNoWaitingWaitlistDuplicate(manager, input);
        const waitlist = manager.create(WaitlistItemEntity, {
          tenantId: input.tenantId,
          tourId: input.tourId,
          participantFullName: input.participantFullName,
          participantContactPhone: input.participantContactPhone,
          transportMode: input.transportMode,
          entryMode: input.entryMode,
          status: WaitlistItemStatus.WAITING
        });
        const savedWaitlist = await manager.save(waitlist);
        this.registrationWaitlistedTotal += 1;
        await this.outboxService.addEvent(manager, {
          aggregateType: "WaitlistItem",
          aggregateId: savedWaitlist.id,
          eventType: "registration.waitlisted",
          payload: {
            entityType: "waitlist_item",
            entityId: savedWaitlist.id,
            actorId: this.requestContextService.getUserId() ?? "public",
            tourId: savedWaitlist.tourId,
            timestamp: new Date().toISOString()
          }
        });
        const queuePosition = await manager.count(WaitlistItemEntity, {
          where: {
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: WaitlistItemStatus.WAITING
          }
        });
        return {
          type: "waitlist" as const,
          waitlistItem: this.toWaitlistResponse(savedWaitlist),
          queuePosition
        };
      }

      const registration = manager.create(RegistrationEntity, {
        tenantId: input.tenantId,
        tourId: input.tourId,
        participantFullName: input.participantFullName,
        participantContactPhone: input.participantContactPhone,
        transportMode: input.transportMode,
        entryMode: input.entryMode,
        telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername,
        vehicleSeatCapacity: input.vehicleSeatCapacity,
        participantNote: input.participantNote,
        status: RegistrationStatus.ACCEPTED,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
        paidAmount: undefined
      });
      tour.acceptedCount += 1;
      await manager.save(tour);
      const saved = await manager.save(registration);
      this.registrationCreatedTotal += 1;
      await this.outboxService.addEvent(manager, {
        aggregateType: "Registration",
        aggregateId: saved.id,
        eventType: "registration.accepted",
        payload: {
          entityType: "registration",
          entityId: saved.id,
          actorId: this.requestContextService.getUserId() ?? "public",
          metadata: {
            previousStatus: null,
            newStatus: RegistrationStatus.ACCEPTED,
            source: "public_registration"
          },
          timestamp: new Date().toISOString()
        }
      });
      const requiresPayment =
        typeof tour.costContext?.requiresPayment === "boolean"
          ? Boolean(tour.costContext.requiresPayment)
          : false;
      const paymentIntent =
        requiresPayment && input.createPaymentIntent
          ? await input.createPaymentIntent(manager, saved.id)
          : null;
      return {
        type: "registration" as const,
        registration: this.toRegistrationResponse(saved),
        requiresPayment,
        paymentIntent
      };
    });
  }

  private isCapacityConsumingStatus(status: RegistrationStatus): boolean {
    return (
      status === RegistrationStatus.ACCEPTED ||
      status === RegistrationStatus.ACCEPTED_PAID
    );
  }

  private buildRegistrationStub(
    payload: Pick<
      CreateRegistrationDto,
      | "tenantId"
      | "tourId"
      | "participantFullName"
      | "participantContactPhone"
      | "transportMode"
      | "entryMode"
    > &
      Partial<CreateRegistrationDto>
  ): RegistrationResponseDto {
    const now = new Date().toISOString();
    return {
      id: "33333333-3333-4333-8333-333333333333",
      tenantId: payload.tenantId,
      tourId: payload.tourId,
      participantFullName: payload.participantFullName,
      participantContactPhone: payload.participantContactPhone,
      transportMode: payload.transportMode,
      entryMode: payload.entryMode,
      telegramUserId: payload.telegramUserId,
      telegramUsername: payload.telegramUsername,
      vehicleSeatCapacity: payload.vehicleSeatCapacity,
      participantNote: payload.participantNote,
      status: RegistrationStatus.PENDING,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      paidAmount: undefined,
      payment: undefined,
      createdAt: now,
      updatedAt: now
    };
  }

  private buildWaitlistStub(
    payload: Pick<
      CreateWaitlistItemDto,
      | "tenantId"
      | "tourId"
      | "participantFullName"
      | "participantContactPhone"
      | "transportMode"
      | "entryMode"
    >
  ): WaitlistItemResponseDto {
    const now = new Date().toISOString();
    return {
      id: "44444444-4444-4444-8444-444444444444",
      tenantId: payload.tenantId,
      tourId: payload.tourId,
      participantFullName: payload.participantFullName,
      participantContactPhone: payload.participantContactPhone,
      transportMode: payload.transportMode,
      entryMode: payload.entryMode,
      status: WaitlistItemStatus.WAITING,
      conversionReason: undefined,
      cancelReason: undefined,
      createdAt: now,
      updatedAt: now
    };
  }
}
