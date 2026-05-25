import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, IsNull, Not, Repository } from "typeorm";
import { TenantContextMissingError } from "../../common/errors/tenant-context-missing.error";
import {
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import {
  findPaymentScopedForActor,
  registrationWhereForActor
} from "../../common/security/ownership-scope";
import {
  assertFinancialMutationRunsInIdempotentScope,
  assertFinancialIdempotencyKey
} from "../idempotency/financial-idempotency";
import {
  getFinancialIdempotencyKeyFromContext,
  getIdempotentEntityManager
} from "../idempotency/idempotent-transaction.context";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { PaymentCaptureLedgerAuthorityService } from "../finance/ledger/payment-capture-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "../finance/ledger/payment-refund-ledger-authority.service";
import { OutboxService } from "../outbox/outbox.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { UserRole } from "../../common/auth/user-role.enum";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserEntity } from "../identity/entities/user.entity";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../registrations/registration.entity";
import { lockRegistrationByTenantAndId } from "../registrations/utils/lock-registration-for-financial-mutation";
import { BookingPriceSnapshotEntity } from "../pricing/entities/booking-price-snapshot.entity";
import { findCanonicalBookingPriceSnapshot } from "../pricing/find-canonical-booking-price-snapshot";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { PaymentEntity, PaymentStatus } from "./entities/payment.entity";
import { PaymentIntentRegistrationResolverApplicationService } from "./application/payment-intent-registration-resolver.application.service";
import { assertPaymentIntentMatchesBookingSnapshot } from "./domain/assert-payment-intent-matches-booking-snapshot";
import {
  assertAllowedPaymentStatusTransition,
  paymentStatusToOutboxEventType
} from "./domain/payment-status-transition";
import {
  assertAllowedPaymentIntentLifecycleTransition,
  PaymentIntentLifecycleStatus
} from "./domain/payment-intent-lifecycle";
import { emitBookingFinalizationPipelineEvent } from "../registrations/registrations-effects";
import {
  assertBookingFinalizationAtLeast,
  assertSingleStepBookingFinalizationAdvance,
  BookingFinalizationPhase,
  bookingFinalizationPhaseFromFacts,
  type BookingFinalizationFacts
} from "../registrations/domain/booking-finalization-pipeline";
import { PaymentGatewayFactory } from "./gateway/payment-gateway.factory";
import { REGISTRATION_PAYMENT_PORT, IRegistrationPaymentPort } from "../registrations/ports/registration-payment.port";
import { FinanceReportsService } from "../finance/reports/finance-reports.service";
import { enforcePaymentIntentFinanceContract } from "./enforce-payment-intent-finance-contract";

const PAYMENT_TIMEOUT_MINUTES = 15;
const PAYMENT_TIMEOUT_BATCH = 100;

function pickFinancialPaymentSnapshot(payment: PaymentEntity): Record<string, unknown> {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    registrationId: payment.registrationId,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
    paidAt: payment.paidAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    refundedAt: payment.refundedAt?.toISOString() ?? null
  };
}

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

/**
 * Payment intents, webhooks, refunds, and timeout sweeps. Shares registration capacity rules via
 * `registrations/domain/registration-outbox-event-type.ts`. Decomposition inventory:
 * `architecture/service-decomposition.map.ts` (`PAYMENTS_GOD_METHODS`).
 */
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
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(TenantDbContextService) private readonly tenantDbContext: TenantDbContextService,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(PaymentIntentRegistrationResolverApplicationService)
    private readonly paymentIntentRegistrationResolver: PaymentIntentRegistrationResolverApplicationService,
    @Inject(PaymentRefundLedgerAuthorityService)
    private readonly paymentRefundLedgerAuthority: PaymentRefundLedgerAuthorityService,
    @Inject(PaymentCaptureLedgerAuthorityService)
    private readonly paymentCaptureLedgerAuthority: PaymentCaptureLedgerAuthorityService,
    @Inject(PaymentGatewayFactory) private readonly paymentGatewayFactory: PaymentGatewayFactory,
    @Inject(REGISTRATION_PAYMENT_PORT)
    private readonly registrationPaymentPort: IRegistrationPaymentPort,
    @Inject(FinanceReportsService) private readonly financeReportsService: FinanceReportsService
  ) {}

  private async loadBookingFinalizationFacts(
    manager: EntityManager,
    registration: RegistrationEntity
  ): Promise<BookingFinalizationFacts> {
    const [hasPriceSnapshot, hasPendingPayment, hasCapturedPayment] = await Promise.all([
      manager.exists(BookingPriceSnapshotEntity, {
        where: { bookingId: registration.id, tenantId: registration.tenantId }
      }),
      manager.exists(PaymentEntity, {
        where: {
          registrationId: registration.id,
          tenantId: registration.tenantId,
          status: PaymentStatus.PENDING
        }
      }),
      manager.exists(PaymentEntity, {
        where: {
          registrationId: registration.id,
          tenantId: registration.tenantId,
          status: PaymentStatus.PAID
        }
      })
    ]);
    return {
      hasPriceSnapshot,
      hasPendingPayment,
      hasCapturedPayment,
      registrationFinanciallyConfirmed: registration.status === RegistrationStatus.ACCEPTED_PAID
    };
  }

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
    assertFinancialMutationRunsInIdempotentScope("createPaymentIntent");
    const em = getIdempotentEntityManager()!;
    return this.createPaymentIntentWithManager(em, dto);
  }

  async createPaymentIntentWithManager(
    manager: DataSource["manager"],
    dto: CreatePaymentIntentDto
  ): Promise<PaymentResponseDto> {
    assertFinancialMutationRunsInIdempotentScope("createPaymentIntentWithManager");
    const registration =
      await this.paymentIntentRegistrationResolver.resolveRegistrationForCreateIntent(manager, dto);

    enforcePaymentIntentFinanceContract(
      {
        tenantId: registration.tenantId,
        registrationId: registration.id,
        amount: dto.amount,
        currency: dto.currency,
        method: "Online",
        provider: dto.paymentProvider,
        providerPaymentId: dto.providerPaymentId ?? null,
        status: PaymentStatus.PENDING,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        ledgerJournalId: null,
      },
      "createPaymentIntent",
    );

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

    const factsBeforeIntent = await this.loadBookingFinalizationFacts(manager, registration);
    const phaseBeforeIntent = bookingFinalizationPhaseFromFacts(factsBeforeIntent);
    assertBookingFinalizationAtLeast(
      phaseBeforeIntent,
      BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
      "createPaymentIntent"
    );

    const canonicalSnapshot = await findCanonicalBookingPriceSnapshot(
      manager,
      registration.tenantId,
      registration.id
    );
    if (!canonicalSnapshot) {
      throw new ConflictException({
        error: {
          code: "BOOKING_PRICE_SNAPSHOT_MISSING",
          message:
            "Cannot create payment intent without an immutable booking price snapshot. Live catalog pricing cannot be used here."
        }
      });
    }
    assertPaymentIntentMatchesBookingSnapshot(dto, canonicalSnapshot);

    assertAllowedPaymentIntentLifecycleTransition(
      PaymentIntentLifecycleStatus.CREATED,
      PaymentIntentLifecycleStatus.PENDING
    );

    const explicitProviderPaymentId =
      typeof dto.providerPaymentId === "string" ? dto.providerPaymentId.trim() : "";
    let resolvedProviderPaymentId: string | null = explicitProviderPaymentId || null;
    let gatewayClientSecret: string | null = null;
    let gatewayCheckoutUrl: string | null = null;

    if (!resolvedProviderPaymentId) {
      const idempotencyKey =
        getFinancialIdempotencyKeyFromContext() ??
        `dev:create_payment_intent:${registration.tenantId}:${registration.id}:${dto.paymentProvider}`;
      const gateway = this.paymentGatewayFactory.forProvider(dto.paymentProvider);
      const gatewayResult = await gateway.createPaymentIntent({
        tenantId: registration.tenantId,
        idempotencyKey,
        amount: dto.amount,
        currency: dto.currency,
        registrationId: registration.id,
        metadata: { source: "payments_service" }
      });
      resolvedProviderPaymentId = gatewayResult.providerPaymentId;
      gatewayClientSecret = gatewayResult.clientSecret ?? null;
      gatewayCheckoutUrl = gatewayResult.checkoutUrl ?? null;
    }

    const payment = manager.create(PaymentEntity, {
      tenantId: registration.tenantId,
      registrationId: registration.id,
      amount: dto.amount.toString(),
      currency: dto.currency,
      provider: dto.paymentProvider,
      providerPaymentId: resolvedProviderPaymentId,
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
      },
      financialAudit: {
        stateBefore: null,
        stateAfter: pickFinancialPaymentSnapshot(saved)
      }
    });

    const factsAfterIntent = await this.loadBookingFinalizationFacts(manager, registration);
    const phaseAfterIntent = bookingFinalizationPhaseFromFacts(factsAfterIntent);
    assertSingleStepBookingFinalizationAdvance(
      phaseBeforeIntent,
      phaseAfterIntent,
      "createPaymentIntent"
    );
    await emitBookingFinalizationPipelineEvent({
      manager,
      outboxService: this.outboxService,
      tenantId: registration.tenantId,
      registrationId: registration.id,
      phase: BookingFinalizationPhase.PAYMENT_INITIATED,
      metadata: { paymentId: saved.id }
    });

    return {
      ...this.toResponse(saved),
      clientSecret: gatewayClientSecret,
      checkoutUrl: gatewayCheckoutUrl
    };
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
                payload.reason,
                payload.status === PaymentStatus.REFUNDED ? requestId : undefined
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

  async refundPayment(id: string, reason: string | undefined, idempotencyKey: string): Promise<PaymentResponseDto> {
    const idempotencyKeyTrimmed = assertFinancialIdempotencyKey(idempotencyKey, "Idempotency-Key");
    assertFinancialMutationRunsInIdempotentScope("refundPayment");
    const em = getIdempotentEntityManager()!;
    const payment = await findPaymentScopedForActor(
      em,
      this.userRepository,
      this.requestContextService,
      id
    );
    const updated = await this.applyPaymentStatus(
      em,
      payment,
      PaymentStatus.REFUNDED,
      UserRole.Admin,
      reason,
      idempotencyKeyTrimmed
    );
    return this.toResponse(updated);
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
    reason?: string,
    ledgerIdempotencyKey?: string
  ): Promise<PaymentEntity> {
    enforcePaymentIntentFinanceContract(
      {
        id: payment.id,
        tenantId: payment.tenantId,
        registrationId: payment.registrationId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        status: next,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
        refundedAt: payment.refundedAt,
        ledgerJournalId: payment.ledgerJournalId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        deletedAt: payment.deletedAt,
      },
      `applyPaymentStatus:${next}`,
    );

    if (payment.status === next) {
      return payment;
    }
    assertAllowedPaymentStatusTransition(payment.status, next);

    const regPeek = await manager.findOne(RegistrationEntity, {
      where: { id: payment.registrationId, tenantId: payment.tenantId },
      select: { id: true, tourId: true, tenantId: true }
    });
    if (!regPeek) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    await this.registrationPaymentPort.lockTourRowForUpdate(
      manager,
      regPeek.tourId,
      regPeek.tenantId
    );
    const registration = await lockRegistrationByTenantAndId(
      manager,
      payment.tenantId,
      payment.registrationId
    );
    if (registration.tenantId !== payment.tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_INVALID",
          message: "Trusted tenant context is invalid"
        }
      });
    }

    const previous = payment.status;
    const paymentSnapshotBefore = pickFinancialPaymentSnapshot(payment);

    const factsStart = await this.loadBookingFinalizationFacts(manager, registration);
    const phaseStart = bookingFinalizationPhaseFromFacts(factsStart);

    if (next === PaymentStatus.REFUNDED) {
      const key =
        ledgerIdempotencyKey !== undefined && ledgerIdempotencyKey.trim() !== ""
          ? ledgerIdempotencyKey.trim()
          : `payment-refund:${payment.id}:${payment.tenantId}`;
      await this.paymentRefundLedgerAuthority.emitPaymentRefundLedgerReversal(manager, payment, key);
    }

    payment.status = next;
    if (next === PaymentStatus.PAID) {
      payment.paidAt = new Date();
      const { journalId } = await this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(
        manager,
        payment,
        "online_webhook_paid"
      );
      payment.ledgerJournalId = journalId;
    } else if (next === PaymentStatus.FAILED) {
      payment.failedAt = new Date();
    } else if (next === PaymentStatus.REFUNDED) {
      payment.refundedAt = new Date();
    }

    if (next === PaymentStatus.PAID) {
      assertSingleStepBookingFinalizationAdvance(
        phaseStart,
        BookingFinalizationPhase.PAYMENT_CAPTURED,
        "applyPaymentStatus"
      );
      await emitBookingFinalizationPipelineEvent({
        manager,
        outboxService: this.outboxService,
        tenantId: registration.tenantId,
        registrationId: registration.id,
        phase: BookingFinalizationPhase.PAYMENT_CAPTURED,
        metadata: { paymentId: payment.id }
      });

      await this.registrationPaymentPort.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.ACCEPTED_PAID,
        actorId
      );

      const otherPending = await manager.exists(PaymentEntity, {
        where: {
          registrationId: registration.id,
          tenantId: registration.tenantId,
          status: PaymentStatus.PENDING,
          id: Not(payment.id)
        }
      });
      if (otherPending) {
        throw new ConflictException({
          error: {
            code: "BOOKING_FINALIZATION_INVARIANT_BROKEN",
            message:
              "Another pending payment exists for this registration; cannot finalize booking after capture."
          }
        });
      }

      const factsAfterConfirm: BookingFinalizationFacts = {
        hasPriceSnapshot: factsStart.hasPriceSnapshot,
        hasPendingPayment: false,
        hasCapturedPayment: true,
        registrationFinanciallyConfirmed: registration.status === RegistrationStatus.ACCEPTED_PAID
      };
      const phaseAfterConfirm = bookingFinalizationPhaseFromFacts(factsAfterConfirm);
      assertSingleStepBookingFinalizationAdvance(
        BookingFinalizationPhase.PAYMENT_CAPTURED,
        phaseAfterConfirm,
        "applyPaymentStatus"
      );
      await emitBookingFinalizationPipelineEvent({
        manager,
        outboxService: this.outboxService,
        tenantId: registration.tenantId,
        registrationId: registration.id,
        phase: BookingFinalizationPhase.BOOKING_CONFIRMED,
        metadata: { paymentId: payment.id }
      });
    }

    if (next === PaymentStatus.FAILED) {
      await this.registrationPaymentPort.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.REJECTED,
        actorId
      );
      this.failedPayments += 1;
      this.autoRecoveredCapacityCount += 1;
    }

    if (next === PaymentStatus.REFUNDED) {
      await this.registrationPaymentPort.transitionRegistrationForPayment(
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
      eventType: paymentStatusToOutboxEventType(next),
      payload: {
        entityType: "payment",
        entityId: payment.id,
        registrationId: payment.registrationId,
        actorId,
        previousStatus: previous,
        newStatus: next,
        reason: reason ?? null,
        timestamp: new Date().toISOString()
      },
      financialAudit: {
        stateBefore: paymentSnapshotBefore,
        stateAfter: pickFinancialPaymentSnapshot(saved)
      }
    });

    if (
      next === PaymentStatus.PAID ||
      next === PaymentStatus.FAILED ||
      next === PaymentStatus.REFUNDED
    ) {
      await this.financeReportsService.invalidateSummaryCache(saved.tenantId);
    }

    return saved;
  }

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

  private toResponse(entity: PaymentEntity): PaymentResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      registrationId: entity.registrationId,
      amount: entity.amount,
      currency: entity.currency,
      method: entity.method,
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
