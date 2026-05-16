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
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { CreateWorkspaceTourThemeDto } from "./dto/create-workspace-tour-theme.dto";
import { ReorderWorkspaceTourThemesDto } from "./dto/reorder-workspace-tour-themes.dto";
import { UpdateWorkspaceTourThemeDto } from "./dto/update-workspace-tour-theme.dto";
import { WorkspaceTourThemeResponseDto } from "./dto/workspace-tour-theme-response.dto";
import { TourThemesSettingsService } from "./tour-themes-settings.service";

@ApiTags("Settings — Tour themes")
@Controller("api/v2/settings/tour-themes")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class SettingsTourThemesController {
  constructor(private readonly tourThemes: TourThemesSettingsService) {}

  @Get()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Settings"))
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
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Settings"))
  @ApiOperation({ summary: "Create workspace tour theme" })
  @ApiCreatedResponse({ type: WorkspaceTourThemeResponseDto })
  async create(@Body() dto: CreateWorkspaceTourThemeDto): Promise<WorkspaceTourThemeResponseDto> {
    return this.tourThemes.create(dto);
  }

  @Patch("reorder")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
  @ApiOperation({ summary: "Reorder workspace tour themes (full id list)" })
  @ApiOkResponse({ type: WorkspaceTourThemeResponseDto, isArray: true })
  async reorder(@Body() dto: ReorderWorkspaceTourThemesDto): Promise<WorkspaceTourThemeResponseDto[]> {
    return this.tourThemes.reorder(dto.itemIds);
  }

  @Patch(":id")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
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
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Delete, "Settings"))
  @ApiOperation({ summary: "Delete workspace tour theme" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.tourThemes.remove(id);
  }
}
