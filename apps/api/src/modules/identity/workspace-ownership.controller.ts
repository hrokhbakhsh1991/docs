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
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import {
  TransferWorkspaceOwnershipDto,
  TransferWorkspaceOwnershipResponseDto
} from "./dto/transfer-workspace-ownership.dto";
import { UsersWriteService } from "./users-write.service";

@ApiTags("Identity")
@Controller("api/v2/workspaces")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WorkspaceOwnershipController {
  constructor(private readonly usersWriteService: UsersWriteService) {}

  @Post(":tenantId/ownership-transfer")
  @Roles(Role.OWNER)
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
