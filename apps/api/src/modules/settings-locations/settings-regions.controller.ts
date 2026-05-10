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

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateWorkspaceRegionDto } from "./dto/create-workspace-region.dto";
import { UpdateWorkspaceRegionDto } from "./dto/update-workspace-region.dto";
import type { WorkspaceRegionResponseDto } from "./dto/workspace-region-response.dto";
import { SettingsRegionsService } from "./settings-regions.service";

@ApiTags("Settings — Regions")
@Controller("api/v2/settings/regions")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsRegionsController {
  constructor(private readonly regions: SettingsRegionsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "List workspace regions" })
  async list(): Promise<WorkspaceRegionResponseDto[]> {
    return this.regions.list();
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Create workspace region" })
  async create(@Body() dto: CreateWorkspaceRegionDto): Promise<WorkspaceRegionResponseDto> {
    return this.regions.create(dto);
  }

  @Patch(":regionId")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Update workspace region" })
  async update(
    @Param("regionId", new ParseUUIDPipe()) regionId: string,
    @Body() dto: UpdateWorkspaceRegionDto
  ): Promise<WorkspaceRegionResponseDto> {
    return this.regions.update(regionId, dto);
  }

  @Delete(":regionId")
  @HttpCode(204)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Delete workspace region" })
  async remove(@Param("regionId", new ParseUUIDPipe()) regionId: string): Promise<void> {
    await this.regions.remove(regionId);
  }
}
