import { Inject, Injectable, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { RegistrationEntity, RegistrationPaymentStatus } from "../registration.entity";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import type { RegistrationsWriteRepositoryPort } from "../domain/ports/registrations-write.port";
import { getIdempotentEntityManager } from "../../idempotency/idempotent-transaction.context";
import { isOptimisticLockVersionMismatchError } from "../../../common/typeorm/optimistic-lock-version-mismatch";
import { OutboxService } from "../../outbox/outbox.service";
import { emitRegistrationPaymentUpdatedEvent } from "../registrations-effects";

const asRegistrationWriteRecord = (row: RegistrationEntity): RegistrationWriteRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  tourId: row.tourId,
  tourDepartureId: row.tourDepartureId ?? null,
  status: row.status,
  paymentStatus: row.paymentStatus,
  participantContactPhone: row.participantContactPhone ?? null,
  telegramUserId: row.telegramUserId ?? null,
  quotedTotalMinor: row.quotedTotalMinor ?? null,
  quotedCurrencyCode: row.quotedCurrencyCode ?? null,
  paidAmount: row.paidAmount ?? null,
  rowVersion: row.rowVersion ?? null,
  deletedAt: row.deletedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class TypeOrmRegistrationsWriteRepository implements RegistrationsWriteRepositoryPort {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrations: Repository<RegistrationEntity>,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService
  ) {}

  private get activeManager(): EntityManager {
    return getIdempotentEntityManager() ?? this.registrations.manager;
  }

  private async saveRegistrationOrVersionConflict(
    manager: EntityManager,
    registration: RegistrationEntity | RegistrationWriteRecord
  ): Promise<RegistrationEntity> {
    try {
      return await manager.save(RegistrationEntity, registration as any);
    } catch (error: any) {
      if (isOptimisticLockVersionMismatchError(error)) {
        throw new ConflictException({
          error: {
            code: "OPTIMISTIC_LOCK_VERSION_MISMATCH",
            message: "Registration has been modified by another request"
          }
        });
      }
      throw error;
    }
  }

  async saveRegistrationPaymentUpdate(
    registration: RegistrationWriteRecord,
    paymentStatus: RegistrationPaymentStatus,
    paidAmount: string | undefined,
    idempotencyKey: string,
    actorId: string
  ): Promise<RegistrationWriteRecord> {
    const manager = this.activeManager;

    registration.paymentStatus = paymentStatus;
    const saved = await this.saveRegistrationOrVersionConflict(manager, registration);

    await emitRegistrationPaymentUpdatedEvent({
      manager,
      outboxService: this.outboxService,
      registration: saved,
      actorId,
      idempotencyKey,
      nextPaymentStatus: paymentStatus,
      nextPaidAmount: paidAmount,
    });

    return asRegistrationWriteRecord(saved);
  }
}
