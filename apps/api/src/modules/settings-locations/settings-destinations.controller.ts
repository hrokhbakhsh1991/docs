import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateWorkspaceDestinationDto } from "./dto/create-workspace-destination.dto";
import { UpdateWorkspaceDestinationDto } from "./dto/update-workspace-destination.dto";
import type { WorkspaceDestinationResponseDto } from "./dto/workspace-destination-response.dto";
import { SettingsDestinationsService } from "./settings-destinations.service";

@ApiTags("Settings — Destinations")
@Controller("api/v2/settings/destinations")
@UseGuards(AuthorizationPresenceGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsDestinationsController {
  constructor(private readonly destinations: SettingsDestinationsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "List workspace destinations" })
  async list(): Promise<WorkspaceDestinationResponseDto[]> {
    return this.destinations.list();
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Create workspace destination" })
  async create(@Body() dto: CreateWorkspaceDestinationDto): Promise<WorkspaceDestinationResponseDto> {
    return this.destinations.create(dto);
  }

  @Patch(":destinationId")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Update workspace destination" })
  async update(
    @Param("destinationId", new ParseUUIDPipe()) destinationId: string,
    @Body() dto: UpdateWorkspaceDestinationDto
  ): Promise<WorkspaceDestinationResponseDto> {
    return this.destinations.update(destinationId, dto);
  }

  @Delete(":destinationId")
  @HttpCode(204)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Delete workspace destination" })
  async remove(
    @Param("destinationId", new ParseUUIDPipe()) destinationId: string
  ): Promise<void> {
    await this.destinations.remove(destinationId);
  }
}
