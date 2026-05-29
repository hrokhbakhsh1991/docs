import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { IsNull, type FindOptionsWhere } from "typeorm";
import { capabilitiesForTenantModules } from "@repo/shared";
import { registrationWhereForActor } from "../../../common/security/ownership-scope";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  actorHasTrustedTenantOrPlatformAdminBypass,
  registrationTenantMatchesActorScope,
} from "../../../common/rbac/workspace-access.helper";
import { RegistrationEntity } from "../../registrations/registration.entity";
import {
  TOURS_CATALOG_REPOSITORY_PORT,
  type ToursCatalogRepositoryPort,
} from "../../tours/domain/ports/tours-repository.port";
import type { CreatePaymentIntentDto } from "../dto/create-payment-intent.dto";
import { tenantContextMissingError } from "../../../common/errors/error-response-builders";

/**
 * Application slice: **resolve registration** for payment-intent creation (tenant + ownership scope).
 * Pure payment amount / gateway rules stay on {@link PaymentsService}.
 */
@Injectable()
export class PaymentIntentRegistrationResolverApplicationService {
  constructor(
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(TOURS_CATALOG_REPOSITORY_PORT)
    private readonly toursCatalogRepository: ToursCatalogRepositoryPort
  ) {}

  async resolveRegistrationForCreateIntent(
    manager: EntityManager,
    dto: CreatePaymentIntentDto
  ): Promise<RegistrationEntity> {
    const trustedTenantId = this.requestContextService.resolveEffectiveTenantId();
    const actorRoleRaw = this.requestContextService.getRole();
    const actorUserIdRaw = this.requestContextService.getUserId();
    if (!actorHasTrustedTenantOrPlatformAdminBypass(actorRoleRaw, trustedTenantId)) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const isPublicTenantBootstrapActor =
      typeof trustedTenantId === "string" &&
      trustedTenantId.trim() !== "" &&
      (!actorUserIdRaw || actorUserIdRaw.trim() === "") &&
      (!actorRoleRaw || actorRoleRaw.trim() === "");

    let registrationScope: FindOptionsWhere<RegistrationEntity> | FindOptionsWhere<RegistrationEntity>[];

    if (isPublicTenantBootstrapActor) {
      registrationScope = {
        id: dto.registrationId,
        tenantId: trustedTenantId,
        deletedAt: IsNull()
      };
    } else {
      registrationScope = await registrationWhereForActor(
        manager,
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
    if (!registrationTenantMatchesActorScope(actorRoleRaw, trustedTenantId, registration.tenantId)) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Registration not found"
        }
      });
    }

    const tenantModules = this.requestContextService.tryGetTenantEnabledModules() ?? [];
    const financeCaps = capabilitiesForTenantModules(tenantModules);
    if (!financeCaps.includes("module.finance")) {
      throw new BadRequestException({
        error: {
          code: "FINANCE_MODULE_REQUIRED",
          message: "Online payment intents require the finance module for this workspace."
        }
      });
    }

    let tour;
    try {
      tour = await this.toursCatalogRepository.findByIdOrThrow(
        registration.tenantId,
        registration.tourId
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Tour not found for registration"
          }
        });
      }
      throw error;
    }

    const costContext = tour.costContext;
    const requiresPayment =
      costContext != null &&
      typeof costContext === "object" &&
      Boolean(
        (costContext as { requiresPayment?: boolean }).requiresPayment ??
          (costContext as { requires_payment?: boolean }).requires_payment
      );
    if (!requiresPayment) {
      throw new BadRequestException({
        error: {
          code: "PAYMENT_NOT_REQUIRED",
          message: "This tour does not require payment; payment intents are not allowed."
        }
      });
    }

    return registration;
  }
}
