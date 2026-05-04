import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, IsNull, Repository, type FindOptionsWhere } from "typeorm";
import {
  findPaymentScopedForActor,
  registrationWhereForActor
} from "../../common/security/ownership-scope";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { OutboxService } from "../outbox/outbox.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { UserEntity } from "../identity/entities/user.entity";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../registrations/registration.entity";
import { RegistrationsService } from "../registrations/registrations.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { PaymentEntity, PaymentStatus } from "./entities/payment.entity";

const PAYMENT_TIMEOUT_MINUTES = 15;
const PAYMENT_TIMEOUT_BATCH = 100;
const TENANT_PROBE_ID = "00000000-0000-4000-8000-000000000000";

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
    private readonly dataSource: DataSource,
    private readonly requestContextService: RequestContextService,
    private readonly idempotencyService: IdempotencyService,
    private readonly outboxService: OutboxService,
    // DI-DIAGNOSTIC: forwardRef injection path depends on correct runtime constructor metadata; verify this parameter type is emitted in E2E execution mode.
    // TODO(FREEZE-BLOCKER): Verify forwardRef-based RegistrationsService injection is never undefined during cold bootstrap and test module initialization.
    @Inject(forwardRef(() => RegistrationsService))
    private readonly registrationsService: RegistrationsService
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
    const trustedTenantId = this.requestContextService.getTenantId();
    const actorRoleRaw = this.requestContextService.getRole();
    const role = (actorRoleRaw ?? "").trim().toLowerCase();
    const actorUserIdRaw = this.requestContextService.getUserId();
    if (!trustedTenantId && role !== "admin") {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
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

  async listPayments(): Promise<PaymentResponseDto[]> {
    const rows = await this.paymentRepository.find({
      where: { deletedAt: IsNull() },
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
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
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
      const payment = await this.resolvePaymentForWebhook(payload);
      if (!payment) {
        this.webhookUnknownPaymentTotal += 1;
        return {
          processed: false,
          deduplicated: false,
          requestId,
          providerPaymentId: payload.providerPaymentId,
          providerEventId: payload.providerEventId ?? null,
          provider: null,
          tenantId: null,
          status: payload.status
        };
      }
      this.requestContextService.setTenantId(payment.tenantId);

      return await this.dataSource.transaction(async (manager) => {
        const scopedPayment = await manager.findOne(PaymentEntity, {
          where: { providerPaymentId: payload.providerPaymentId }
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
            tenantId: null,
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
            await this.applyPaymentStatus(
              manager,
              scopedPayment,
              payload.status,
              "system",
              payload.reason
            );
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

  private async resolvePaymentForWebhook(
    payload: Pick<
      PaymentWebhookDto,
      "providerPaymentId" | "paymentId" | "registrationId" | "tenantId"
    >
  ): Promise<PaymentEntity | null> {
    const tryScopedLookup = async (tenantId: string): Promise<PaymentEntity | null> => {
      this.requestContextService.setTenantId(tenantId);
      if (payload.paymentId) {
        const byPaymentId = await this.paymentRepository.findOne({
          where: { id: payload.paymentId }
        });
        if (byPaymentId) {
          return byPaymentId;
        }
      }
      if (payload.providerPaymentId) {
        const byProviderPaymentId = await this.paymentRepository.findOne({
          where: { providerPaymentId: payload.providerPaymentId }
        });
        if (byProviderPaymentId) {
          return byProviderPaymentId;
        }
      }
      if (payload.registrationId) {
        const byRegistrationId = await this.paymentRepository.findOne({
          where: { registrationId: payload.registrationId },
          order: { createdAt: "DESC" }
        });
        if (byRegistrationId) {
          return byRegistrationId;
        }
      }
      return null;
    };

    if (payload.tenantId) {
      const scoped = await tryScopedLookup(payload.tenantId);
      if (scoped) {
        return scoped;
      }
    }

    // Keep a valid tenant bound so DB session bootstrap does not fail before lookup.
    this.requestContextService.setTenantId(TENANT_PROBE_ID);
    const tenants = (await this.dataSource.query(
      'SELECT "id" FROM "tenants"'
    )) as Array<{ id: string }>;

    for (const tenant of tenants) {
      const payment = await tryScopedLookup(tenant.id);
      if (payment) {
        return payment;
      }
    }

    return null;
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
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .getRepository(PaymentEntity)
        .createQueryBuilder("p")
        .where("p.status = :status", { status: PaymentStatus.PENDING })
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
      await this.registrationsService.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.ACCEPTED_PAID,
        actorId
      );
    }

    if (next === PaymentStatus.FAILED) {
      await this.registrationsService.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.REJECTED,
        actorId
      );
      this.failedPayments += 1;
      this.autoRecoveredCapacityCount += 1;
    }

    if (next === PaymentStatus.REFUNDED) {
      await this.registrationsService.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.REFUNDED,
        actorId
      );
      this.autoRecoveredCapacityCount += 1;
    }

    const saved = await manager.save(payment);
    await this.outboxService.addEvent(manager, {
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
