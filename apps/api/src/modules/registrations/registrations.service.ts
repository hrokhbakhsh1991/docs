import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, IsNull, Repository } from "typeorm";
import {
  registrationWhereForActor,
  syntheticBookingContactPhone,
  waitlistWhereForActor
} from "../../common/security/ownership-scope";
import {
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { isOptimisticLockVersionMismatchError } from "../../common/typeorm/optimistic-lock-version-mismatch";
import { requestContextStorage } from "../../common/request-context/request-context";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { tryParseWorkspaceUserRole, UserRole } from "../../common/auth/user-role.enum";
import {
  actorHasTrustedTenantOrPlatformAdminBypass,
  registrationTenantMatchesActorScope,
} from "../../common/rbac/workspace-access.helper";
import type { PaymentResponseDto } from "../payments/dto/payment-response.dto";
import { OutboxService } from "../outbox/outbox.service";
import { CancelWaitlistItemDto } from "./dto/cancel-waitlist-item.dto";
import { ConvertWaitlistItemDto } from "./dto/convert-waitlist-item.dto";
import {
  CreateRegistrationDto,
  RegistrationBookingTargetDto,
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "./dto/create-registration.dto";
import { validateIranNationalIdChecksum } from "../identity/utils/iran-national-id";
import type { ParticipantMetadataDto } from "./dto/participant-metadata.dto";
import {
  assertTravelerMeetsPeakRequirementOrThrow,
  qualifiesForPeakExperienceAutoApproval,
} from "./utils/peak-experience-placement";
import { participantMetadataRecordForPersistence } from "./utils/registration-transport-intake";
import { resolveTourAllowPrivateCar } from "@repo/types";
import { CreateWaitlistItemDto } from "./dto/create-waitlist-item.dto";
import {
  RegistrationResponseDto,
  WaitlistItemResponseDto
} from "./dto/get-registration.dto";
import { UpdateRegistrationPaymentDto } from "./dto/update-registration-payment.dto";
import { UpdateRegistrationStatusDto } from "./dto/update-registration-status.dto";
import { TourDetails } from "../tours/entities/tour-details.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "./registration.entity";
import { lockRegistrationForFinancialMutation } from "./utils/lock-registration-for-financial-mutation";
import { WaitlistItemEntity, WaitlistItemStatus } from "./waitlist-item.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { TenantBootstrapService } from "../tenant/tenant-bootstrap.service";
import { createPricingSnapshot } from "../pricing/create-pricing-snapshot";
import { BookingPriceSnapshotEntity } from "../pricing/entities/booking-price-snapshot.entity";
import { PaymentEntity, PaymentStatus } from "../payments/entities/payment.entity";
import {
  emitBookingCreatedOutboxEvent,
  emitBookingFinalizationPipelineEvent,
  emitPublicRegistrationAcceptedEvent,
  emitRegistrationCreatedEvent,
  emitRegistrationPaymentUpdatedEvent,
  emitRegistrationStatusChangedEvent,
  emitRegistrationWaitlistedEvent,
  emitWaitlistCancelledEvent,
  emitWaitlistConvertedAndAcceptedEvents
} from "./registrations-effects";
import {
  assertJwtTenantMatchesTourForAuthenticatedMutation,
  validatePaymentAmountConsistency,
  validatePaymentTransition,
  validateStatusTransition
} from "./registrations-policy";
import {
  assertTourCapacityInvariant,
  assertUserNotAlreadyRegistered
} from "./policies/registration-integrity.policy";
import {
  assertNoDuplicateWaitlist,
  assertTourAllowsWaitlist,
  assertWaitlistPromotionAllowed
} from "./policies/waitlist-integrity.policy";
import {
  assertTourIsOpenForRegistration
} from "../tours/policies/tour-lifecycle.policy";
import { RegistrationQuoteApplicationService } from "./application/registration-quote.application.service";
import { bookableTourDepartureId } from "./domain/bookable-departure-id";
import {
  isCapacityConsumingRegistrationStatus,
  registrationStatusToOutboxEventType
} from "./domain/registration-outbox-event-type";
import { BookingLedgerAuthorityService } from "../finance/ledger/booking-ledger-authority.service";
import { assertFinancialIdempotencyKey } from "../idempotency/financial-idempotency";
import { getIdempotentEntityManager } from "../idempotency/idempotent-transaction.context";
import {
  BookingFinalizationPhase,
  assertSingleStepBookingFinalizationAdvance,
  bookingFinalizationPhaseFromFacts
} from "./domain/booking-finalization-pipeline";
import { RegistrationsReadRepository } from "./repositories/registrations-read.repository";
import type { IRegistrationsReadRepository } from "./repositories/registrations-read.repository.interface";
import { PricingEngineService } from "../pricing/pricing-engine.service";
import { IRegistrationPaymentPort } from "./ports/registration-payment.port";

/**
 * **Services = orchestration + policy** (ownership scopes, transitions, validation).
 * Registration reads delegate to {@link RegistrationsReadRepository} (**persistence only**).
 * **Pricing:** all persisted booking quotes go through {@link RegistrationQuoteApplicationService} → finance
 * rules engine (`calculateQuote`); do not compute totals inline here.
 * Decomposition inventory: `architecture/service-decomposition.map.ts` (`REGISTRATIONS_GOD_METHODS`).
 */
@Injectable()
export class RegistrationsService implements IRegistrationPaymentPort {
  private readonly logger = new Logger(RegistrationsService.name);
  private registrationCreatedTotal = 0;
  private registrationWaitlistedTotal = 0;
  private registrationPaidTotal = 0;

  /** Explicit `@Inject` on non-`@InjectRepository` params keeps tsx E2E DI stable without `design:paramtypes`. */
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(TenantBootstrapService) private readonly tenantBootstrapService: TenantBootstrapService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(RegistrationQuoteApplicationService)
    private readonly registrationQuoteApplication: RegistrationQuoteApplicationService,
    @Inject(RegistrationsReadRepository)
    private readonly registrationsReadRepository: IRegistrationsReadRepository,
    @Inject(BookingLedgerAuthorityService)
    private readonly bookingLedgerAuthority: BookingLedgerAuthorityService,
    @Inject(PricingEngineService)
    private readonly pricingEngineService: PricingEngineService
  ) {}

  /**
   * When HTTP idempotency wraps the controller, reuse that EntityManager so financial rows and
   * idempotency keys commit in one PostgreSQL transaction (see idempotent-transaction.context).
   */
  private runInIdempotentOrOwnTransaction<T>(
    fn: (_manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const em = getIdempotentEntityManager();
    if (em) {
      return fn(em);
    }
    return this.dataSource.transaction(fn);
  }

  /**
   * Creates a pricing snapshot for a **newly saved** registration and stamps `snapshotId` back
   * onto the entity row in the same transaction. This is the authoritative checkout-path snapshot
   * creation — called immediately after the first `manager.save(registration)` for new records.
   *
   * For registrations that already have `snapshotId` set, this is a no-op.
   */
  private async createAndStampSnapshot(
    manager: EntityManager,
    saved: RegistrationEntity
  ): Promise<RegistrationEntity> {
    if (saved.snapshotId) {
      // Already has a snapshot from a previous call or idempotent replay.
      return saved;
    }
    if (!saved.id) {
      return saved;
    }

    const listMinor = saved.quotedListPriceMinor ?? saved.quotedTotalMinor;
    if (
      saved.quotedTotalMinor == null ||
      saved.quotedPricingVersion == null ||
      saved.quotedCurrencyCode == null ||
      listMinor == null
    ) {
      // Quote columns incomplete — skip snapshot creation (free/no-cost tours).
      this.logger.warn(
        JSON.stringify({
          event: "SNAPSHOT_SKIPPED_INCOMPLETE_QUOTE",
          tenant_id: saved.tenantId,
          registration_id: saved.id,
          message: "Quote columns incomplete; snapshot not created for this registration."
        })
      );
      return saved;
    }

    // Shadow Mode: run a diagnostic quote against the PricingEngine to detect any drift
    // between the stored quote and the authoritative engine output.
    // Controlled by FINANCE_LEGACY_PRICING_DIAGNOSTICS=archive (non-production only).
    // This is a read-only operation — it does not affect snapshot values.
    try {
      await this.pricingEngineService.quote(
        manager,
        {
          tenantId: saved.tenantId,
          tourId: saved.tourId,
          departureId: saved.tourDepartureId,
          userRole: tryParseWorkspaceUserRole(this.requestContextService.getRole()) ?? UserRole.Member,
          discountCode: null
        },
        { financeShadowCompare: true }
      );
    } catch (shadowErr: unknown) {
      // Shadow mode errors must never block the checkout flow.
      this.logger.warn(
        JSON.stringify({
          event: "PRICING_SHADOW_COMPARE_ERROR",
          tenant_id: saved.tenantId,
          registration_id: saved.id,
          message: shadowErr instanceof Error ? shadowErr.message : String(shadowErr)
        })
      );
    }

    const snapshot = await createPricingSnapshot(manager, {
      tenantId: saved.tenantId,
      bookingId: saved.id,
      listPriceMinor: String(listMinor),
      currency: String(saved.quotedCurrencyCode),
      pricingRuleVersion: String(saved.quotedPricingVersion),
      computedTotalMinor: String(saved.quotedTotalMinor)
    });

    // Stamp snapshotId back onto the registration row in the same transaction.
    await manager.update(
      RegistrationEntity,
      { id: saved.id, tenantId: saved.tenantId },
      { snapshotId: snapshot.snapshotId }
    );
    saved.snapshotId = snapshot.snapshotId;

    this.logger.log(
      JSON.stringify({
        event: "BOOKING_PRICE_SNAPSHOT_CREATED",
        tenant_id: saved.tenantId,
        registration_id: saved.id,
        snapshot_id: snapshot.snapshotId,
        computed_total_minor: snapshot.computedTotalMinor,
        currency: snapshot.currency
      })
    );

    return saved;
  }

  /**
   * Tenant for public idempotency boundaries (no JWT): resolved from the tour row only.
   */
  async getTenantIdForTourOrThrow(tourId: string): Promise<string> {
    const tenantId = await this.tenantBootstrapService.resolveTenantFromTourId(tourId);
    if (!tenantId) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return tenantId;
  }

  async createRegistration(
    createDto: CreateRegistrationDto
  ): Promise<RegistrationResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const tourPeek = await manager.findOne(TourEntity, {
        where: { id: createDto.tourId },
        select: { id: true, tenantId: true }
      });
      if (!tourPeek) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }
      const tour = await this.requireTourInTenantForUpdate(
        manager,
        createDto.tourId,
        tourPeek.tenantId
      );
      assertTourIsOpenForRegistration(tour);
      await this.assertTourNationalIdRegistrationPolicyOrThrow(manager, createDto.tourId, {
        bookingTarget: createDto.bookingTarget,
        participantNationalId: createDto.participantNationalId
      });
      assertJwtTenantMatchesTourForAuthenticatedMutation({
        role: this.requestContextService.getRole(),
        jwtTenantId: this.requestContextService.resolveEffectiveTenantId(),
        tourTenantId: tour.tenantId
      });

      const tenantId = tour.tenantId;
      const scopedPayload = {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone,
        telegramUserId: createDto.telegramUserId
      };

      const existingRegistrations = await manager.find(RegistrationEntity, {
        where: {
          tenantId,
          tourId: createDto.tourId,
          participantContactPhone: createDto.participantContactPhone
        }
      });
      assertUserNotAlreadyRegistered(tour, existingRegistrations);

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
      const tripDetails = await this.loadTourTripDetailsForPlacement(manager, tour.id);
      this.assertPrivateCarRegistrationAllowed(tour, tripDetails, createDto.transportMode);
      const placement = this.resolveInitialRegistrationPlacement(
        tour,
        createDto.participantMetadata,
        tripDetails,
      );

      const registration = manager.create(RegistrationEntity, {
        tenantId,
        tourId: createDto.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
        ...(await this.registrationQuoteApplication.buildQuoteSnapshot(manager, tour, createDto.discountCode ?? null)),
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
        participantMetadata: this.participantMetadataForPersistence(createDto),
        status: placement.status,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
        paidAmount: undefined
      });

      if (placement.consumesAcceptedCapacity) {
        tour.acceptedCount += 1;
        assertTourCapacityInvariant(tour);
        await manager.save(tour);
        await this.syncTourDepartureFromTour(manager, tour);
      }

      const saved = await this.saveRegistrationOrVersionConflict(manager, registration);
      // Mandatory: create immutable price snapshot and stamp snapshotId onto the row.
      const savedWithSnapshot = await this.createAndStampSnapshot(manager, saved);
      this.registrationCreatedTotal += 1;
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await emitRegistrationCreatedEvent({
        manager,
        outboxService: this.outboxService,
        registration: savedWithSnapshot,
        actorId,
        paymentRequired
      });
      return this.toRegistrationResponse(savedWithSnapshot);
    });

    return result;
  }

  /**
   * Builds participant fields for authenticated booking / placement (JWT user profile).
   */
  async resolveAuthenticatedBookingInput(tourId: string): Promise<{
    tourId: string;
    participantFullName: string;
    participantContactPhone: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
  }> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    const userId = this.requestContextService.getUserId();
    if (!tenantId || !userId) {
      throw new ForbiddenException(tenantContextMissingError());
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
      user.email?.split("@")[0] ??
      "Participant";

    return {
      tourId,
      participantFullName,
      participantContactPhone: syntheticBookingContactPhone(userId),
      transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
      entryMode: RegistrationEntryModeDto.WEB,
      telegramUserId: user.telegramUserId ?? undefined,
      telegramUsername: undefined
    };
  }

  /**
   * @deprecated Prefer {@link RegistrationPlacementOrchestrator.createAuthenticatedBooking} for payment-at-booking tours.
   */
  async createBooking(tourId: string): Promise<RegistrationResponseDto> {
    const input = await this.resolveAuthenticatedBookingInput(tourId);
    const createDto = {
      ...input,
      transportMode: input.transportMode as RegistrationTransportModeDto,
      entryMode: input.entryMode as RegistrationEntryModeDto
    } as CreateRegistrationDto;
    return this.createRegistration(createDto);
  }

  async listRegistrationsForTour(tourId: string): Promise<RegistrationResponseDto[]> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
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

  /** Tenant-wide registration rows for leader review (one query + tour titles, no per-tour fan-out). */
  async listLeaderRegistrationIndex(limit = 5_000): Promise<{
    rows: Array<RegistrationResponseDto & { tourTitle: string }>;
    partial: boolean;
  }> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const cappedLimit = Math.min(Math.max(1, limit), 10_000);

    return this.dataSource.transaction(async (manager) => {
      const registrations = await manager.find(RegistrationEntity, {
        where: { tenantId, deletedAt: IsNull() },
        order: { createdAt: "DESC" },
        take: cappedLimit,
      });

      const tourIds = [...new Set(registrations.map((row) => row.tourId))];
      const tours =
        tourIds.length === 0
          ? []
          : await manager.find(TourEntity, {
              where: { id: In(tourIds), tenantId, deletedAt: IsNull() },
              select: ["id", "title"],
            });
      const titleByTourId = new Map(
        tours.map((tour) => [tour.id, tour.title?.trim() || tour.id] as const),
      );

      const rows = registrations.map((row) => ({
        ...this.toRegistrationResponse(row),
        tourTitle: titleByTourId.get(row.tourId) ?? row.tourId,
      }));

      return {
        rows,
        partial: registrations.length >= cappedLimit,
      };
    });
  }

  /** Tenant-scoped registration counts for leader dashboard (one query, no per-tour fan-out). */
  async getLeaderRegistrationStats(): Promise<{
    pending_count: number;
    total_count: number;
  }> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    return this.dataSource.transaction(async (manager) => {
      const total_count = await manager.count(RegistrationEntity, { where: { tenantId } });
      const pending_count = await manager.count(RegistrationEntity, {
        where: { tenantId, status: RegistrationStatus.PENDING },
      });
      return { pending_count, total_count };
    });
  }

  async listWaitlistItemsForTour(tourId: string): Promise<WaitlistItemResponseDto[]> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
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
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    const userId = this.requestContextService.getUserId();
    if (!tenantId || !userId) {
      throw new ForbiddenException(tenantContextMissingError());
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
    const registration = await this.registrationsReadRepository.findOneStandalone(where);
    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    const ctxTenant = this.requestContextService.resolveEffectiveTenantId();
    if (
      ctxTenant &&
      registration.tenantId.trim().toLowerCase() !== ctxTenant.trim().toLowerCase()
    ) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Registration tenant does not match trusted tenant context"
        }
      });
    }
    return this.toRegistrationResponse(registration);
  }

  async updateRegistrationStatus(
    registrationId: string,
    payload: UpdateRegistrationStatusDto
  ): Promise<RegistrationResponseDto> {
    return this.runInIdempotentOrOwnTransaction(async (manager) => {
      const where = await registrationWhereForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        registrationId
      );
      const peek = await this.registrationsReadRepository.findOneInManager(manager, where);
      if (!peek) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }
      const affectsAcceptedCounter =
        isCapacityConsumingRegistrationStatus(peek.status) ||
        isCapacityConsumingRegistrationStatus(payload.targetStatus);

      const lockedTour =
        peek.status !== payload.targetStatus && affectsAcceptedCounter
          ? await this.requireTourInTenantForUpdate(manager, peek.tourId, peek.tenantId)
          : null;

      const registration = await lockRegistrationForFinancialMutation(manager, where);
      this.assertExpectedRegistrationRowVersion(registration, payload.expected_row_version);
      validateStatusTransition(
        registration.status,
        payload.targetStatus,
        registration.paymentStatus
      );

      const previousStatus = registration.status;

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
        await this.syncTourDepartureFromTour(manager, lockedTour);
      }
      const saved = await this.saveRegistrationOrVersionConflict(manager, registration);

      if (
        isCapacityConsumingRegistrationStatus(previousStatus) &&
        !isCapacityConsumingRegistrationStatus(payload.targetStatus)
      ) {
        await this.promoteNextWaitlistItem(manager, saved, lockedTour);
      }

      if (previousStatus !== payload.targetStatus) {
        const eventName = registrationStatusToOutboxEventType(payload.targetStatus);
        const actorId = this.requestContextService.getUserId() ?? "unknown";
        await emitRegistrationStatusChangedEvent({
          manager,
          outboxService: this.outboxService,
          registration: saved,
          actorId,
          previousStatus,
          newStatus: payload.targetStatus,
          eventType: eventName
        });
      }

      return this.toRegistrationResponse(saved);
    });
  }

  async updateRegistrationPayment(
    registrationId: string,
    payload: UpdateRegistrationPaymentDto,
    idempotencyKey: string
  ): Promise<RegistrationResponseDto> {
    const idempotencyKeyTrimmed = assertFinancialIdempotencyKey(idempotencyKey);
    return this.runInIdempotentOrOwnTransaction(async (manager) => {
      const where = await registrationWhereForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        registrationId
      );
      const peek = await this.registrationsReadRepository.findOneInManager(manager, where);
      if (!peek) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }
      await this.requireTourInTenantForUpdate(manager, peek.tourId, peek.tenantId);
      const registration = await lockRegistrationForFinancialMutation(manager, where);
      this.assertExpectedRegistrationRowVersion(registration, payload.expected_row_version);
      validatePaymentTransition(
        registration.status,
        registration.paymentStatus,
        payload.paymentStatus
      );
      validatePaymentAmountConsistency(payload.paymentStatus, payload.paidAmount);

      await this.bookingLedgerAuthority.applyLeaderRegistrationPaymentMutation(
        manager,
        registration,
        payload,
        idempotencyKeyTrimmed
      );
      const saved = await this.saveRegistrationOrVersionConflict(manager, registration);
      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await emitRegistrationPaymentUpdatedEvent({
        manager,
        outboxService: this.outboxService,
        registration: saved,
        actorId
      });
      return this.toRegistrationResponse(saved);
    });
  }

  async updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>
  ): Promise<RegistrationEntity> {
    const trustedTenantId = this.requestContextService.resolveEffectiveTenantId();
    const actorRole = this.requestContextService.getRole();
    if (!actorHasTrustedTenantOrPlatformAdminBypass(actorRole, trustedTenantId)) {
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
      const registration = await this.registrationsReadRepository.findOneInManager(manager, registrationScope);
      if (!registration) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }

      if (
        !registrationTenantMatchesActorScope(actorRole, trustedTenantId, registration.tenantId)
      ) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope"
          }
        });
      }

      validatePaymentTransition(
        registration.status,
        registration.paymentStatus,
        newPaymentStatus
      );

      registration.paymentStatus = newPaymentStatus;
      if (metadata !== undefined) {
        registration.paymentMetadata = metadata;
      }

      return this.saveRegistrationOrVersionConflict(manager, registration);
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
      assertJwtTenantMatchesTourForAuthenticatedMutation({
        role: this.requestContextService.getRole(),
        jwtTenantId: this.requestContextService.resolveEffectiveTenantId(),
        tourTenantId: tour.tenantId
      });

      const tenantId = tour.tenantId;
      const scopedPayload = {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone,
        telegramUserId: createDto.telegramUserId
      };

      await this.ensureNoActiveRegistrationDuplicate(manager, scopedPayload);
      const existingWaitlistItems = await manager.find(WaitlistItemEntity, {
        where: {
          tenantId,
          tourId: createDto.tourId,
          participantContactPhone: createDto.participantContactPhone
        }
      });
      assertNoDuplicateWaitlist(existingWaitlistItems);
      assertTourAllowsWaitlist(tour);
      await this.ensureNoWaitingWaitlistDuplicate(manager, {
        tenantId,
        tourId: createDto.tourId,
        participantContactPhone: createDto.participantContactPhone
      });

      const waitlistItem = manager.create(WaitlistItemEntity, {
        tenantId,
        tourId: createDto.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
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
      assertTourIsOpenForRegistration(tour);
      assertWaitlistPromotionAllowed(tour);
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
        tourDepartureId: bookableTourDepartureId(tour),
        ...(await this.registrationQuoteApplication.buildQuoteSnapshot(manager, tour, null)),
        participantFullName: waitlistItem.participantFullName,
        participantContactPhone: waitlistItem.participantContactPhone,
        transportMode: waitlistItem.transportMode,
        entryMode: waitlistItem.entryMode,
        status: RegistrationStatus.ACCEPTED,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID
      });
      const savedRegistration = await this.saveRegistrationOrVersionConflict(
        manager,
        convertedRegistration
      );
      // Mandatory: create immutable price snapshot and stamp snapshotId onto the row.
      const savedRegistrationWithSnapshot = await this.createAndStampSnapshot(manager, savedRegistration);
      waitlistItem.status = WaitlistItemStatus.CONVERTED;
      waitlistItem.promotedRegistrationId = savedRegistrationWithSnapshot.id;
      waitlistItem.conversionReason = payload.conversionReason;
      tour.acceptedCount += 1;
      assertTourCapacityInvariant(tour);
      await manager.save(tour);
      await this.syncTourDepartureFromTour(manager, tour);
      const savedWaitlist = await manager.save(waitlistItem);

      const actorId = this.requestContextService.getUserId() ?? "unknown";
      await emitWaitlistConvertedAndAcceptedEvents({
        manager,
        outboxService: this.outboxService,
        waitlistItem: savedWaitlist,
        promotedRegistration: savedRegistrationWithSnapshot,
        actorId,
        reason: payload.conversionReason ?? undefined,
        source: "manual_waitlist_conversion"
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
      await emitWaitlistCancelledEvent({
        manager,
        outboxService: this.outboxService,
        waitlistItem: saved,
        actorId
      });
      return this.toWaitlistResponse(saved);
    });
  }

  private tourRequiresPayment(costContext: TourEntity["costContext"]): boolean {
    if (costContext == null || typeof costContext !== "object") {
      return false;
    }
    const ctx = costContext as { requiresPayment?: boolean; requires_payment?: boolean };
    return Boolean(ctx.requiresPayment ?? ctx.requires_payment);
  }

  private async loadTourTripDetailsForPlacement(
    manager: EntityManager,
    tourId: string,
  ): Promise<Record<string, unknown> | null> {
    const detailsRow = await manager.findOne(TourDetails, {
      where: { tourId },
      select: { tripDetails: true },
    });
    const raw = detailsRow?.tripDetails;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    return raw as Record<string, unknown>;
  }

  private participantMetadataForPersistence(
    dto: Pick<
      CreateRegistrationDto,
      | "participantMetadata"
      | "transportMode"
      | "isDriver"
      | "plateNumber"
      | "shareFuelCost"
      | "selectedServiceIds"
    >,
  ): Record<string, unknown> | undefined {
    const base = participantMetadataRecordForPersistence({
      participantMetadata: dto.participantMetadata,
      transportMode: dto.transportMode,
      isDriver: dto.isDriver,
      plateNumber: dto.plateNumber,
      shareFuelCost: dto.shareFuelCost,
    });

    const selectedServiceIds = this.normalizeSelectedServiceIds(dto.selectedServiceIds);
    if (selectedServiceIds == null) {
      return base;
    }

    return {
      ...(base ?? {}),
      selectedServiceIds,
    };
  }

  private normalizeSelectedServiceIds(raw: string[] | undefined): string[] | undefined {
    if (raw == null || raw.length === 0) {
      return undefined;
    }
    const ids = raw.map((id) => id.trim()).filter((id) => id.length > 0);
    return ids.length > 0 ? ids : undefined;
  }

  private assertPrivateCarRegistrationAllowed(
    tour: TourEntity,
    tripDetails: Record<string, unknown> | null,
    transportMode: RegistrationTransportModeDto,
  ): void {
    if (transportMode !== RegistrationTransportModeDto.SELF_VEHICLE) {
      return;
    }
    const allowPrivateCar = resolveTourAllowPrivateCar({
      transportModes: tour.transportModes,
      details: tripDetails != null ? { tripDetails } : undefined,
    });
    if (!allowPrivateCar) {
      throw new BadRequestException({
        error: {
          code: "REGISTRATION_PRIVATE_CAR_NOT_ALLOWED",
          message: "Private car registration is not allowed for this tour",
        },
      });
    }
  }

  /**
   * Decides first-class registration status and whether this row consumes `tours.accepted_count`.
   * Payment-required tours start `Pending` until host acceptance (Phase 16.3). Paid tours never
   * auto-accept via `autoAcceptRegistrations` alone (PLACE-02). Peak-Experience (Phase 16.9) may
   * auto-accept when `requirements.minRequiredPeaks` is met by traveler `userPastPeaksCount`.
   */
  private resolveInitialRegistrationPlacement(
    tour: TourEntity,
    participantMetadata: ParticipantMetadataDto | undefined,
    tripDetails: Record<string, unknown> | null,
  ): {
    status: RegistrationStatus;
    consumesAcceptedCapacity: boolean;
  } {
    if (
      qualifiesForPeakExperienceAutoApproval({
        tripDetails,
        participantMetadata,
      })
    ) {
      return { status: RegistrationStatus.ACCEPTED, consumesAcceptedCapacity: true };
    }

    const requiresPayment = this.tourRequiresPayment(tour.costContext);
    if (tour.autoAcceptRegistrations === true && !requiresPayment) {
      return { status: RegistrationStatus.ACCEPTED, consumesAcceptedCapacity: true };
    }
    return { status: RegistrationStatus.PENDING, consumesAcceptedCapacity: false };
  }

  /**
   * When the tour's trip details set `participation.registrationNationalIdRequired`,
   * branch logic: validate against users.national_id if bookingTarget === 'self',
   * otherwise validate the DTO’s participantNationalId if bookingTarget === 'guest'.
   */
  private async assertTourNationalIdRegistrationPolicyOrThrow(
    manager: EntityManager,
    tourId: string,
    payload: { bookingTarget?: RegistrationBookingTargetDto; participantNationalId?: string }
  ): Promise<void> {
    const detailsRow = await manager.findOne(TourDetails, {
      where: { tourId },
      select: { tripDetails: true }
    });
    const participation = detailsRow?.tripDetails?.participation as
      | { registrationNationalIdRequired?: boolean }
      | undefined;
    if (participation?.registrationNationalIdRequired !== true) {
      return;
    }

    const bookingTarget = payload.bookingTarget ?? RegistrationBookingTargetDto.SELF;

    if (bookingTarget === RegistrationBookingTargetDto.GUEST) {
      const guestNationalId = payload.participantNationalId?.trim();
      if (!guestNationalId) {
        throw new BadRequestException({
          error: {
            code: "REGISTRATION_GUEST_NATIONAL_ID_REQUIRED",
            message: "Guest national ID is required for this tour."
          }
        });
      }
      if (!validateIranNationalIdChecksum(guestNationalId)) {
        throw new BadRequestException({
          error: {
            code: "REGISTRATION_GUEST_NATIONAL_ID_INVALID",
            message: "Provided guest national ID is mathematically invalid."
          }
        });
      }
      return;
    }

    const userId = this.requestContextService.getUserId()?.trim();
    if (!userId) {
      throw new BadRequestException({
        error: {
          code: "REGISTRATION_AUTH_REQUIRED",
          message:
            "This tour requires a national ID on your profile; sign in with your workspace session (browser cookies or Bearer token) before registering."
        }
      });
    }

    const profileUser = await manager.findOne(UserEntity, {
      where: { id: userId, deletedAt: IsNull() },
      select: { nationalId: true }
    });
    const nationalId = profileUser?.nationalId?.trim();
    if (!nationalId) {
      throw new BadRequestException({
        error: {
          code: "PROFILE_NATIONAL_ID_REQUIRED",
          message: "Add your national ID in profile settings before registering for this tour."
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
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    if (tour.tenantId !== tenantId) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
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
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    return tour;
  }

  /** Dual-write: mirror capacity/sold onto `tour_departures` when that row exists (foundation migration). */
  private async syncTourDepartureFromTour(
    manager: EntityManager,
    tour: TourEntity
  ): Promise<void> {
    await manager.update(
      TourDepartureEntity,
      { id: tour.id },
      {
        soldCount: tour.acceptedCount,
        capacityTotal: tour.totalCapacity,
        lifecycleStatus: tour.lifecycleStatus
      }
    );
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
    const duplicateByPhone = await this.registrationsReadRepository.findOneInManager(manager, {
      tenantId: payload.tenantId,
      tourId: payload.tourId,
      participantContactPhone: payload.participantContactPhone,
      status: In([
        RegistrationStatus.PENDING,
        RegistrationStatus.ACCEPTED,
        RegistrationStatus.ACCEPTED_PAID
      ])
    });

    const duplicateByTelegram =
      payload.telegramUserId && payload.telegramUserId.trim() !== ""
        ? await this.registrationsReadRepository.findOneInManager(manager, {
            tenantId: payload.tenantId,
            tourId: payload.tourId,
            telegramUserId: payload.telegramUserId,
            status: In([
              RegistrationStatus.PENDING,
              RegistrationStatus.ACCEPTED,
              RegistrationStatus.ACCEPTED_PAID
            ])
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
      throw new NotFoundException(tenantScopedResourceNotFoundError());
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

  private assertExpectedRegistrationRowVersion(
    registration: RegistrationEntity,
    expectedRowVersion: number
  ): void {
    if (Number(registration.rowVersion) !== Number(expectedRowVersion)) {
      throw new ConflictException({
        error: {
          code: "REGISTRATION_ROW_VERSION_CONFLICT",
          message: "Booking changed concurrently — reload the registration, then try again."
        }
      });
    }
  }

  private async restoreImmutableRegistrationQuoteColumns(
    manager: EntityManager,
    registration: RegistrationEntity
  ): Promise<void> {
    if (!registration.id) {
      return;
    }
    const hasSnap = await manager.exists(BookingPriceSnapshotEntity, {
      where: { bookingId: registration.id, tenantId: registration.tenantId }
    });
    if (!hasSnap) {
      return;
    }
    const persisted = await manager.findOne(RegistrationEntity, {
      where: { id: registration.id, tenantId: registration.tenantId },
      select: {
        id: true,
        tenantId: true,
        quotedListPriceMinor: true,
        quotedCurrencyCode: true,
        quotedTotalMinor: true,
        quotedPricingVersion: true,
        quotedLineItemsJson: true
      }
    });
    if (!persisted) {
      return;
    }
    registration.quotedListPriceMinor = persisted.quotedListPriceMinor;
    registration.quotedCurrencyCode = persisted.quotedCurrencyCode;
    registration.quotedTotalMinor = persisted.quotedTotalMinor;
    registration.quotedPricingVersion = persisted.quotedPricingVersion;
    registration.quotedLineItemsJson = persisted.quotedLineItemsJson;
  }

  private async saveRegistrationOrVersionConflict(
    manager: EntityManager,
    registration: RegistrationEntity
  ): Promise<RegistrationEntity> {
    const existedBefore =
      Boolean(registration.id) &&
      (await manager.exists(RegistrationEntity, { where: { id: registration.id } }));
    try {
      if (existedBefore && registration.id) {
        await this.restoreImmutableRegistrationQuoteColumns(manager, registration);
      }
      const saved = await manager.save(registration);
      if (!existedBefore) {
        await emitBookingCreatedOutboxEvent({
          manager,
          outboxService: this.outboxService,
          tenantId: saved.tenantId,
          registrationId: saved.id,
          tourId: saved.tourId,
          correlationId: this.requestContextService.getRequestId()
        });
      }
      if (saved.id) {
        await this.ensureBookingPriceSnapshotLockedAndEmit(manager, saved);
      }
      return saved;
    } catch (err: unknown) {
      if (isOptimisticLockVersionMismatchError(err)) {
        throw new ConflictException({
          error: {
            code: "REGISTRATION_ROW_VERSION_CONFLICT",
            message: "Booking changed concurrently — reload the registration, then try again."
          }
        });
      }
      throw err;
    }
  }

  private async ensureBookingPriceSnapshotLockedAndEmit(
    manager: EntityManager,
    saved: RegistrationEntity
  ): Promise<void> {
    if (!saved.id) {
      return;
    }
    // Fast-path: new checkout flow already stamped snapshot_id via createAndStampSnapshot().
    // For existing legacy registrations (snapshotId is null), fall through to the DB check below.
    if (saved.snapshotId) {
      return;
    }
    if (
      await manager.exists(BookingPriceSnapshotEntity, {
        where: { bookingId: saved.id, tenantId: saved.tenantId }
      })
    ) {
      return;
    }
    const hasPending = await manager.exists(PaymentEntity, {
      where: {
        registrationId: saved.id,
        tenantId: saved.tenantId,
        status: PaymentStatus.PENDING
      }
    });
    const hasPaid = await manager.exists(PaymentEntity, {
      where: {
        registrationId: saved.id,
        tenantId: saved.tenantId,
        status: PaymentStatus.PAID
      }
    });
    const listMinor = saved.quotedListPriceMinor ?? saved.quotedTotalMinor;
    const quoteComplete =
      saved.quotedTotalMinor != null &&
      saved.quotedPricingVersion != null &&
      saved.quotedCurrencyCode != null &&
      listMinor != null;

    if (!quoteComplete) {
      if (hasPending || hasPaid) {
        throw new ConflictException({
          error: {
            code: "BOOKING_PRICING_SNAPSHOT_INCOMPLETE_WITH_PAYMENT",
            message:
              "Payment rows exist for this booking but the persisted quote columns are incomplete — cannot build or verify an immutable snapshot."
          }
        });
      }
      return;
    }

    if (hasPending || hasPaid) {
      throw new ConflictException({
        error: {
          code: "BOOKING_PRICE_SNAPSHOT_MISSING_WITH_PAYMENT",
          message:
            "Payment activity exists for this booking without an immutable booking price snapshot — data invariant violated."
        }
      });
    }

    const phaseBefore = bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: false,
      hasPendingPayment: hasPending,
      hasCapturedPayment: hasPaid,
      registrationFinanciallyConfirmed: saved.status === RegistrationStatus.ACCEPTED_PAID
    });
    assertSingleStepBookingFinalizationAdvance(
      phaseBefore,
      BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
      "lockBookingPriceSnapshot"
    );
    const row = await createPricingSnapshot(manager, {
      tenantId: saved.tenantId,
      bookingId: saved.id,
      listPriceMinor: String(listMinor),
      currency: String(saved.quotedCurrencyCode),
      pricingRuleVersion: String(saved.quotedPricingVersion),
      computedTotalMinor: String(saved.quotedTotalMinor)
    });
    await emitBookingFinalizationPipelineEvent({
      manager,
      outboxService: this.outboxService,
      tenantId: saved.tenantId,
      registrationId: saved.id,
      phase: BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
      metadata: { snapshotId: row.snapshotId }
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
      bookingTarget: entity.bookingTarget,
      participantNationalId: entity.participantNationalId,
      transportMode: entity.transportMode,
      entryMode: entity.entryMode,
      telegramUserId: entity.telegramUserId,
      telegramUsername: entity.telegramUsername,
      vehicleSeatCapacity: entity.vehicleSeatCapacity,
      participantNote: entity.participantNote,
      participantMetadata: entity.participantMetadata ?? null,
      status: entity.status,
      rowVersion: entity.rowVersion,
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
              method:
                typeof entity.paymentMetadata.method === "string"
                  ? entity.paymentMetadata.method
                  : "Online",
              provider: entity.paymentMetadata.provider,
              providerPaymentId:
                typeof entity.paymentMetadata.providerPaymentId === "string"
                  ? entity.paymentMetadata.providerPaymentId
                  : null
            }
          : undefined,
      lockedPricing:
        entity.quotedTotalMinor != null &&
        entity.quotedCurrencyCode != null &&
        entity.quotedPricingVersion != null
          ? {
              totalMinor: String(entity.quotedTotalMinor),
              currency: String(entity.quotedCurrencyCode).trim().toUpperCase(),
              pricingRuleVersion: String(entity.quotedPricingVersion),
              listPriceMinor:
                entity.quotedListPriceMinor != null ? String(entity.quotedListPriceMinor) : null
            }
          : null,
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

  private async ensureCapacityForAcceptance(
    manager: EntityManager,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus,
    lockedTour?: TourEntity | null
  ): Promise<void> {
    if (
      isCapacityConsumingRegistrationStatus(registration.status) ||
      !isCapacityConsumingRegistrationStatus(targetStatus)
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
    const wasAccepted = isCapacityConsumingRegistrationStatus(previousStatus);
    const willBeAccepted = isCapacityConsumingRegistrationStatus(targetStatus);
    if (wasAccepted === willBeAccepted) {
      return;
    }

    if (willBeAccepted) {
      tour.acceptedCount += 1;
      assertTourCapacityInvariant(tour);
      return;
    }

    tour.acceptedCount = Math.max(0, tour.acceptedCount - 1);
    assertTourCapacityInvariant(tour);
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
      tourDepartureId: bookableTourDepartureId(lockedTour),
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

  /**
   * FIFO waitlist → registration promotion used when the payment processor frees capacity.
   * Must match manual conversion: {@link RegistrationQuoteApplicationService} quote + append-only snapshot.
   */
  async promoteNextWaitlistItemForPaymentFlow(
    manager: EntityManager,
    releasedRegistration: RegistrationEntity,
    lockedTour: TourEntity | null
  ): Promise<boolean> {
    return this.promoteNextWaitlistItem(manager, releasedRegistration, lockedTour);
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
    assertTourIsOpenForRegistration(tour);
    assertWaitlistPromotionAllowed(tour);
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
      tourDepartureId: bookableTourDepartureId(tour),
      ...(await this.registrationQuoteApplication.buildQuoteSnapshot(manager, tour, null)),
      participantFullName: waitlistItem.participantFullName,
      participantContactPhone: waitlistItem.participantContactPhone,
      transportMode: waitlistItem.transportMode,
      entryMode: waitlistItem.entryMode,
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      paidAmount: undefined
    });

    const savedPromotedRegistration = await this.saveRegistrationOrVersionConflict(
      manager,
      promotedRegistration
    );
    // Mandatory: create immutable price snapshot and stamp snapshotId onto the row.
    const savedPromotedWithSnapshot = await this.createAndStampSnapshot(manager, savedPromotedRegistration);

    waitlistItem.status = WaitlistItemStatus.CONVERTED;
    waitlistItem.promotedRegistrationId = savedPromotedWithSnapshot.id;
    await manager.save(waitlistItem);
    tour.acceptedCount += 1;
    assertTourCapacityInvariant(tour);
    await manager.save(tour);
    await this.syncTourDepartureFromTour(manager, tour);

    const actorId = this.requestContextService.getUserId() ?? "system";
    await emitWaitlistConvertedAndAcceptedEvents({
      manager,
      outboxService: this.outboxService,
      waitlistItem,
      promotedRegistration: savedPromotedWithSnapshot,
      actorId,
      source: "waitlist_promotion"
    });
    return true;
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
    validateStatusTransition(
      previousStatus,
      targetStatus,
      registration.paymentStatus
    );
    const affectsAcceptedCounter =
      isCapacityConsumingRegistrationStatus(previousStatus) ||
      isCapacityConsumingRegistrationStatus(targetStatus);
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
      await this.syncTourDepartureFromTour(manager, lockedTour);
    }
    const saved = await this.saveRegistrationOrVersionConflict(manager, registration);
    if (
      isCapacityConsumingRegistrationStatus(previousStatus) &&
      !isCapacityConsumingRegistrationStatus(targetStatus)
    ) {
      await this.promoteNextWaitlistItem(manager, saved, lockedTour);
    }
    await emitRegistrationStatusChangedEvent({
      manager,
      outboxService: this.outboxService,
      registration: saved,
      actorId,
      previousStatus,
      newStatus: targetStatus,
      eventType: registrationStatusToOutboxEventType(targetStatus),
      source: "payment_flow"
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
    bookingTarget?: RegistrationBookingTargetDto;
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
    participantMetadata?: ParticipantMetadataDto;
    selectedServiceIds?: string[];
    discountCode?: string | null;
    createPaymentIntent?: (
      _manager: EntityManager,
      _registration: RegistrationEntity
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
      assertTourIsOpenForRegistration(tour);
      await this.assertTourNationalIdRegistrationPolicyOrThrow(manager, input.tourId, input);
      const existingRegistrations = await manager.find(RegistrationEntity, {
        where: {
          tenantId,
          tourId: input.tourId,
          participantContactPhone: input.participantContactPhone
        }
      });
      assertUserNotAlreadyRegistered(tour, existingRegistrations);
      await this.ensureNoActiveRegistrationDuplicate(manager, scopedInput);
      if (tour.acceptedCount >= tour.totalCapacity) {
        assertTourAllowsWaitlist(tour);
        const existingWaitlistItems = await manager.find(WaitlistItemEntity, {
          where: {
            tenantId,
            tourId: input.tourId,
            participantContactPhone: input.participantContactPhone
          }
        });
        assertNoDuplicateWaitlist(existingWaitlistItems);
        await this.ensureNoWaitingWaitlistDuplicate(manager, scopedInput);
        const waitlist = manager.create(WaitlistItemEntity, {
          tenantId,
          tourId: input.tourId,
          tourDepartureId: bookableTourDepartureId(tour),
          participantFullName: input.participantFullName,
          participantContactPhone: input.participantContactPhone,
          transportMode: input.transportMode,
          entryMode: input.entryMode,
          status: WaitlistItemStatus.WAITING
        });
        const savedWaitlist = await manager.save(waitlist);
        this.registrationWaitlistedTotal += 1;
        await emitRegistrationWaitlistedEvent({
          manager,
          outboxService: this.outboxService,
          waitlistItem: savedWaitlist,
          actorId: this.requestContextService.getUserId() ?? "public"
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

      const tripDetails = await this.loadTourTripDetailsForPlacement(manager, tour.id);
      this.assertPrivateCarRegistrationAllowed(
        tour,
        tripDetails,
        input.transportMode as RegistrationTransportModeDto,
      );
      assertTravelerMeetsPeakRequirementOrThrow(tripDetails, input.participantMetadata);
      const placement = this.resolveInitialRegistrationPlacement(
        tour,
        input.participantMetadata,
        tripDetails,
      );
      const requiresPayment =
        typeof tour.costContext?.requiresPayment === "boolean"
          ? Boolean(tour.costContext.requiresPayment)
          : false;

      const registration = manager.create(RegistrationEntity, {
        tenantId,
        tourId: input.tourId,
        tourDepartureId: bookableTourDepartureId(tour),
        ...(await this.registrationQuoteApplication.buildQuoteSnapshot(manager, tour, input.discountCode ?? null)),
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
        participantMetadata: this.participantMetadataForPersistence({
          participantMetadata: input.participantMetadata,
          transportMode: input.transportMode as RegistrationTransportModeDto,
          isDriver: input.isDriver,
          plateNumber: input.plateNumber,
          shareFuelCost: input.shareFuelCost,
          selectedServiceIds: input.selectedServiceIds,
        }),
        status: placement.status,
        paymentStatus: RegistrationPaymentStatus.NOT_PAID,
        paidAmount: undefined
      });
      if (placement.consumesAcceptedCapacity) {
        tour.acceptedCount += 1;
        assertTourCapacityInvariant(tour);
        await manager.save(tour);
        await this.syncTourDepartureFromTour(manager, tour);
      }
      const saved = await this.saveRegistrationOrVersionConflict(manager, registration);
      // Mandatory: create immutable price snapshot and stamp snapshotId onto the row.
      const savedWithSnapshot = await this.createAndStampSnapshot(manager, saved);
      this.registrationCreatedTotal += 1;
      const actorId = this.requestContextService.getUserId() ?? "public";
      if (placement.status === RegistrationStatus.ACCEPTED) {
        await emitPublicRegistrationAcceptedEvent({
          manager,
          outboxService: this.outboxService,
          registration: savedWithSnapshot,
          actorId
        });
      } else {
        await emitRegistrationCreatedEvent({
          manager,
          outboxService: this.outboxService,
          registration: savedWithSnapshot,
          actorId,
          paymentRequired: requiresPayment
        });
      }
      let paymentIntent: PaymentResponseDto | null = null;
      if (requiresPayment && input.createPaymentIntent) {
        paymentIntent = await input.createPaymentIntent(manager, savedWithSnapshot);
      }
      return {
        type: "registration" as const,
        registration: this.toRegistrationResponse(savedWithSnapshot),
        requiresPayment,
        paymentIntent
      };
    };
    if (store) {
      return requestContextStorage.run(store, () => this.runInIdempotentOrOwnTransaction(run));
    }
    return this.runInIdempotentOrOwnTransaction(run);
  }
}
