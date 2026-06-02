import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";

import { waitlistWhereForActor } from "../../../common/security/ownership-scope";
import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { isOptimisticLockVersionMismatchError } from "../../../common/typeorm/optimistic-lock-version-mismatch";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { OutboxService } from "../../outbox/outbox.service";
import { emitBookingCreatedOutboxEvent } from "../registrations-effects";
import {
  REGISTRATIONS_READ_REPOSITORY_PORT,
  type RegistrationsReadRepositoryPort,
} from "../domain/ports/registrations-read.port";
import { RegistrationEntity, RegistrationStatus } from "../registration.entity";
import { WaitlistItemEntity, WaitlistItemStatus } from "../waitlist-item.entity";
import { RegistrationPricingService } from "./registration-pricing.service";

@Injectable()
export class RegistrationPersistenceService {
  constructor(
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(REGISTRATIONS_READ_REPOSITORY_PORT)
    private readonly registrationsReadRepository: RegistrationsReadRepositoryPort,
    @Inject(RegistrationPricingService) private readonly registrationPricingService: RegistrationPricingService,
  ) {}

  assertExpectedRegistrationRowVersion(
    registration: RegistrationEntity,
    expectedRowVersion: number,
  ): void {
    if (Number(registration.rowVersion) !== Number(expectedRowVersion)) {
      throw new ConflictException({
        error: {
          code: "REGISTRATION_ROW_VERSION_CONFLICT",
          message: "Booking changed concurrently — reload the registration, then try again.",
        },
      });
    }
  }

  async ensureNoActiveRegistrationDuplicate(
    _manager: EntityManager,
    payload: {
      tenantId: string;
      tourId: string;
      participantContactPhone: string;
      telegramUserId?: string;
    },
  ): Promise<void> {
    const activeStatuses = {
      $in: [
        RegistrationStatus.PENDING,
        RegistrationStatus.ACCEPTED,
        RegistrationStatus.ACCEPTED_PAID,
      ],
    } as const;

    const duplicateByPhone = await this.registrationsReadRepository.findOneStandalone({
      tenantId: payload.tenantId,
      tourId: payload.tourId,
      participantContactPhone: payload.participantContactPhone,
      status: activeStatuses,
    });

    const duplicateByTelegram =
      payload.telegramUserId && payload.telegramUserId.trim() !== ""
        ? await this.registrationsReadRepository.findOneStandalone({
            tenantId: payload.tenantId,
            tourId: payload.tourId,
            telegramUserId: payload.telegramUserId,
            status: activeStatuses,
          })
        : null;

    const duplicate = duplicateByPhone ?? duplicateByTelegram;
    if (!duplicate) {
      return;
    }

    throw new ConflictException({
      error: {
        code: "REGISTRATION_DUPLICATE_ACTIVE",
        message: "Active registration already exists for participant and tour",
      },
    });
  }

  async ensureNoWaitingWaitlistDuplicate(
    manager: EntityManager,
    payload: {
      tenantId: string;
      tourId: string;
      participantContactPhone: string;
    },
  ): Promise<void> {
    const existingWaitingItem = await manager.findOne(WaitlistItemEntity, {
      where: {
        tenantId: payload.tenantId,
        tourId: payload.tourId,
        participantContactPhone: payload.participantContactPhone,
        status: WaitlistItemStatus.WAITING,
      },
    });

    if (!existingWaitingItem) {
      return;
    }

    throw new ConflictException({
      error: {
        code: "WAITLIST_CONFLICT_ACTIVE_RECORD",
        message: "Conversion blocked due to active registration/waitlist conflict",
      },
    });
  }

  async requireWaitlistItemForUpdate(
    manager: EntityManager,
    waitlistItemId: string,
  ): Promise<WaitlistItemEntity> {
    const where = await waitlistWhereForActor(
      manager,
      this.requestContextService,
      waitlistItemId,
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
        participantContactPhone: where.participantContactPhone,
      });
    }
    const resolved = await qb.getOne();
    if (!resolved) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return resolved;
  }

  async getOldestWaitingWaitlistItemForUpdate(
    manager: EntityManager,
    tenantId: string,
    tourId: string,
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

  async saveRegistrationOrVersionConflict(
    manager: EntityManager,
    registration: RegistrationEntity,
  ): Promise<RegistrationEntity> {
    const existedBefore =
      Boolean(registration.id) &&
      (await manager.exists(RegistrationEntity, { where: { id: registration.id } }));
    try {
      if (existedBefore && registration.id) {
        await this.registrationPricingService.restoreImmutableRegistrationQuoteColumns(
          manager,
          registration,
        );
      }
      const saved = await manager.save(registration);
      if (!existedBefore) {
        await emitBookingCreatedOutboxEvent({
          manager,
          outboxService: this.outboxService,
          tenantId: saved.tenantId,
          registrationId: saved.id,
          tourId: saved.tourId,
          correlationId: this.requestContextService.getRequestId(),
        });
      }
      if (saved.id) {
        await this.registrationPricingService.ensureBookingPriceSnapshotLockedAndEmit(
          manager,
          saved,
        );
      }
      return saved;
    } catch (err: unknown) {
      if (isOptimisticLockVersionMismatchError(err)) {
        throw new ConflictException({
          error: {
            code: "REGISTRATION_ROW_VERSION_CONFLICT",
            message: "Booking changed concurrently — reload the registration, then try again.",
          },
        });
      }
      throw err;
    }
  }
}
