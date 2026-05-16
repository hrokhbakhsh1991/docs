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
import { CreateWorkspaceTourCreationPresetDto } from "./dto/create-workspace-tour-creation-preset.dto";
import { ReorderWorkspaceTourCreationPresetsDto } from "./dto/reorder-workspace-tour-creation-presets.dto";
import { UpdateWorkspaceTourCreationPresetDto } from "./dto/update-workspace-tour-creation-preset.dto";
import { WorkspaceTourCreationPresetResponseDto } from "./dto/workspace-tour-creation-preset-response.dto";
import { TourCreationPresetsSettingsService } from "./tour-creation-presets-settings.service";

@ApiTags("Settings — Tour creation presets")
@Controller("api/v2/settings/tour-presets")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class SettingsTourCreationPresetsController {
  constructor(private readonly presets: TourCreationPresetsSettingsService) {}

  @Get()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Settings"))
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
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Settings"))
  @ApiOperation({ summary: "Create workspace tour creation preset" })
  @ApiCreatedResponse({ type: WorkspaceTourCreationPresetResponseDto })
  async create(@Body() dto: CreateWorkspaceTourCreationPresetDto): Promise<WorkspaceTourCreationPresetResponseDto> {
    return this.presets.create(dto);
  }

  @Patch("reorder")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
  @ApiOperation({ summary: "Reorder tour creation presets (full id list)" })
  @ApiOkResponse({ type: WorkspaceTourCreationPresetResponseDto, isArray: true })
  async reorder(@Body() dto: ReorderWorkspaceTourCreationPresetsDto): Promise<WorkspaceTourCreationPresetResponseDto[]> {
    return this.presets.reorder(dto.itemIds);
  }

  @Patch(":id")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
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
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Delete, "Settings"))
  @ApiOperation({ summary: "Delete workspace tour creation preset" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.presets.remove(id);
  }
}
