import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { PatchWorkspaceUserRoleDto } from "./dto/patch-workspace-user-role.dto";
import { PostWorkspaceUserRewardsDto } from "./dto/post-workspace-user-rewards.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { WorkspaceUsersService } from "./workspace-users.service";

@ApiTags("Workspace Users")
@Controller("api/v2/workspaces/users")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class WorkspaceUsersController {
  constructor(
    @Inject(WorkspaceUsersService) private readonly workspaceUsersService: WorkspaceUsersService
  ) {}

  @Patch(":userId/role")
  @HttpCode(200)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for owner role mutation."
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/workspaces/users/:userId/role",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  @Roles(UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({
    summary: "Change workspace member role (owner only)",
    description:
      "Owner-only role update. Bumps `user_tenants.session_version` so the target user's JWT fails on the next request."
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "Membership not found in tenant" })
  async patchUserRole(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() payload: PatchWorkspaceUserRoleDto
  ): Promise<UserResponseDto> {
    return this.workspaceUsersService.patchUserRole(userId, payload.role);
  }

  @Post(":userId/rewards")
  @HttpCode(200)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for membership rewards mutation."
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/workspaces/users/:userId/rewards",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({
    summary: "Set permanent discount and reward badges on a membership",
    description:
      "Merges `permanentDiscountPercentage` and `badges` into `membership_metadata` (0–100 discount). Bumps session version."
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "Membership not found in tenant" })
  async postUserRewards(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() payload: PostWorkspaceUserRewardsDto
  ): Promise<UserResponseDto> {
    return this.workspaceUsersService.postUserRewards(userId, payload);
  }
}
