import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";

import { registrationWhereForActor } from "../../../common/security/ownership-scope";
import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  actorHasTrustedTenantOrPlatformAdminBypass,
  registrationTenantMatchesActorScope,
} from "../../../common/rbac/workspace-access.helper";
import { UpdateRegistrationStatusDto } from "../dto/update-registration-status.dto";
import { RegistrationResponseDto } from "../dto/get-registration.dto";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../registration.entity";
import { lockRegistrationEntityForFinancialMutation } from "../repositories/lock-registration-for-financial-mutation";
import { OutboxService } from "../../outbox/outbox.service";
import {
  emitRegistrationStatusChangedEvent,
} from "../registrations-effects";
import {
  validatePaymentTransition,
  validateStatusTransition,
} from "../registrations-policy";
import {
  REGISTRATIONS_READ_REPOSITORY_PORT,
  type RegistrationsReadRepositoryPort,
} from "../domain/ports/registrations-read.port";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import { toRegistrationReadWhere } from "../repositories/map-registration-read-where";
import {
  isCapacityConsumingRegistrationStatus,
  registrationStatusToOutboxEventType,
} from "../domain/registration-outbox-event-type";
import { RegistrationTransactionRunner } from "./registration-transaction.runner";
import { RegistrationTourAccessService } from "./registration-tour-access.service";
import { RegistrationCapacityService } from "./registration-capacity.service";
import { RegistrationPersistenceService } from "./registration-persistence.service";
import { RegistrationWaitlistService } from "./registration-waitlist.service";
import { RegistrationPublicFlowMetrics } from "./registration-public-flow-metrics";
import { asRegistrationWriteRecord, toRegistrationResponse } from "./registration-response.mapper";

@Injectable()
export class RegistrationStateMachineService {
  constructor(
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(REGISTRATIONS_READ_REPOSITORY_PORT)
    private readonly registrationsReadRepository: RegistrationsReadRepositoryPort,
    @Inject(RegistrationTransactionRunner)
    private readonly transactionRunner: RegistrationTransactionRunner,
    @Inject(RegistrationTourAccessService)
    private readonly tourAccess: RegistrationTourAccessService,
    @Inject(RegistrationCapacityService)
    private readonly capacityService: RegistrationCapacityService,
    @Inject(RegistrationPersistenceService)
    private readonly persistence: RegistrationPersistenceService,
    @Inject(RegistrationWaitlistService)
    private readonly waitlistService: RegistrationWaitlistService,
    @Inject(RegistrationPublicFlowMetrics)
    private readonly metrics: RegistrationPublicFlowMetrics,
  ) {}

  async updateRegistrationStatus(
    registrationId: string,
    payload: UpdateRegistrationStatusDto,
  ): Promise<RegistrationResponseDto> {
    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const where = await registrationWhereForActor(
        manager,
        this.requestContextService,
        registrationId,
      );
      const readWhere = toRegistrationReadWhere(where);
      const peek = await this.registrationsReadRepository.findOneStandalone(readWhere);
      if (!peek) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }

      const registration = await lockRegistrationEntityForFinancialMutation(manager, readWhere);
      this.persistence.assertExpectedRegistrationRowVersion(
        registration,
        payload.expected_row_version,
      );
      validateStatusTransition(
        registration.status,
        payload.targetStatus,
        registration.paymentStatus,
      );

      const previousStatus = registration.status;
      const delta = this.capacityService.calculateAcceptedCounterDelta(
        previousStatus,
        payload.targetStatus,
      );

      if (delta > 0) {
        const tour = await this.tourAccess.requireTourInTenant(manager, peek.tourId, peek.tenantId);
        await this.capacityService.consumeAcceptedCapacitySlot(manager, tour);
      } else if (delta < 0) {
        const tour = await this.tourAccess.requireTourInTenant(manager, peek.tourId, peek.tenantId);
        await this.capacityService.releaseAcceptedCapacitySlot(manager, tour);
      }

      registration.status = payload.targetStatus;
      const saved = await this.persistence.saveRegistrationOrVersionConflict(manager, registration);

      if (
        isCapacityConsumingRegistrationStatus(previousStatus) &&
        !isCapacityConsumingRegistrationStatus(payload.targetStatus)
      ) {
        await this.waitlistService.promoteNextWaitlistItem(manager, saved, null);
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
          eventType: eventName,
        });
      }

      return toRegistrationResponse(saved);
    });
  }

  async updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>,
  ): Promise<RegistrationWriteRecord> {
    const trustedTenantId = this.requestContextService.resolveEffectiveTenantId();
    const actorRole = this.requestContextService.getRole();
    if (!actorHasTrustedTenantOrPlatformAdminBypass(actorRole, trustedTenantId)) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent",
        },
      });
    }

    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const registrationScope = await registrationWhereForActor(
        manager,
        this.requestContextService,
        id,
      );
      const readWhere = toRegistrationReadWhere(registrationScope);

      const peek = await this.registrationsReadRepository.findOneStandalone(readWhere);
      if (!peek) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }

      if (!registrationTenantMatchesActorScope(actorRole, trustedTenantId, peek.tenantId)) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }

      validatePaymentTransition(peek.status, peek.paymentStatus, newPaymentStatus);

      const registration = await lockRegistrationEntityForFinancialMutation(manager, readWhere);
      registration.paymentStatus = newPaymentStatus;
      if (metadata !== undefined) {
        registration.paymentMetadata = metadata;
      }

      const saved = await this.persistence.saveRegistrationOrVersionConflict(manager, registration);
      return asRegistrationWriteRecord(saved);
    });
  }

  async transitionRegistrationForPayment(
    registration: RegistrationWriteRecord,
    targetStatus: RegistrationStatus,
    actorId: string,
  ): Promise<RegistrationWriteRecord> {
    const manager = this.transactionRunner.activeManager;
    const reg = await manager.findOne(RegistrationEntity, {
      where: { id: registration.id, tenantId: registration.tenantId },
    });
    if (!reg) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    const saved = await this.transitionRegistrationForPaymentEntity(
      manager,
      reg,
      targetStatus,
      actorId,
    );
    return asRegistrationWriteRecord(saved);
  }

  private async transitionRegistrationForPaymentEntity(
    manager: EntityManager,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus,
    actorId: string,
  ): Promise<RegistrationEntity> {
    const previousStatus = registration.status;
    if (previousStatus === targetStatus) {
      return registration;
    }
    validateStatusTransition(previousStatus, targetStatus, registration.paymentStatus);
    const delta = this.capacityService.calculateAcceptedCounterDelta(previousStatus, targetStatus);

    if (delta > 0) {
      const tour = await this.tourAccess.requireTourInTenant(
        manager,
        registration.tourId,
        registration.tenantId,
      );
      await this.capacityService.consumeAcceptedCapacitySlot(manager, tour);
    } else if (delta < 0) {
      const tour = await this.tourAccess.requireTourInTenant(
        manager,
        registration.tourId,
        registration.tenantId,
      );
      await this.capacityService.releaseAcceptedCapacitySlot(manager, tour);
    }

    registration.status = targetStatus;
    const saved = await this.persistence.saveRegistrationOrVersionConflict(manager, registration);
    if (
      isCapacityConsumingRegistrationStatus(previousStatus) &&
      !isCapacityConsumingRegistrationStatus(targetStatus)
    ) {
      await this.waitlistService.promoteNextWaitlistItem(manager, saved, null);
    }
    await emitRegistrationStatusChangedEvent({
      manager,
      outboxService: this.outboxService,
      registration: saved,
      actorId,
      previousStatus,
      newStatus: targetStatus,
      eventType: registrationStatusToOutboxEventType(targetStatus),
      source: "payment_flow",
    });
    if (targetStatus === RegistrationStatus.ACCEPTED_PAID) {
      this.metrics.registrationPaidTotal += 1;
    }
    return saved;
  }
}
