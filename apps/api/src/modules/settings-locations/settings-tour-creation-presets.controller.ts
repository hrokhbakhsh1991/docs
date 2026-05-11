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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateWorkspaceTourCreationPresetDto } from "./dto/create-workspace-tour-creation-preset.dto";
import { ReorderWorkspaceTourCreationPresetsDto } from "./dto/reorder-workspace-tour-creation-presets.dto";
import { UpdateWorkspaceTourCreationPresetDto } from "./dto/update-workspace-tour-creation-preset.dto";
import { WorkspaceTourCreationPresetResponseDto } from "./dto/workspace-tour-creation-preset-response.dto";
import { TourCreationPresetsSettingsService } from "./tour-creation-presets-settings.service";

@ApiTags("Settings — Tour creation presets")
@Controller("api/v2/settings/tour-presets")
@UseGuards(AuthorizationPresenceGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsTourCreationPresetsController {
  constructor(private readonly presets: TourCreationPresetsSettingsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.PARTICIPANT)
  @ApiOperation({
    summary: "List workspace tour creation presets",
    description: "Readable by all workspace members. Mutations remain owner/admin only."
  })
  @ApiOkResponse({ type: WorkspaceTourCreationPresetResponseDto, isArray: true })
  async list(): Promise<WorkspaceTourCreationPresetResponseDto[]> {
    return this.presets.findAllByWorkspace();
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Create workspace tour creation preset" })
  @ApiCreatedResponse({ type: WorkspaceTourCreationPresetResponseDto })
  async create(@Body() dto: CreateWorkspaceTourCreationPresetDto): Promise<WorkspaceTourCreationPresetResponseDto> {
    return this.presets.create(dto);
  }

  @Patch("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Reorder tour creation presets (full id list)" })
  @ApiOkResponse({ type: WorkspaceTourCreationPresetResponseDto, isArray: true })
  async reorder(@Body() dto: ReorderWorkspaceTourCreationPresetsDto): Promise<WorkspaceTourCreationPresetResponseDto[]> {
    return this.presets.reorder(dto.itemIds);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Update workspace tour creation preset" })
  @ApiOkResponse({ type: WorkspaceTourCreationPresetResponseDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkspaceTourCreationPresetDto
  ): Promise<WorkspaceTourCreationPresetResponseDto> {
    return this.presets.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Delete workspace tour creation preset" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.presets.remove(id);
  }
}
