import { Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { QueryHandler, IQueryHandler } from "@nestjs/cqrs";
import { GetRegistrationDetailQuery } from "../domain/queries/get-registration-detail.query";
import { REGISTRATIONS_READ_REPOSITORY_PORT } from "../domain/ports/registrations-read.port";
import type { RegistrationsReadRepositoryPort, RegistrationReadWhere } from "../domain/ports/registrations-read.port";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { syntheticBookingContactPhone } from "../../../common/security/ownership-scope";
import {
  canActAsPlatformAdminWithoutTenant,
  isWorkspaceLeaderOrAbove,
  isWorkspaceMember
} from "../../../common/rbac/workspace-access.helper";
import { tryParseWorkspaceUserRole } from "../../../common/auth/user-role.enum";
import type { RegistrationReadDetailRecord } from "../domain/registration-read-detail.types";

@QueryHandler(GetRegistrationDetailQuery)
export class GetRegistrationDetailHandler implements IQueryHandler<GetRegistrationDetailQuery, RegistrationReadDetailRecord> {
  constructor(
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(REGISTRATIONS_READ_REPOSITORY_PORT)
    private readonly registrationsReadRepository: RegistrationsReadRepositoryPort
  ) {}

  async execute(query: GetRegistrationDetailQuery): Promise<RegistrationReadDetailRecord> {
    const roleString = this.requestContextService.getRole() ?? "";
    const role = tryParseWorkspaceUserRole(String(roleString));
    const userId = this.requestContextService.getUserId();
    const tenantId = this.requestContextService.resolveEffectiveTenantId();

    if (!role) {
      throw new ForbiddenException({
        error: { code: "AUTH_FORBIDDEN_ROLE", message: "Insufficient role for this operation" }
      });
    }
    if (!userId) {
      throw new ForbiddenException({
        error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" }
      });
    }

    let readWhere: RegistrationReadWhere;

    if (canActAsPlatformAdminWithoutTenant(role)) {
      if (!tenantId) {
        throw new ForbiddenException({ error: { code: "TENANT_CONTEXT_MISSING", message: "Trusted tenant context required but absent" }});
      }
      readWhere = { id: query.registrationId, tenantId, deletedAt: null };
    } else if (isWorkspaceLeaderOrAbove(role)) {
      if (!tenantId) {
        throw new ForbiddenException({ error: { code: "TENANT_CONTEXT_MISSING", message: "Trusted tenant context required but absent" }});
      }
      readWhere = { id: query.registrationId, tenantId, deletedAt: null };
    } else if (isWorkspaceMember(role)) {
      if (!tenantId) {
        throw new ForbiddenException({ error: { code: "TENANT_CONTEXT_MISSING", message: "Trusted tenant context required but absent" }});
      }
      const phone = syntheticBookingContactPhone(userId);
      readWhere = { id: query.registrationId, tenantId, participantContactPhone: phone, deletedAt: null };
    } else {
      throw new ForbiddenException({
        error: { code: "AUTH_FORBIDDEN_ROLE", message: "Insufficient role for this operation" }
      });
    }

    const registration = await this.registrationsReadRepository.findOneDetailStandalone(readWhere);

    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    if (
      tenantId &&
      registration.tenantId.trim().toLowerCase() !== tenantId.trim().toLowerCase()
    ) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Registration tenant does not match trusted tenant context"
        }
      });
    }

    return registration;
  }
}
