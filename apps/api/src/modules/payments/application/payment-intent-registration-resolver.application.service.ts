import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { IsNull, Repository, type FindOptionsWhere } from "typeorm";
import { registrationWhereForActor } from "../../../common/security/ownership-scope";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { tryParseWorkspaceUserRole, UserRole } from "../../../common/auth/user-role.enum";
import { RegistrationEntity } from "../../registrations/registration.entity";
import { UserEntity } from "../../identity/entities/user.entity";
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
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  async resolveRegistrationForCreateIntent(
    manager: EntityManager,
    dto: CreatePaymentIntentDto
  ): Promise<RegistrationEntity> {
    const trustedTenantId = this.requestContextService.resolveEffectiveTenantId();
    const actorRoleRaw = this.requestContextService.getRole();
    const parsedRole = tryParseWorkspaceUserRole(String(actorRoleRaw ?? ""));
    const actorUserIdRaw = this.requestContextService.getUserId();
    if (!trustedTenantId && parsedRole !== UserRole.Admin) {
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
    const isAdmin = parsedRole === UserRole.Admin;
    if (!isAdmin && trustedTenantId && registration.tenantId !== trustedTenantId) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Registration not found"
        }
      });
    }

    return registration;
  }
}
