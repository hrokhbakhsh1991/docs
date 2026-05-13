import {
  Body,
  Controller,
  Delete,
  Get,
  MethodNotAllowedException,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiMethodNotAllowedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { BulkUpdateUserRoleDto } from "./dto/bulk-update-user-role.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { InviteUserResultDto } from "./dto/invite-user-result.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { ListUsersResponseDto } from "./dto/list-users-response.dto";
import { ResendInviteDto } from "./dto/resend-invite.dto";
import { ResendInviteResultDto } from "./dto/resend-invite-result.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UserRoleHistoryItemDto } from "./dto/user-role-history-item.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersInviteService } from "./services/users-invite.service";
import { UsersAuditService } from "./users-audit.service";
import { UsersReadService } from "./users-read.service";
import { UsersWriteService } from "./users-write.service";

@ApiTags("Users")
@Controller("api/v2/users")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
@Roles(Role.OWNER, Role.ADMIN)
export class UsersController {
  @Post()
  @ApiOperation({
    summary: "Create user (unsupported)",
    description:
      "Explicitly unsupported in this API. User lifecycle is managed through registration/invite/auth flows."
  })
  @ApiMethodNotAllowedResponse({
    description: "Direct user creation is not supported"
  })
  createUserUnsupported(): never {
    throw new MethodNotAllowedException({
      error: {
        code: "USER_CREATE_UNSUPPORTED",
        message:
          "Direct user creation is not supported. Use registration/invite/auth onboarding flows."
      }
    });
  }

  constructor(
    private readonly usersReadService: UsersReadService,
    private readonly usersWriteService: UsersWriteService,
    private readonly usersAuditService: UsersAuditService,
    private readonly usersInviteService: UsersInviteService
  ) {}

  @Post("invite")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "UserMembership"))
  @ApiOperation({ summary: "Invite user into tenant workspace" })
  @ApiOkResponse({ type: InviteUserResultDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  async inviteUser(@Body() payload: InviteUserDto): Promise<InviteUserResultDto> {
    return this.usersInviteService.inviteUser(payload.phone, payload.role);
  }

  @Post(":id/resend-invite")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({ summary: "Resend pending invite for invited membership" })
  @ApiOkResponse({ type: ResendInviteResultDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "Membership not found in tenant" })
  async resendInvite(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() _payload: ResendInviteDto
  ): Promise<ResendInviteResultDto> {
    return this.usersInviteService.resendInvite(id);
  }

  @Get()
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "UserMembership"))
  @ApiOperation({ summary: "List tenant users" })
  @ApiOkResponse({ type: ListUsersResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  async listUsers(@Query() query: ListUsersQueryDto): Promise<ListUsersResponseDto> {
    return this.usersReadService.listUsers(query);
  }

  @Get(":id/role-history")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Audit"))
  @ApiOperation({ summary: "List role change history for a tenant user" })
  @ApiOkResponse({ type: UserRoleHistoryItemDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async getUserRoleHistory(@Param("id", new ParseUUIDPipe()) id: string): Promise<UserRoleHistoryItemDto[]> {
    return this.usersAuditService.getUserRoleHistory(id);
  }

  @Get(":id")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "UserMembership"))
  @ApiOperation({ summary: "Get tenant-scoped user by id" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async getUserById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<UserResponseDto> {
    const dto = await this.usersReadService.getUserById(id);
    res.setHeader("ETag", `W/"user:${dto.id}:${dto.profileRowVersion ?? 1}"`);
    return dto;
  }

  @Patch("bulk-role")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({
    summary: "Bulk change user roles in tenant scope",
    description:
      "Bulk general role update under tenant scope. Each target is evaluated with the same PATCH RBAC policy " +
      "(no self change, no owner modification/assignment, actor must outrank target and new role). " +
      "Runs in a single transaction and bumps `session_version` only for memberships whose role actually changes."
  })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description:
      "Insufficient JWT role, tenant context, or workspace RBAC policy (see operation description for policy constraints)"
  })
  @ApiNotFoundResponse({ description: "One or more user memberships not found in tenant" })
  async bulkUpdateUserRole(@Body() payload: BulkUpdateUserRoleDto): Promise<UserResponseDto[]> {
    return this.usersWriteService.bulkUpdateUserRole(payload.userIds, payload.role);
  }

  @Patch(":id")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({
    summary: "Change user role in tenant scope",
    description:
      "General role update: cannot change your own role, cannot assign or modify `owner` here, and actor must outrank target and new role. " +
      "Success bumps `session_version` on the target membership so older JWTs for that user+tenant fail with `AUTH_TOKEN_REVOKED`. " +
      "RBAC denial codes: RBAC_SELF_ROLE_CHANGE_FORBIDDEN, RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN, RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN, RBAC_INSUFFICIENT_ROLE_PRIVILEGE."
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description:
      "Insufficient JWT role, tenant context, or workspace RBAC policy (see operation description for codes)"
  })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async updateUserRole(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() payload: UpdateUserRoleDto
  ): Promise<UserResponseDto> {
    return this.usersWriteService.updateUserRole(id, payload.role);
  }

  @Patch(":id/suspend")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({ summary: "Suspend tenant-scoped membership for a user" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient role or policy violation (self/owner suspension forbidden)"
  })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async suspendUser(@Param("id", new ParseUUIDPipe()) id: string): Promise<UserResponseDto> {
    return this.usersWriteService.suspendUserMembership(id);
  }

  @Patch(":id/reactivate")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  @ApiOperation({ summary: "Reactivate suspended tenant-scoped membership for a user" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async reactivateUser(@Param("id", new ParseUUIDPipe()) id: string): Promise<UserResponseDto> {
    return this.usersWriteService.reactivateUserMembership(id);
  }

  @Delete(":id/remove")
  @UseGuards(AbilitiesGuard)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Delete, "UserMembership"))
  @ApiOperation({ summary: "Remove user membership from current tenant" })
  @ApiOkResponse({ description: "User membership removed" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient role or policy violation (self/owner removal forbidden)"
  })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async removeUser(@Param("id", new ParseUUIDPipe()) id: string): Promise<{ success: true }> {
    await this.usersWriteService.removeUserMembership(id);
    return { success: true };
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete user (unsupported)",
    description:
      "Explicitly unsupported in this API. Membership and ownership flows are controlled separately."
  })
  @ApiMethodNotAllowedResponse({
    description: "Direct user deletion is not supported"
  })
  deleteUserUnsupported(): never {
    throw new MethodNotAllowedException({
      error: {
        code: "USER_DELETE_UNSUPPORTED",
        message:
          "Direct user deletion is not supported. Use membership/ownership policy flows instead."
      }
    });
  }
}
