import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import type { AcceptInviteResult } from "./services/users-invite.service";
import { UsersInviteService } from "./services/users-invite.service";

@ApiTags("Invites")
@Controller("api/v2/invites")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvitesController {
  constructor(private readonly usersInviteService: UsersInviteService) {}

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
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<AcceptInviteResult> {
    return this.usersInviteService.acceptInvite(dto);
  }
}
