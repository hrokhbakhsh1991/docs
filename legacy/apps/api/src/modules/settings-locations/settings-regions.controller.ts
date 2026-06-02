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
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RequireCapability } from "../../common/casl/require-capability.decorator";
import { CreateWorkspaceRegionDto } from "./dto/create-workspace-region.dto";
import { UpdateWorkspaceRegionDto } from "./dto/update-workspace-region.dto";
import type { WorkspaceRegionResponseDto } from "./dto/workspace-region-response.dto";
import { SettingsRegionsService } from "./settings-regions.service";

@ApiTags("Settings — Regions")
@Controller("api/v2/settings/regions")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class SettingsRegionsController {
  constructor(private readonly regions: SettingsRegionsService) {}

  @Get()
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Settings"))
  @ApiOperation({ summary: "List workspace regions" })
  async list(): Promise<WorkspaceRegionResponseDto[]> {
    return this.regions.list();
  }

  @Post()
  @Roles(UserRole.Owner, UserRole.Admin)
  @RequireCapability("module.form_builder")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Settings"))
  @ApiOperation({ summary: "Create workspace region" })
  async create(@Body() dto: CreateWorkspaceRegionDto): Promise<WorkspaceRegionResponseDto> {
    return this.regions.create(dto);
  }

  @Patch(":regionId")
  @Roles(UserRole.Owner, UserRole.Admin)
  @RequireCapability("module.form_builder")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
  @ApiOperation({ summary: "Update workspace region" })
  async update(
    @Param("regionId", new ParseUUIDPipe()) regionId: string,
    @Body() dto: UpdateWorkspaceRegionDto
  ): Promise<WorkspaceRegionResponseDto> {
    return this.regions.update(regionId, dto);
  }

  @Delete(":regionId")
  @HttpCode(204)
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Delete, "Settings"))
  @ApiOperation({ summary: "Delete workspace region" })
  async remove(@Param("regionId", new ParseUUIDPipe()) regionId: string): Promise<void> {
    await this.regions.remove(regionId);
  }
}
