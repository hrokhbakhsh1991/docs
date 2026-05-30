import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
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

import { UserRole } from "../../common/auth/user-role.enum";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { DraftSyncPayloadDto } from "./dto/draft-sync-payload.dto";
import { ResolveDraftConflictDto } from "./dto/resolve-draft-conflict.dto";
import { DraftEngineFacade } from "./draft-engine.facade";
import { DraftEngineAbilitiesGuard } from "./guards/draft-engine-abilities.guard";

@ApiTags("Draft engine")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, DraftEngineAbilitiesGuard)
@ApiBearerAuth()
export class DraftEngineController {
  private readonly logger = new Logger(DraftEngineController.name);

  constructor(
    @Inject(DraftEngineFacade)
    private readonly draftEngineFacade: DraftEngineFacade,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  @Get(":tenantId/draft-engine/:draftKey")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @ApiOperation({ summary: "Fetch draft snapshot for current member" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "tour-create" })
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

    const result = await this.draftEngineFacade.findForMember(draftKey);

    this.logger.log(`DEBUG-TRACE [end] GET response payload=${JSON.stringify(result)}`);
    return result;
  }

  @Patch(":tenantId/draft-engine/:draftKey")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @ApiOperation({ summary: "Upsert draft snapshot with optimistic locking" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "tour-create" })
  @ApiOkResponse({ type: DraftSyncPayloadDto })
  @ApiConflictResponse({ description: "Version mismatch — server payload included" })
  async upsertDraft(
    @Param("tenantId") tenantId: string,
    @Param("draftKey") draftKey: string,
    @Body() body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadDto> {
    return this.draftEngineFacade.upsertForMember(tenantId, draftKey, body);
  }

  @Post(":tenantId/draft-engine/:draftKey/conflict-resolution")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @ApiOperation({
    summary: "Merge conflicting client draft with server snapshot and persist the result",
  })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "tour-create" })
  @ApiOkResponse({ type: DraftSyncPayloadDto })
  @ApiNotFoundResponse({ description: "No server draft exists for conflict resolution" })
  async resolveDraftConflict(
    @Param("tenantId") tenantId: string,
    @Param("draftKey") draftKey: string,
    @Body() body: ResolveDraftConflictDto,
  ): Promise<DraftSyncPayloadDto> {
    return this.draftEngineFacade.resolveConflictForMember(tenantId, draftKey, body.clientDraft);
  }

  @Delete(":tenantId/draft-engine/:draftKey")
  @HttpCode(204)
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member)
  @ApiOperation({ summary: "Delete draft snapshot for current member" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "draftKey", example: "tour-create" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Draft not found" })
  async deleteDraft(
    @Param("tenantId") _tenantId: string,
    @Param("draftKey") draftKey: string,
  ): Promise<void> {
    await this.draftEngineFacade.deleteForMember(draftKey);
  }
}
