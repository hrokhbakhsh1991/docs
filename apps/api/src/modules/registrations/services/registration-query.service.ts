import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import {
  registrationWhereForActor,
  syntheticBookingContactPhone,
} from "../../../common/security/ownership-scope";
import {
  tenantContextMissingError,
} from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  RegistrationResponseDto,
  WaitlistItemResponseDto,
} from "../dto/get-registration.dto";
import { RegistrationEntity } from "../registration.entity";
import { WaitlistItemEntity } from "../waitlist-item.entity";
import { UserEntity } from "../../identity/entities/user.entity";
import {
  REGISTRATIONS_READ_REPOSITORY_PORT,
  type RegistrationsReadRepositoryPort,
} from "../domain/ports/registrations-read.port";
import {
  REGISTRATION_LOOKUP_PORT,
  type IRegistrationLookupPort,
} from "../domain/ports/registration-lookup.port";
import {
  REGISTRATIONS_TOUR_CATALOG_PORT,
  type RegistrationsTourCatalogPort,
} from "../domain/ports/registrations-tour-catalog.port";
import { toRegistrationReadWhere } from "../repositories/map-registration-read-where";
import { RegistrationStatus } from "../registration.entity";
import { RegistrationTransactionRunner } from "./registration-transaction.runner";
import { RegistrationTourAccessService } from "./registration-tour-access.service";
import {
  toRegistrationResponse,
  toRegistrationResponseFromDetail,
  toWaitlistResponse,
} from "./registration-response.mapper";

@Injectable()
export class RegistrationQueryService {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(REGISTRATION_LOOKUP_PORT)
    private readonly registrationLookup: IRegistrationLookupPort,
    @Inject(REGISTRATIONS_READ_REPOSITORY_PORT)
    private readonly registrationsReadRepository: RegistrationsReadRepositoryPort,
    @Inject(REGISTRATIONS_TOUR_CATALOG_PORT)
    private readonly registrationsTourCatalogPort: RegistrationsTourCatalogPort,
    @Inject(RegistrationTransactionRunner)
    private readonly transactionRunner: RegistrationTransactionRunner,
    @Inject(RegistrationTourAccessService)
    private readonly tourAccess: RegistrationTourAccessService,
  ) {}

  async resolveAuthenticatedBookingInput(tourId: string): Promise<{
    tourId: string;
    participantFullName: string;
    participantContactPhone: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
  }> {
    return this.registrationLookup.resolveAuthenticatedBookingInput(tourId);
  }

  async listRegistrationsForTour(tourId: string): Promise<RegistrationResponseDto[]> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      await this.tourAccess.requireTourInTenant(manager, tourId, tenantId);
      const rows = await manager.find(RegistrationEntity, {
        where: { tourId, tenantId },
        order: { createdAt: "DESC" },
      });
      return rows.map((row) => toRegistrationResponse(row));
    });
  }

  async listLeaderRegistrationIndex(limit = 5_000): Promise<{
    rows: Array<RegistrationResponseDto & { tourTitle: string }>;
    partial: boolean;
  }> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const cappedLimit = Math.min(Math.max(1, limit), 10_000);

    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      const registrations = await manager.find(RegistrationEntity, {
        where: { tenantId, deletedAt: IsNull() },
        order: { createdAt: "DESC" },
        take: cappedLimit,
      });

      const tourIds = [...new Set(registrations.map((row) => row.tourId))];
      const titleByTourId = await this.registrationsTourCatalogPort.getTourTitles(
        manager,
        tourIds,
        tenantId,
      );

      const rows = registrations.map((row) => ({
        ...toRegistrationResponse(row),
        tourTitle: titleByTourId.get(row.tourId) ?? row.tourId,
      }));

      return {
        rows,
        partial: registrations.length >= cappedLimit,
      };
    });
  }

  async getLeaderRegistrationStats(): Promise<{
    pending_count: number;
    total_count: number;
  }> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
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

    return this.transactionRunner.runInIdempotentOrOwnTransaction(async (manager) => {
      await this.tourAccess.requireTourInTenant(manager, tourId, tenantId);
      const rows = await manager.find(WaitlistItemEntity, {
        where: { tourId, tenantId },
        order: { createdAt: "ASC" },
      });
      return rows.map((row) => toWaitlistResponse(row));
    });
  }

  async listBookings(): Promise<RegistrationResponseDto[]> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    const userId = this.requestContextService.getUserId();
    if (!tenantId || !userId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "User not found",
        },
      });
    }

    const participantContactPhone = syntheticBookingContactPhone(userId);
    const whereClauses: Array<
      | { tenantId: string; participantContactPhone: string }
      | { tenantId: string; telegramUserId: string }
    > = [{ tenantId, participantContactPhone }];
    if (typeof user.telegramUserId === "string" && user.telegramUserId.trim() !== "") {
      whereClauses.push({ tenantId, telegramUserId: user.telegramUserId.trim() });
    }

    const rows = await this.registrationRepository.find({
      where: whereClauses,
      order: { createdAt: "DESC" },
    });
    return rows.map((row) => toRegistrationResponse(row));
  }

  async getRegistrationById(registrationId: string): Promise<RegistrationResponseDto> {
    const where = await registrationWhereForActor(
      this.registrationRepository.manager,
      this.requestContextService,
      registrationId,
    );
    const registration = await this.registrationsReadRepository.findOneDetailStandalone(
      toRegistrationReadWhere(where),
    );
    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope",
        },
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
          message: "Registration tenant does not match trusted tenant context",
        },
      });
    }
    return toRegistrationResponseFromDetail(registration);
  }
}
