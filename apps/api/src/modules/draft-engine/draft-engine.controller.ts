import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { UserRole } from "../../common/auth/user-role.enum";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { DraftSyncPayloadDto } from "./dto/draft-sync-payload.dto";
import { DraftEngineService } from "./draft-engine.service";

@ApiTags("Draft engine")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class DraftEngineController {
  private readonly logger = new Logger(DraftEngineController.name);

  constructor(
    private readonly draftEngineService: DraftEngineService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get(":tenantId/draft-engine/:draftKey")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Tour"))
  @ApiOperation({ summary: "Fetch draft snapshot for current member" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "denali-create" })
  @ApiOkResponse({ type: DraftSyncPayloadDto })
  @ApiNotFoundResponse({ description: "No draft saved for this key" })
  async getDraft(
    @Param("tenantId") tenantId: string,
    @Param("draftKey") draftKey: string,
  ): Promise<DraftSyncPayloadDto | null> {
    this.logger.log(
      `DEBUG-TRACE [A] Input: route workspaceId=${tenantId} draftKey=${draftKey} | ` +
        `session jwtTenantId=${this.requestContext.resolveEffectiveTenantId() ?? "null"} ` +
        `userId=${this.requestContext.getUserId() ?? "null"}`,
    );

    const result = await this.draftEngineService.findForMember(tenantId, draftKey);

    this.logger.log(`DEBUG-TRACE [end] GET response payload=${JSON.stringify(result)}`);
    return result;
  }

  @Patch(":tenantId/draft-engine/:draftKey")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Tour"))
  @ApiOperation({ summary: "Upsert draft snapshot with optimistic locking" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "denali-create" })
  @ApiOkResponse({ type: DraftSyncPayloadDto })
  @ApiConflictResponse({ description: "Version mismatch — server payload included" })
  async upsertDraft(
    @Param("tenantId") tenantId: string,
    @Param("draftKey") draftKey: string,
    @Body() body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadDto> {
    return this.draftEngineService.upsertForMember(tenantId, draftKey, body);
  }

  @Delete(":tenantId/draft-engine/:draftKey")
  @HttpCode(204)
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Tour"))
  @ApiOperation({ summary: "Delete draft snapshot for current member" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "denali-create" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Draft not found" })
  async deleteDraft(
    @Param("tenantId") tenantId: string,
    @Param("draftKey") draftKey: string,
  ): Promise<void> {
    await this.draftEngineService.deleteForMember(tenantId, draftKey);
  }
}
