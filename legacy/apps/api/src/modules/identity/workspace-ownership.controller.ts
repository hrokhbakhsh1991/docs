import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import {
  TransferWorkspaceOwnershipDto,
  TransferWorkspaceOwnershipResponseDto
} from "./dto/transfer-workspace-ownership.dto";
import { UsersWriteService } from "./users-write.service";

@ApiTags("Identity")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class WorkspaceOwnershipController {
  constructor(private readonly usersWriteService: UsersWriteService) {}

  @Post(":tenantId/ownership-transfer")
  @Roles(UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "WorkspaceOwnership"))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Transfer workspace ownership to another active member."
  })
  @ApiParam({
    name: "tenantId",
    format: "uuid"
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TransferWorkspaceOwnershipResponseDto
  })
  async transferOwnership(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Body() payload: TransferWorkspaceOwnershipDto
  ): Promise<TransferWorkspaceOwnershipResponseDto> {
    return this.usersWriteService.transferWorkspaceOwnership(tenantId, payload);
  }
}
