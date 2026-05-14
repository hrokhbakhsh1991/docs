import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, IsNull, Repository, type FindOptionsWhere } from "typeorm";
import { TenantContextMissingError } from "../../common/errors/tenant-context-missing.error";
import {
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import {
  findPaymentScopedForActor,
  registrationWhereForActor
} from "../../common/security/ownership-scope";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { OutboxService } from "../outbox/outbox.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserEntity } from "../identity/entities/user.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../registrations/registration.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { WaitlistItemEntity, WaitlistItemStatus } from "../registrations/waitlist-item.entity";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { PaymentEntity, PaymentStatus } from "./entities/payment.entity";
import { emitRegistrationStatusChangedEvent, emitWaitlistConvertedAndAcceptedEvents } from "../registrations/registrations-effects";
import { validateStatusTransition } from "../registrations/registrations-policy";

const PAYMENT_TIMEOUT_MINUTES = 15;
const PAYMENT_TIMEOUT_BATCH = 100;

export type PaymentRuntimeMetrics = {
  paymentIntentsCreatedTotal: number;
  timedOutPayments: number;
  failedPayments: number;
  autoRecoveredCapacityCount: number;
  lastTimeoutRunAt: string | null;
  webhookReceivedTotal: number;
  webhookProcessedTotal: number;
  webhookFailedTotal: number;
  webhookUnknownPaymentTotal: number;
  webhookDedupedTotal: number;
};

export type WebhookProcessResult = {
  processed: boolean;
  deduplicated: boolean;
  requestId: string;
  providerPaymentId: string;
  providerEventId: string | null;
  provider: string | null;
  tenantId: string | null;
  status: PaymentStatus;
};

const WEBHOOK_TENANT_BINDING_FAILED = "WEBHOOK_TENANT_BINDING_FAILED";

@Injectable()
export class PaymentsService {
  private timedOutPayments = 0;
  private failedPayments = 0;
  private autoRecoveredCapacityCount = 0;
  private lastTimeoutRunAt: string | null = null;
  private paymentIntentsCreatedTotal = 0;
  private webhookReceivedTotal = 0;
  private webhookProcessedTotal = 0;
  private webhookFailedTotal = 0;
  private webhookUnknownPaymentTotal = 0;
  private webhookDedupedTotal = 0;

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
    private readonly requestContextService: RequestContextService,
    private readonly tenantDbContext: TenantDbContextService,
    private readonly idempotencyService: IdempotencyService,
    private readonly outboxService: OutboxService
  ) {}

  getMetricsSnapshot(): PaymentRuntimeMetrics {
    return {
      paymentIntentsCreatedTotal: this.paymentIntentsCreatedTotal,
      timedOutPayments: this.timedOutPayments,
      failedPayments: this.failedPayments,
      autoRecoveredCapacityCount: this.autoRecoveredCapacityCount,
      lastTimeoutRunAt: this.lastTimeoutRunAt,
      webhookReceivedTotal: this.webhookReceivedTotal,
      webhookProcessedTotal: this.webhookProcessedTotal,
      webhookFailedTotal: this.webhookFailedTotal,
      webhookUnknownPaymentTotal: this.webhookUnknownPaymentTotal,
      webhookDedupedTotal: this.webhookDedupedTotal
    };
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentResponseDto> {
    return this.dataSource.transaction((manager) =>
      this.createPaymentIntentWithManager(manager, dto)
    );
  }

  async createPaymentIntentWithManager(
    manager: DataSource["manager"],
    dto: CreatePaymentIntentDto
  ): Promise<PaymentResponseDto> {
    const trustedTenantId = this.requestContextService.resolveEffectiveTenantId();
    const actorRoleRaw = this.requestContextService.getRole();
    const role = (actorRoleRaw ?? "").trim().toLowerCase();
    const actorUserIdRaw = this.requestContextService.getUserId();
    if (!trustedTenantId && role !== "admin") {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const isPublicTenantBootstrapActor =
      typeof trustedTenantId === "string" &&
      trustedTenantId.trim() !== "" &&
      (!actorUserIdRaw || actorUserIdRaw.trim() === "") &&
      (!actorRoleRaw || actorRoleRaw.trim() === "");

    let registrationScope:
      | FindOptionsWhere<RegistrationEntity>
      | FindOptionsWhere<RegistrationEntity>[];

    if (isPublicTenantBootstrapActor) {
      registrationScope = {
        id: dto.registrationId,
        tenantId: trustedTenantId,
        deletedAt: IsNull()
      };
    } else {
      registrationScope = await registrationWhereForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        dto.registrationId
      );
    }

    const registration = await manager.findOne(RegistrationEntity, {
      where: registrationScope
    });
    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Registration not found"
        }
      });
    }
    const isAdmin = role === "admin";
    if (
      !isAdmin &&
      trustedTenantId &&
      registration.tenantId !== trustedTenantId
    ) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Registration not found"
        }
      });
    }

    const existingPending = await manager.findOne(PaymentEntity, {
      where: {
        registrationId: registration.id,
        tenantId: registration.tenantId,
        status: PaymentStatus.PENDING
      }
    });
    if (existingPending) {
      throw new ConflictException({
        error: {
          code: "PAYMENT_PENDING_EXISTS",
          message: "Pending payment already exists for registration"
        }
      });
    }
    const existingPaid = await manager.findOne(PaymentEntity, {
      where: {
        registrationId: registration.id,
        tenantId: registration.tenantId,
        status: PaymentStatus.PAID
      }
    });
    if (existingPaid) {
      throw new ConflictException({
        error: {
          code: "PAYMENT_STATUS_TRANSITION_INVALID",
          message: "Payment already completed for registration"
        }
      });
    }

    const payment = manager.create(PaymentEntity, {
      tenantId: registration.tenantId,
      registrationId: registration.id,
      amount: dto.amount.toString(),
      currency: dto.currency,
      provider: dto.paymentProvider,
      providerPaymentId: dto.providerPaymentId ?? null,
      status: PaymentStatus.PENDING,
      paidAt: null,
      failedAt: null,
      refundedAt: null
    });
    const saved = await manager.save(payment);
    this.paymentIntentsCreatedTotal += 1;
    await this.outboxService.addEvent(manager, {
      tenantId: registration.tenantId,
      aggregateType: "Payment",
      aggregateId: saved.id,
      eventType: "payment.created",
      payload: {
        entityType: "payment",
        entityId: saved.id,
        registrationId: saved.registrationId,
        status: saved.status,
        timestamp: new Date().toISOString()
      }
    });

    return this.toResponse(saved);
  }

  async listPayments(tenantId: string): Promise<PaymentResponseDto[]> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      throw new TenantContextMissingError(
        "Tenant context is missing tenant_id for admin payment listing"
      );
    }
    const rows = await this.paymentRepository.find({
      where: { tenantId: normalizedTenantId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: 100
    });
    return rows.map((row) => this.toResponse(row));
  }

  async getLatestPaymentForRegistration(
    registrationId: string
  ): Promise<PaymentResponseDto | null> {
    const registration = await this.requireRegistrationOwnedByActor(registrationId);
    const row = await this.paymentRepository.findOne({
      where: {
        registrationId,
        tenantId: registration.tenantId,
        deletedAt: IsNull()
      },
      order: { createdAt: "DESC" }
    });
    if (!row) {
      return null;
    }
    return this.toResponse(row);
  }

  /** Ensures caller may access this registration ID (tenant + member ownership). Returns the row when allowed. */
  private async requireRegistrationOwnedByActor(
    registrationId: string,
    manager?: EntityManager
  ): Promise<RegistrationEntity> {
    const mgr = manager ?? this.paymentRepository.manager;
    const regWhere = await registrationWhereForActor(
      mgr,
      this.userRepository,
      this.requestContextService,
      registrationId
    );
    const registration = await mgr.findOne(RegistrationEntity, {
      where: regWhere
    });
    if (!registration) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return registration;
  }

  async createPaymentIntentForRegistration(input: {
    registrationId: string;
    amount: number;
    currency: string;
    paymentProvider: string;
    providerPaymentId?: string;
  }): Promise<PaymentResponseDto> {
    return this.createPaymentIntent({
      registrationId: input.registrationId,
      amount: input.amount,
      currency: input.currency,
      paymentProvider: input.paymentProvider,
      providerPaymentId: input.providerPaymentId
    });
  }

  async getPaymentById(id: string): Promise<PaymentResponseDto> {
    const row = await findPaymentScopedForActor(
      this.paymentRepository.manager,
      this.userRepository,
      this.requestContextService,
      id
    );
    return this.toResponse(row);
  }

  async processWebhook(payload: PaymentWebhookDto): Promise<WebhookProcessResult> {
    this.webhookReceivedTotal += 1;
    const requestId = payload.providerEventId ?? `legacy-${payload.providerPaymentId}-${payload.status}`;
    try {
      const payloadTenantId = payload.tenant_id.trim().toLowerCase();
      // Internal webhook bypasses TenantMiddleware; RLS still needs app.tenant_id before any query.
      // Scope is the validated body tenant combined with providerPaymentId in the lookup below
      // (no widening: wrong tenant_id yields no payment row).
      this.requestContextService.setTenantId(payloadTenantId);
      const payment = await this.paymentRepository.findOne({
        where: {
          providerPaymentId: payload.providerPaymentId,
          tenantId: payloadTenantId
        }
      });
      if (!payment) {
        this.webhookUnknownPaymentTotal += 1;
        return {
          processed: false,
          deduplicated: false,
          requestId,
          providerPaymentId: payload.providerPaymentId,
          providerEventId: payload.providerEventId ?? null,
          provider: null,
          tenantId: payloadTenantId,
          status: payload.status
        };
      }
      const paymentTenantId = payment.tenantId.trim().toLowerCase();
      if (paymentTenantId !== payloadTenantId) {
        throw new BadRequestException({
          error: {
            code: WEBHOOK_TENANT_BINDING_FAILED,
            message: "Webhook tenant_id does not match payment tenant scope"
          }
        });
      }
      try {
        this.requestContextService.setTenantId(payment.tenantId);
      } catch (error: unknown) {
        const err = error instanceof Error ? error.message : String(error);
        throw new BadRequestException({
          error: {
            code: WEBHOOK_TENANT_BINDING_FAILED,
            message: `Failed to bind tenant context for webhook: ${err}`
          }
        });
      }

      return await this.dataSource.transaction(async (manager) => {
        const scopedPayment = await manager.findOne(PaymentEntity, {
          where: {
            providerPaymentId: payload.providerPaymentId,
            tenantId: payloadTenantId
          }
        });
        if (!scopedPayment) {
          this.webhookUnknownPaymentTotal += 1;
          return {
            processed: false,
            deduplicated: false,
            requestId,
            providerPaymentId: payload.providerPaymentId,
            providerEventId: payload.providerEventId ?? null,
            provider: null,
            tenantId: payloadTenantId,
            status: payload.status
          };
        }
        const result = await this.idempotencyService.executeWithIdempotency(
          {
            tenantId: scopedPayment.tenantId,
            key: requestId,
            endpoint: "/internal/payments/webhook",
            requestHash: this.idempotencyService.createRequestHash({
              method: "POST",
              path: "/internal/payments/webhook",
              body: payload
            }),
            statusCode: 200
          },
          async () => {
            try {
              await this.applyPaymentStatus(
                manager,
                scopedPayment,
                payload.status,
                "system",
                payload.reason
              );
            } catch (error: unknown) {
              if (this.isWebhookIgnoredInvalidPaymentTransition(error)) {
                return {
                  providerPaymentId: payload.providerPaymentId,
                  providerEventId: payload.providerEventId ?? null,
                  provider: scopedPayment.provider,
                  tenantId: scopedPayment.tenantId,
                  status: scopedPayment.status
                };
              }
              throw error;
            }
            return {
              providerPaymentId: payload.providerPaymentId,
              providerEventId: payload.providerEventId ?? null,
              provider: scopedPayment.provider,
              tenantId: scopedPayment.tenantId,
              status: payload.status
            };
          }
        );
        this.webhookProcessedTotal += 1;
        if (result.replayed) {
          this.webhookDedupedTotal += 1;
        }
        const responseBody = result.responseBody as {
          providerPaymentId?: string;
          providerEventId?: string | null;
          provider?: string;
          tenantId?: string;
          status?: PaymentStatus;
        };
        return {
          processed: true,
          deduplicated: result.replayed,
          requestId,
          providerPaymentId: responseBody.providerPaymentId ?? payload.providerPaymentId,
          providerEventId: responseBody.providerEventId ?? payload.providerEventId ?? null,
          provider: responseBody.provider ?? scopedPayment.provider,
          tenantId: responseBody.tenantId ?? scopedPayment.tenantId,
          status: responseBody.status ?? payload.status
        };
      });
    } catch (error: unknown) {
      this.webhookFailedTotal += 1;
      throw error;
    }
  }

  async refundPayment(id: string, reason?: string): Promise<PaymentResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await findPaymentScopedForActor(
        manager,
        this.userRepository,
        this.requestContextService,
        id
      );
      const updated = await this.applyPaymentStatus(
        manager,
        payment,
        PaymentStatus.REFUNDED,
        "admin",
        reason
      );
      return this.toResponse(updated);
    });
  }

  async failTimedOutPendingPayments(): Promise<number> {
    const threshold = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60_000);
    let timedOutThisRun = 0;
    const tenants = await this.tenantRepository.find({
      select: { id: true },
      where: { deletedAt: IsNull() }
    });

    for (const tenant of tenants) {
      await this.tenantDbContext.runInTenantScope(tenant.id, async (manager) => {
        const rows = await manager
          .getRepository(PaymentEntity)
          .createQueryBuilder("p")
          .where("p.tenant_id = :tenantId", { tenantId: tenant.id })
          .andWhere("p.status = :status", { status: PaymentStatus.PENDING })
          .andWhere("p.created_at <= :threshold", { threshold })
          .orderBy("p.created_at", "ASC")
          .take(PAYMENT_TIMEOUT_BATCH)
          .setLock("pessimistic_write")
          .setOnLocked("skip_locked")
          .getMany();

        for (const payment of rows) {
          await this.applyPaymentStatus(
            manager,
            payment,
            PaymentStatus.FAILED,
            "system",
            "payment_timeout"
          );
          timedOutThisRun += 1;
        }
      });
    }

    if (timedOutThisRun > 0) {
      this.timedOutPayments += timedOutThisRun;
    }
    this.lastTimeoutRunAt = new Date().toISOString();
    return timedOutThisRun;
  }

  private async applyPaymentStatus(
    manager: DataSource["manager"],
    payment: PaymentEntity,
    next: PaymentStatus,
    actorId: string,
    reason?: string
  ): Promise<PaymentEntity> {
    if (payment.status === next) {
      return payment;
    }
    this.validatePaymentTransition(payment.status, next);

    const registration = await manager.findOne(RegistrationEntity, {
      where: { id: payment.registrationId, tenantId: payment.tenantId }
    });
    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Registration not found for payment"
        }
      });
    }
    if (registration.tenantId !== payment.tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_INVALID",
          message: "Trusted tenant context is invalid"
        }
      });
    }

    const previous = payment.status;
    payment.status = next;
    if (next === PaymentStatus.PAID) {
      payment.paidAt = new Date();
    } else if (next === PaymentStatus.FAILED) {
      payment.failedAt = new Date();
    } else if (next === PaymentStatus.REFUNDED) {
      payment.refundedAt = new Date();
    }

    if (next === PaymentStatus.PAID) {
      await this.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.ACCEPTED_PAID,
        actorId
      );
    }

    if (next === PaymentStatus.FAILED) {
      await this.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.REJECTED,
        actorId
      );
      this.failedPayments += 1;
      this.autoRecoveredCapacityCount += 1;
    }

    if (next === PaymentStatus.REFUNDED) {
      await this.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.REFUNDED,
        actorId
      );
      this.autoRecoveredCapacityCount += 1;
    }

    const saved = await manager.save(payment);
    await this.outboxService.addEvent(manager, {
      tenantId: saved.tenantId,
      aggregateType: "Payment",
      aggregateId: payment.id,
      eventType: this.mapEventType(next),
      payload: {
        entityType: "payment",
        entityId: payment.id,
        registrationId: payment.registrationId,
        actorId,
        previousStatus: previous,
        newStatus: next,
        reason: reason ?? null,
        timestamp: new Date().toISOString()
      }
    });

    return saved;
  }

  private async transitionRegistrationForPayment(
    manager: EntityManager,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus,
    actorId: string
  ): Promise<RegistrationEntity> {
    const previousStatus = registration.status;
    if (previousStatus === targetStatus) {
      return registration;
    }
    validateStatusTransition(previousStatus, targetStatus, registration.paymentStatus);
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
    await emitRegistrationStatusChangedEvent({
      manager,
      outboxService: this.outboxService,
      registration: saved,
      actorId,
      previousStatus,
      newStatus: targetStatus,
      eventType: this.mapRegistrationStatusEvent(targetStatus),
      source: "payment_flow"
    });
    return saved;
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

  private async promoteNextWaitlistItem(
    manager: EntityManager,
    registration: RegistrationEntity,
    lockedTour?: TourEntity | null
  ): Promise<boolean> {
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
      tourDepartureId: waitlistItem.tourDepartureId,
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

    await emitWaitlistConvertedAndAcceptedEvents({
      manager,
      outboxService: this.outboxService,
      waitlistItem,
      promotedRegistration: savedPromotedRegistration,
      actorId: this.requestContextService.getUserId() ?? "system",
      source: "waitlist_promotion"
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

  private isCapacityConsumingStatus(status: RegistrationStatus): boolean {
    return (
      status === RegistrationStatus.ACCEPTED ||
      status === RegistrationStatus.ACCEPTED_PAID
    );
  }

  /**
   * Webhooks must ack (200) for benign provider noise; invalid FSM transitions are ignored, not 409.
   */
  private isWebhookIgnoredInvalidPaymentTransition(error: unknown): boolean {
    if (!(error instanceof ConflictException)) {
      return false;
    }
    const body = error.getResponse();
    if (typeof body !== "object" || body === null || !("error" in body)) {
      return false;
    }
    const code = (body as { error?: { code?: string } }).error?.code;
    return code === "PAYMENT_STATUS_TRANSITION_INVALID";
  }

  private validatePaymentTransition(current: PaymentStatus, next: PaymentStatus): void {
    const allowed: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED],
      [PaymentStatus.PAID]: [PaymentStatus.REFUNDED, PaymentStatus.CANCELLED],
      [PaymentStatus.FAILED]: [],
      [PaymentStatus.REFUNDED]: [],
      [PaymentStatus.CANCELLED]: []
    };
    if (allowed[current].includes(next)) {
      return;
    }
    throw new ConflictException({
      error: {
        code: "PAYMENT_STATUS_TRANSITION_INVALID",
        message: "Requested payment transition is not allowed"
      }
    });
  }

  private mapEventType(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID:
        return "payment.succeeded";
      case PaymentStatus.FAILED:
        return "payment.failed";
      case PaymentStatus.REFUNDED:
        return "payment.refunded";
      default:
        return "payment.status_changed";
    }
  }

  private toResponse(entity: PaymentEntity): PaymentResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      registrationId: entity.registrationId,
      amount: entity.amount,
      currency: entity.currency,
      provider: entity.provider,
      providerPaymentId: entity.providerPaymentId,
      status: entity.status,
      paidAt: entity.paidAt ? entity.paidAt.toISOString() : null,
      failedAt: entity.failedAt ? entity.failedAt.toISOString() : null,
      refundedAt: entity.refundedAt ? entity.refundedAt.toISOString() : null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };
  }
}
