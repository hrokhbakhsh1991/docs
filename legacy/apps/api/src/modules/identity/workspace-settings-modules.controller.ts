import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { PatchTenantModulesDto } from "./dto/patch-tenant-modules.dto";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort,
} from "./domain/ports/workspace-identity-repository.port";

@ApiTags("Identity")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class WorkspaceSettingsModulesController {
  constructor(
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService,
  ) {}

  @Patch(":tenantId/settings/modules")
  @Roles(UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Workspace"))
  @ApiOperation({ summary: "Enable or disable tenant product modules" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiOkResponse({ description: "Updated enabled module ids", schema: { type: "object" } })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Owner only or tenant scope mismatch" })
  async patchTenantModules(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Body() payload: PatchTenantModulesDto,
  ): Promise<{ enabledModules: string[] }> {
    const contextTenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!contextTenantId || contextTenantId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied",
        },
      });
    }

    const actorUserId = this.requestContextService.getUserId();
    const tenant = await this.identityRepository.findActiveTenantById(tenantId);
    if (!tenant) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Tenant not found",
        },
      });
    }

    const previous = [...(tenant.enabledModules ?? [])];
    const enabledModules = await this.identityRepository.updateTenantEnabledModules(
      tenantId,
      payload.enabledModules,
    );

    if (actorUserId) {
      await this.tenantAuditEventsService.append({
        tenantId,
        actorUserId,
        actor: actorUserId,
        action: TenantAuditAction.WORKSPACE_MODULES_CHANGED,
        resourceType: "tenant",
        resourceId: tenantId,
        metadata: {
          previous_modules: previous,
          enabled_modules: enabledModules,
        },
        clientIp: this.requestContextService.tryGetClientIp(),
        requestId: this.requestContextService.tryGetRequestId(),
      });
    }

    return { enabledModules };
  }
}
