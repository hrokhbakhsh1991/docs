import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
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
import { ReplaceEmergencyContactsDto, UpsertMedicalProfileDto } from "./dto/safety-profile.dto";
import { SafetyProfileService } from "./safety-profile.service";

@ApiTags("Safety profile")
@Controller("api/v2/safety-profiles")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
@Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Member)
export class SafetyProfileController {
  constructor(private readonly safetyProfile: SafetyProfileService) {}

  @Get(":userId/emergency-contacts")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "List emergency contacts for a workspace member" })
  listEmergency(@Param("userId", new ParseUUIDPipe()) userId: string) {
    return this.safetyProfile.listEmergencyContacts(userId);
  }

  @Put(":userId/emergency-contacts")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Replace emergency contacts for a workspace member" })
  replaceEmergency(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() body: ReplaceEmergencyContactsDto
  ) {
    return this.safetyProfile.replaceEmergencyContacts(userId, body);
  }

  @Get(":userId/medical-profile")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Read decrypted medical profile payload (authorized roles only)" })
  getMedical(@Param("userId", new ParseUUIDPipe()) userId: string) {
    return this.safetyProfile.getMedicalProfile(userId);
  }

  @Put(":userId/medical-profile")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Upsert medical profile (encrypted at rest)" })
  putMedical(@Param("userId", new ParseUUIDPipe()) userId: string, @Body() body: UpsertMedicalProfileDto) {
    return this.safetyProfile.upsertMedicalProfile(userId, body.plaintextPayloadUtf8);
  }
}
