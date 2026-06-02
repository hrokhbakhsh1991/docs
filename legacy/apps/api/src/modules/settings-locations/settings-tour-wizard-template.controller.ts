import { Body, Controller, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { TourWizardTemplateInstantiateResponseDto } from "./dto/tour-wizard-template-instantiate-response.dto";
import { UpdateWorkspaceTourWizardTemplateDto } from "./dto/update-workspace-tour-wizard-template.dto";
import { WorkspaceTourWizardTemplateEnvelopeDto } from "./dto/workspace-tour-wizard-template-response.dto";
import { TourWizardTemplateSettingsService } from "./tour-wizard-template-settings.service";

@ApiTags("Settings — Tour wizard template")
@Controller("api/v2/settings/tour-wizard-template")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class SettingsTourWizardTemplateController {
  constructor(private readonly templates: TourWizardTemplateSettingsService) {}

  @Get()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Settings"))
  @ApiOperation({
    summary: "Workspace tour create wizard template",
    description: "Returns the persisted template overlay for /tours/new, or null when none is configured.",
  })
  @ApiOkResponse({ type: WorkspaceTourWizardTemplateEnvelopeDto })
  async getTemplate(): Promise<WorkspaceTourWizardTemplateEnvelopeDto> {
    return { template: await this.templates.findForWorkspace() };
  }

  @Patch()
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "TourWizardTemplate"))
  @ApiOperation({ summary: "Update workspace tour wizard template (field overlay + canonical seed)" })
  @ApiOkResponse({ type: WorkspaceTourWizardTemplateEnvelopeDto })
  async updateTemplate(
    @Body() body: UpdateWorkspaceTourWizardTemplateDto,
  ): Promise<WorkspaceTourWizardTemplateEnvelopeDto> {
    return { template: await this.templates.updateForWorkspace(body) };
  }

  @Post("instantiate")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "TourWizardTemplate"))
  @ApiOperation({
    summary: "Headless instantiate workspace tour wizard template",
    description:
      "Runs TemplateOrchestratorService against the persisted template row. " +
      "Optional ?seedDraft=true persists the snapshot to the member denali-create draft store.",
  })
  @ApiQuery({
    name: "seedDraft",
    required: false,
    type: Boolean,
    description: "When true, upserts draftState into Postgres via DraftEngineFacade (version 0 insert)",
  })
  @ApiOkResponse({ type: TourWizardTemplateInstantiateResponseDto })
  @ApiConflictResponse({ description: "Draft already exists when seedDraft=true with stale version" })
  async instantiateTemplate(
    @Query("seedDraft") seedDraft?: string,
  ): Promise<TourWizardTemplateInstantiateResponseDto> {
    return this.templates.instantiateForWorkspace({ seedDraft: seedDraft === "true" });
  }
}
