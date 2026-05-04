import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, IsNull, Repository } from "typeorm";
import {
  registrationWhereForActor,
  syntheticBookingContactPhone,
  waitlistWhereForActor
} from "../../common/security/ownership-scope";
import { requestContextStorage } from "../../common/request-context/request-context";
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
import { UserEntity } from "../identity/entities/user.entity";
import { TenantBootstrapService } from "../tenant/tenant-bootstrap.service";

@Injectable()
export class RegistrationsService {
  private registrationCreatedTotal = 0;
  private registrationWaitlistedTotal = 0;
  private registrationPaidTotal = 0;

  // DI-DIAGNOSTIC: If this service is instantiated with undefined fields, root cause is typically missing runtime design:paramtypes metadata in test transpilation pipeline.
  // TODO(FREEZE-BLOCKER): Validate constructor dependency availability during E2E app bootstrap (registrationRepository, dataSource, requestContextService, outboxService); failures in RegistrationsController suggest upstream provider resolution issues.
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly tenantBootstrapService: TenantBootstrapService,
    private readonly requestContextService: RequestContextService,
    private readonly outboxService: OutboxService
  ) {}

  /**
   * Tenant for public idempotency boundaries (no JWT): resolved from the tour row only.
   */
  async getTenantIdForTourOrThrow(tourId: string): Promise<string> {
    const tenantId = await this.tenantBootstrapService.resolveTenantFromTourId(tourId);
    if (!tenantId) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    return tenantId;
  }

  async createRegistration(
    createDto: CreateRegistrationDto
  ): Promise<RegistrationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const tour = await manager.findOne(TourEntity, { where: { id: createDto.tourId } });
      if (!tour) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }
      this.assertJwtTenantMatchesTourForAuthenticatedMutation(tour.tenantId);

      const tenantId = tour.tenantId;
      const scopedPayload = {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone,
        telegramUserId: createDto.telegramUserId
      };

      await this.ensureNoActiveRegistrationDuplicate(manager, scopedPayload);
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
        tenantId,
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

  /**
   * Authenticated shortcut: body is only `{ tourId }`. Participant profile fields are derived from the user row and a stable synthetic phone for duplicate detection.
   */
  async createBooking(tourId: string): Promise<RegistrationResponseDto> {
    const tenantId = this.requestContextService.getTenantId();
    const userId = this.requestContextService.getUserId();
    if (!tenantId || !userId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "User not found"
        }
      });
    }

    const participantFullName =
      (user.fullName?.trim() && user.fullName.trim().length > 0
        ? user.fullName.trim()
        : undefined) ??
      user.email.split("@")[0] ??
      "Participant";

    const participantContactPhone = syntheticBookingContactPhone(userId);

    const createDto = {
      tourId,
      participantFullName,
      participantContactPhone,
      transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
      entryMode: RegistrationEntryModeDto.WEB,
      telegramUserId: user.telegramUserId ?? undefined,
      telegramUsername: undefined
    } as CreateRegistrationDto;

    return this.createRegistration(createDto);
  }

  async listRegistrationsForTour(tourId: string): Promise<RegistrationResponseDto[]> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    return this.dataSource.transaction(async (manager) => {
      await this.requireTourInTenant(manager, tourId, tenantId);
      const rows = await manager.find(RegistrationEntity, {
        where: { tourId, tenantId },
        order: { createdAt: "DESC" }
      });
      return rows.map((row) => this.toRegistrationResponse(row));
    });
  }

  async listWaitlistItemsForTour(tourId: string): Promise<WaitlistItemResponseDto[]> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    return this.dataSource.transaction(async (manager) => {
      await this.requireTourInTenant(manager, tourId, tenantId);
      const rows = await manager.find(WaitlistItemEntity, {
        where: { tourId, tenantId },
        order: { createdAt: "ASC" }
      });
      return rows.map((row) => this.toWaitlistResponse(row));
    });
  }

  async listBookings(): Promise<RegistrationResponseDto[]> {
    const tenantId = this.requestContextService.getTenantId();
    const userId = this.requestContextService.getUserId();
    if (!tenantId || !userId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "User not found"
        }
      });
    }

    const participantContactPhone = syntheticBookingContactPhone(userId);
    const whereClauses: Array<
      { tenantId: string; participantContactPhone: string } | { tenantId: string; telegramUserId: string }
    > = [{ tenantId, participantContactPhone }];
    if (typeof user.telegramUserId === "string" && user.telegramUserId.trim() !== "") {
      whereClauses.push({ tenantId, telegramUserId: user.telegramUserId.trim() });
    }

    const rows = await this.registrationRepository.find({
      where: whereClauses,
      order: { createdAt: "DESC" }
    });
    return rows.map((row) => this.toRegistrationResponse(row));
  }

  async getRegistrationById(
    registrationId: string
  ): Promise<RegistrationResponseDto> {
    const where = await registrationWhereForActor(
      this.registrationRepository.manager,
      this.userRepository,
      this.requestContextService,
      registrationId
    );
    const registration = await this.registrationRepository.findOne({
      where
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
    return this.dataSource.transaction(async (manager) => {
      const where = await registrationWhereForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        registrationId
      );
      const registration = await manager.findOne(RegistrationEntity, { where });
      if (!registration) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
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
    return this.dataSource.transaction(async (manager) => {
      const where = await registrationWhereForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        registrationId
      );
      const registration = await manager.findOne(RegistrationEntity, { where });
      if (!registration) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }
      this.validatePaymentTransition(
        registration.status,
        registration.paymentStatus,
        payload.paymentStatus
      );
      this.validatePaymentAmountConsistency(payload.paymentStatus, payload.paidAmount);

      registration.paymentStatus = payload.paymentStatus;
      registration.paidAmount =
        payload.paidAmount !== undefined ? payload.paidAmount.toString() : undefined;
      const saved = await manager.save(registration);
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await this.outboxService.addEvent(manager, {
        aggregateType: "Registration",
        aggregateId: saved.id,
        eventType: "registration.payment_updated",
        payload: {
          entityType: "registration",
          entityId: saved.id,
          actorId,
          metadata: {
            paymentStatus: saved.paymentStatus,
            paidAmount: saved.paidAmount ?? null
          },
          timestamp: new Date().toISOString()
        }
      });
      return this.toRegistrationResponse(saved);
    });
  }

  async updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>
  ): Promise<RegistrationEntity> {
    const trustedTenantId = this.requestContextService.getTenantId();
    const role = (this.requestContextService.getRole() ?? "").trim().toLowerCase();
    if (!trustedTenantId && role !== "admin") {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const registrationScope = await registrationWhereForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        id
      );
      const registration = await manager.findOne(RegistrationEntity, {
        where: registrationScope
      });
      if (!registration) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }

      if (
        role !== "admin" &&
        trustedTenantId &&
        registration.tenantId !== trustedTenantId
      ) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
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
      const tour = await manager.findOne(TourEntity, { where: { id: createDto.tourId } });
      if (!tour) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }
      this.assertJwtTenantMatchesTourForAuthenticatedMutation(tour.tenantId);

      const tenantId = tour.tenantId;
      const scopedPayload = {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone,
        telegramUserId: createDto.telegramUserId
      };

      await this.ensureNoActiveRegistrationDuplicate(manager, scopedPayload);
      await this.ensureNoWaitingWaitlistDuplicate(manager, {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone
      });

      const waitlistItem = manager.create(WaitlistItemEntity, {
        tenantId,
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
    return this.dataSource.transaction(async (manager) => {
      const waitlistItem = await this.requireWaitlistItemForUpdate(manager, waitlistItemId);
      if (waitlistItem.status !== WaitlistItemStatus.WAITING) {
        throw new ConflictException({
          error: {
            code: "STATE_TRANSITION_INVALID",
            message: "Only waiting waitlist items can be converted"
          }
        });
      }
      const head = await this.getOldestWaitingWaitlistItemForUpdate(
        manager,
        waitlistItem.tenantId,
        waitlistItem.tourId
      );
      if (!head || head.id !== waitlistItem.id) {
        throw new ConflictException({
          error: {
            code: "STATE_TRANSITION_INVALID",
            message: "Only the earliest waiting item can be converted"
          }
        });
      }
      await this.ensureNoActiveRegistrationDuplicate(manager, {
        tenantId: waitlistItem.tenantId,
        tourId: waitlistItem.tourId,
        participantContactPhone: waitlistItem.participantContactPhone
      });
      const tour = await this.requireTourInTenantForUpdate(
        manager,
        waitlistItem.tourId,
        waitlistItem.tenantId
      );
      if (tour.acceptedCount >= tour.totalCapacity) {
        throw new ConflictException({
          error: {
            code: "CAPACITY_FULL",
            message: "Tour capacity reached. Cannot convert waitlist item."
          }
        });
      }

      const convertedRegistration = manager.create(RegistrationEntity, {
        tenantId: waitlistItem.tenantId,
        tourId: waitlistItem.tourId,
        participantFullName: waitlistItem.participantFullName,
        participantContactPhone: waitlistItem.participantContactPhone,
        transportMode: waitlistItem.transportMode,
        entryMode: waitlistItem.entryMode,
        status: RegistrationStatus.ACCEPTED,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID
      });
      const savedRegistration = await manager.save(convertedRegistration);
      waitlistItem.status = WaitlistItemStatus.CONVERTED;
      waitlistItem.promotedRegistrationId = savedRegistration.id;
      waitlistItem.conversionReason = payload.conversionReason;
      tour.acceptedCount += 1;
      await manager.save(tour);
      const savedWaitlist = await manager.save(waitlistItem);

      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await this.outboxService.addEvent(manager, {
        aggregateType: "WaitlistItem",
        aggregateId: savedWaitlist.id,
        eventType: "waitlist.converted",
        payload: {
          entityType: "waitlist_item",
          entityId: savedWaitlist.id,
          actorId,
          promotedRegistrationId: savedRegistration.id,
          reason: payload.conversionReason ?? null,
          timestamp: new Date().toISOString()
        }
      });
      await this.outboxService.addEvent(manager, {
        aggregateType: "Registration",
        aggregateId: savedRegistration.id,
        eventType: "registration.accepted",
        payload: {
          entityType: "registration",
          entityId: savedRegistration.id,
          actorId,
          metadata: {
            previousStatus: null,
            newStatus: RegistrationStatus.ACCEPTED,
            source: "manual_waitlist_conversion",
            waitlistItemId: savedWaitlist.id
          },
          timestamp: new Date().toISOString()
        }
      });

      return this.toWaitlistResponse(savedWaitlist);
    });
  }

  async cancelWaitlistItem(
    waitlistItemId: string,
    payload: CancelWaitlistItemDto
  ): Promise<WaitlistItemResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const waitlistItem = await this.requireWaitlistItemForUpdate(manager, waitlistItemId);
      if (waitlistItem.status !== WaitlistItemStatus.WAITING) {
        throw new ConflictException({
          error: {
            code: "STATE_TRANSITION_INVALID",
            message: "Only waiting waitlist items can be cancelled"
          }
        });
      }
      waitlistItem.status = WaitlistItemStatus.CANCELLED;
      waitlistItem.cancelReason = payload.cancelReason;
      const saved = await manager.save(waitlistItem);
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await this.outboxService.addEvent(manager, {
        aggregateType: "WaitlistItem",
        aggregateId: saved.id,
        eventType: "waitlist.cancelled",
        payload: {
          entityType: "waitlist_item",
          entityId: saved.id,
          actorId,
          reason: saved.cancelReason ?? null,
          timestamp: new Date().toISOString()
        }
      });
      return this.toWaitlistResponse(saved);
    });
  }

  /**
   * Authenticated creates: tour defines canonical tenant; JWT tenant must match (admin may cross-tenant).
   */
  private assertJwtTenantMatchesTourForAuthenticatedMutation(tourTenantId: string): void {
    const role = (this.requestContextService.getRole() ?? "").trim().toLowerCase();
    if (role === "admin") {
      return;
    }
    const jwtTenantId = this.requestContextService.getTenantId();
    if (!jwtTenantId || jwtTenantId !== tourTenantId) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
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
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
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

  private async requireWaitlistItemForUpdate(
    manager: EntityManager,
    waitlistItemId: string
  ): Promise<WaitlistItemEntity> {
    const where = await waitlistWhereForActor(
      manager,
      this.userRepository,
      this.requestContextService,
      waitlistItemId
    );
    const qb = manager
      .getRepository(WaitlistItemEntity)
      .createQueryBuilder("w")
      .setLock("pessimistic_write")
      .where("w.id = :waitlistItemId", { waitlistItemId: where.id })
      .andWhere("w.deleted_at IS NULL");
    if (where.tenantId) {
      qb.andWhere("w.tenant_id = :tenantId", { tenantId: where.tenantId });
    }
    if (where.participantContactPhone) {
      qb.andWhere("w.participant_contact_phone = :participantContactPhone", {
        participantContactPhone: where.participantContactPhone
      });
    }
    const resolved = await qb.getOne();
    if (!resolved) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    return resolved;
  }

  private async getOldestWaitingWaitlistItemForUpdate(
    manager: EntityManager,
    tenantId: string,
    tourId: string
  ): Promise<WaitlistItemEntity | null> {
    return manager
      .getRepository(WaitlistItemEntity)
      .createQueryBuilder("w")
      .where("w.tenant_id = :tenantId", { tenantId })
      .andWhere("w.tour_id = :tourId", { tourId })
      .andWhere("w.status = :status", { status: WaitlistItemStatus.WAITING })
      .orderBy("w.created_at", "ASC")
      .setLock("pessimistic_write")
      .setOnLocked("skip_locked")
      .getOne();
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

  private validatePaymentAmountConsistency(
    nextPaymentStatus: RegistrationPaymentStatus,
    paidAmount?: number
  ): void {
    if (
      nextPaymentStatus === RegistrationPaymentStatus.NOT_PAID &&
      paidAmount !== undefined &&
      paidAmount > 0
    ) {
      throw new ConflictException({
        error: {
          code: "PAYMENT_STATUS_TRANSITION_INVALID",
          message: "NotPaid status cannot have a positive paidAmount"
        }
      });
    }

    if (
      nextPaymentStatus === RegistrationPaymentStatus.PARTIAL &&
      paidAmount !== undefined &&
      paidAmount <= 0
    ) {
      throw new ConflictException({
        error: {
          code: "PAYMENT_STATUS_TRANSITION_INVALID",
          message: "Partial status requires a positive paidAmount when provided"
        }
      });
    }
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
    const store = requestContextStorage.getStore();
    const run = async (manager: EntityManager) => {
      const tourPeek = await manager.findOne(TourEntity, {
        where: { id: input.tourId },
        select: { id: true, tenantId: true }
      });
      if (!tourPeek) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }
      const tenantId = tourPeek.tenantId;
      const scopedInput = { ...input, tenantId };
      const tour = await this.requireTourInTenantForUpdate(
        manager,
        input.tourId,
        tenantId
      );
      await this.ensureNoActiveRegistrationDuplicate(manager, scopedInput);
      if (tour.acceptedCount >= tour.totalCapacity) {
        await this.ensureNoWaitingWaitlistDuplicate(manager, scopedInput);
        const waitlist = manager.create(WaitlistItemEntity, {
          tenantId,
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
            tenantId,
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
        tenantId,
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
    };
    if (store) {
      return requestContextStorage.run(store, () => this.dataSource.transaction(run));
    }
    return this.dataSource.transaction(run);
  }

  private isCapacityConsumingStatus(status: RegistrationStatus): boolean {
    return (
      status === RegistrationStatus.ACCEPTED ||
      status === RegistrationStatus.ACCEPTED_PAID
    );
  }

}
