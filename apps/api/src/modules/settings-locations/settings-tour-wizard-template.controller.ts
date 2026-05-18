import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
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
}
