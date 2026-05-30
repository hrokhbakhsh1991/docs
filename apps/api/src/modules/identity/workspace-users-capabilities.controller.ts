import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { IdempotencyInterceptor } from "../idempotency/repositories/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { PatchMembershipCapabilitiesDto } from "./dto/patch-membership-capabilities.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersWriteService } from "./users-write.service";

@ApiTags("Identity")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class WorkspaceUsersCapabilitiesController {
  constructor(
    private readonly usersWriteService: UsersWriteService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Patch(":tenantId/users/:userId/capabilities")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for capability mutation.",
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/workspaces/:tenantId/users/:userId/capabilities",
    statusCode: 200,
    required: true,
    tenantSource: "context",
  })
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({ summary: "Assign explicit workspace capabilities on a membership" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "userId", format: "uuid" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role, tenant scope, or capability policy" })
  @ApiNotFoundResponse({ description: "Membership not found in tenant" })
  async patchMembershipCapabilities(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() payload: PatchMembershipCapabilitiesDto,
  ): Promise<UserResponseDto> {
    const contextTenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!contextTenantId || contextTenantId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied",
        },
      });
    }
    return this.usersWriteService.updateMembershipCapabilities(tenantId, userId, payload);
  }
}
