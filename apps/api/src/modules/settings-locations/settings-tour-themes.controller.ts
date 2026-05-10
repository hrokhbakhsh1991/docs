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

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateWorkspaceTourThemeDto } from "./dto/create-workspace-tour-theme.dto";
import { ReorderWorkspaceTourThemesDto } from "./dto/reorder-workspace-tour-themes.dto";
import { UpdateWorkspaceTourThemeDto } from "./dto/update-workspace-tour-theme.dto";
import { WorkspaceTourThemeResponseDto } from "./dto/workspace-tour-theme-response.dto";
import { TourThemesSettingsService } from "./tour-themes-settings.service";

@ApiTags("Settings — Tour themes")
@Controller("api/v2/settings/tour-themes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsTourThemesController {
  constructor(private readonly tourThemes: TourThemesSettingsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.PARTICIPANT)
  @ApiOperation({
    summary: "List workspace tour themes",
    description: "Readable by all workspace members (for tour UI). Create/update/delete remain owner/admin only."
  })
  @ApiOkResponse({ type: WorkspaceTourThemeResponseDto, isArray: true })
  async list(): Promise<WorkspaceTourThemeResponseDto[]> {
    return this.tourThemes.findAllByWorkspace();
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Create workspace tour theme" })
  @ApiCreatedResponse({ type: WorkspaceTourThemeResponseDto })
  async create(@Body() dto: CreateWorkspaceTourThemeDto): Promise<WorkspaceTourThemeResponseDto> {
    return this.tourThemes.create(dto);
  }

  @Patch("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Reorder workspace tour themes (full id list)" })
  @ApiOkResponse({ type: WorkspaceTourThemeResponseDto, isArray: true })
  async reorder(@Body() dto: ReorderWorkspaceTourThemesDto): Promise<WorkspaceTourThemeResponseDto[]> {
    return this.tourThemes.reorder(dto.itemIds);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Update workspace tour theme" })
  @ApiOkResponse({ type: WorkspaceTourThemeResponseDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkspaceTourThemeDto
  ): Promise<WorkspaceTourThemeResponseDto> {
    return this.tourThemes.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Delete workspace tour theme" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.tourThemes.remove(id);
  }
}
