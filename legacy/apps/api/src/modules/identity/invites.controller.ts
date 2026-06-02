import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { AbilityAction } from "../../common/casl/ability-actions";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import type { AcceptInviteResult } from "./services/users-invite.service";
import { UsersInviteService } from "./services/users-invite.service";

export type AcceptInviteApiResponse = {
  tenant_id: string;
  user_id: string;
  role: string;
  membership_status: string;
  joined_at: string;
  invite_status: string;
};

function toAcceptInviteApiResponse(result: AcceptInviteResult): AcceptInviteApiResponse {
  return {
    tenant_id: result.tenantId,
    user_id: result.userId,
    role: result.role,
    membership_status: result.membershipStatus,
    joined_at: result.joinedAt,
    invite_status: result.inviteStatus
  };
}

@ApiTags("Invites")
@Controller("api/v2/invites")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class InvitesController {
  constructor(
    @Inject(UsersInviteService) private readonly usersInviteService: UsersInviteService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  private inviteAcceptActorContext(): {
    actorUserId: string;
    clientIp?: string;
    requestId?: string;
  } {
    const actorUserId = this.requestContextService.getUserId();
    if (!actorUserId) {
      throw new Error("INVITE_ACCEPT_ACTOR_REQUIRED");
    }
    return {
      actorUserId,
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    };
  }

  @Post("accept")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept workspace invite by token" })
  @ApiOkResponse({
    description: "Invite accepted and membership activated",
    schema: { type: "object", additionalProperties: true }
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiNotFoundResponse({ description: "Invalid or unknown invite token" })
  @ApiForbiddenResponse({ description: "Invite email does not match authenticated user" })
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<AcceptInviteApiResponse> {
    return toAcceptInviteApiResponse(
      await this.usersInviteService.acceptInvite(dto, this.inviteAcceptActorContext())
    );
  }

  @Post(":token/accept")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept workspace invite by URL token" })
  @ApiOkResponse({
    description: "Invite accepted and membership activated",
    schema: { type: "object", additionalProperties: true }
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiNotFoundResponse({ description: "Invalid or unknown invite token" })
  @ApiForbiddenResponse({ description: "Invite email does not match authenticated user" })
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  async acceptInviteByUrlToken(@Param("token") token: string): Promise<AcceptInviteApiResponse> {
    return toAcceptInviteApiResponse(
      await this.usersInviteService.acceptInvite(
        { inviteToken: token },
        this.inviteAcceptActorContext()
      )
    );
  }
}
