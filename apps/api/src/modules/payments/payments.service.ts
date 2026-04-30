import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { OutboxService } from "../outbox/outbox.service";
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

export type PaymentRuntimeMetrics = {
  paymentIntentsCreatedTotal: number;
  timedOutPayments: number;
  failedPayments: number;
  autoRecoveredCapacityCount: number;
  lastTimeoutRunAt: string | null;
};

@Injectable()
export class PaymentsService {
  private timedOutPayments = 0;
  private failedPayments = 0;
  private autoRecoveredCapacityCount = 0;
  private lastTimeoutRunAt: string | null = null;
  private paymentIntentsCreatedTotal = 0;

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
    @Inject(forwardRef(() => RegistrationsService))
    private readonly registrationsService: RegistrationsService
  ) {}

  getMetricsSnapshot(): PaymentRuntimeMetrics {
    return {
      paymentIntentsCreatedTotal: this.paymentIntentsCreatedTotal,
      timedOutPayments: this.timedOutPayments,
      failedPayments: this.failedPayments,
      autoRecoveredCapacityCount: this.autoRecoveredCapacityCount,
      lastTimeoutRunAt: this.lastTimeoutRunAt
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
    const registration = await manager.findOne(RegistrationEntity, {
      where: {
        id: dto.registrationId,
        deletedAt: IsNull()
      }
    });
    if (!registration) {
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

    const payment = manager.create(PaymentEntity, {
      tenantId: registration.tenantId,
      registrationId: registration.id,
      amount: dto.amount.toString(),
      currency: dto.currency,
      provider: dto.provider,
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
      order: { createdAt: "DESC" },
      take: 100
    });
    return rows.map((row) => this.toResponse(row));
  }

  async getLatestPaymentForRegistration(
    registrationId: string
  ): Promise<PaymentResponseDto | null> {
    const row = await this.paymentRepository.findOne({
      where: { registrationId },
      order: { createdAt: "DESC" }
    });
    if (!row) {
      return null;
    }
    return this.toResponse(row);
  }

  async createPaymentIntentForRegistration(input: {
    registrationId: string;
    amount: number;
    currency: string;
    provider: string;
    providerPaymentId?: string;
  }): Promise<PaymentResponseDto> {
    return this.createPaymentIntent({
      registrationId: input.registrationId,
      amount: input.amount,
      currency: input.currency,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId
    });
  }

  async getPaymentById(id: string): Promise<PaymentResponseDto> {
    const row = await this.paymentRepository.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Payment not found"
        }
      });
    }
    return this.toResponse(row);
  }

  async processWebhook(payload: PaymentWebhookDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(PaymentEntity, {
        where: { providerPaymentId: payload.providerPaymentId }
      });
      if (!payment) {
        return;
      }
      await this.applyPaymentStatus(manager, payment, payload.status, "system", payload.reason);
    });
  }

  async refundPayment(id: string, reason?: string): Promise<PaymentResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(PaymentEntity, { where: { id } });
      if (!payment) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Payment not found"
          }
        });
      }
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
