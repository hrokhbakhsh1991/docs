import { Body, Controller, Delete, Get, HttpCode, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { WorkspaceTourWizardDraftEnvelopeDto } from "./dto/workspace-tour-wizard-draft-response.dto";
import { UpsertWorkspaceTourWizardDraftDto } from "./dto/upsert-workspace-tour-wizard-draft.dto";
import { TourWizardDraftSettingsService } from "./tour-wizard-draft-settings.service";

@ApiTags("Settings — Tour wizard draft")
@Controller("api/v2/settings/tour-wizard-draft")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class SettingsTourWizardDraftController {
  constructor(private readonly drafts: TourWizardDraftSettingsService) {}

  @Get()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Settings"))
  @ApiOperation({
    summary: "Workspace tour create wizard draft for current member",
    description: "Server-side autosave envelope for cross-device restore (فاز ۲.۵.۳).",
  })
  @ApiOkResponse({ type: WorkspaceTourWizardDraftEnvelopeDto })
  async getDraft(): Promise<WorkspaceTourWizardDraftEnvelopeDto> {
    return { draft: await this.drafts.findForMember() };
  }

  @Patch()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
  @ApiOperation({ summary: "Upsert tour wizard draft envelope" })
  @ApiOkResponse({ type: WorkspaceTourWizardDraftEnvelopeDto })
  async upsertDraft(
    @Body() body: UpsertWorkspaceTourWizardDraftDto,
  ): Promise<WorkspaceTourWizardDraftEnvelopeDto> {
    return { draft: await this.drafts.upsertForMember(body) };
  }

  @Delete()
  @HttpCode(204)
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Settings"))
  @ApiOperation({ summary: "Delete tour wizard draft for current member" })
  async deleteDraft(): Promise<void> {
    await this.drafts.deleteForMember();
  }
}
