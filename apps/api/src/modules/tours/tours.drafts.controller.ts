import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { RolesGuard } from "../auth/roles.guard";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TourWizardDraftEntity } from "./entities/tour-wizard-draft.entity";
import { SaveTourDraftDto } from "./dto/save-tour-draft.dto";
import {
  assertTourWizardDraftVersionMatch,
  TOUR_WIZARD_DRAFT_INITIAL_VERSION,
} from "./utils/assert-tour-wizard-draft-version";
import {
  TourWizardDraftEnvelopeDto,
  TourWizardDraftResponseDto,
} from "./dto/tour-wizard-draft-response.dto";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";

@ApiTags("Tours")
@Controller("api/v2/workspaces/:workspaceId/tours/drafts")
@UseGuards(AuthorizationPresenceGuard, RolesGuard)
@ApiBearerAuth()
export class ToursDraftsController {
  constructor(
    @InjectRepository(TourWizardDraftEntity)
    private readonly draftRepository: Repository<TourWizardDraftEntity>,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  private assertWorkspaceScope(workspaceId: string): { tenantId: string; userId: string } {
    const userId = this.requestContext.getUserId();
    const tenantId = this.requestContext.getTenantId()?.trim();

    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Workspace tenant context is required",
        },
      });
    }

    if (!userId) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required",
        },
      });
    }

    if (workspaceId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_MISMATCH",
          message: "Workspace ID in URL does not match session context",
        },
      });
    }

    return { tenantId, userId };
  }

  private toResponseDto(entity: TourWizardDraftEntity): TourWizardDraftResponseDto {
    return {
      id: entity.id,
      currentStepIndex: entity.currentStepIndex,
      payload: entity.payload,
      version: entity.version,
      updatedAt: entity.updatedAt,
    };
  }

  @Get()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @ApiOperation({ summary: "Tour creation wizard draft for current member." })
  @ApiParam({ name: "workspaceId", format: "uuid" })
  @ApiOkResponse({ type: TourWizardDraftEnvelopeDto })
  async getDraft(
    @Param("workspaceId", new ParseUUIDPipe()) workspaceId: string,
  ): Promise<TourWizardDraftEnvelopeDto> {
    const { tenantId, userId } = this.assertWorkspaceScope(workspaceId);

    const draft = await this.draftRepository.findOne({
      where: { workspaceId: tenantId, userId },
    });

    return { draft: draft ? this.toResponseDto(draft) : null };
  }

  @Patch()
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @ApiOperation({ summary: "Upsert a tour creation wizard draft snapshot." })
  @ApiParam({ name: "workspaceId", format: "uuid" })
  async saveDraft(
    @Param("workspaceId", new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: SaveTourDraftDto,
  ): Promise<{ success: true; version: number }> {
    const { tenantId, userId } = this.assertWorkspaceScope(workspaceId);

    const existing = await this.draftRepository.findOne({
      where: { workspaceId: tenantId, userId },
    });

    if (!existing) {
      assertTourWizardDraftVersionMatch(TOUR_WIZARD_DRAFT_INITIAL_VERSION, dto.version);
      const created = await this.draftRepository.save(
        this.draftRepository.create({
          workspaceId: tenantId,
          userId,
          currentStepIndex: dto.currentStepIndex,
          payload: dto.payload,
          version: TOUR_WIZARD_DRAFT_INITIAL_VERSION,
        }),
      );
      return { success: true, version: created.version };
    }

    assertTourWizardDraftVersionMatch(existing.version, dto.version);

    existing.currentStepIndex = dto.currentStepIndex;
    existing.payload = dto.payload;
    existing.version = existing.version + 1;

    const saved = await this.draftRepository.save(existing);

    return { success: true, version: saved.version };
  }

  @Delete()
  @HttpCode(204)
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @ApiOperation({ summary: "Delete tour creation wizard draft for current member." })
  @ApiParam({ name: "workspaceId", format: "uuid" })
  async deleteDraft(@Param("workspaceId", new ParseUUIDPipe()) workspaceId: string): Promise<void> {
    const { tenantId, userId } = this.assertWorkspaceScope(workspaceId);
    await this.draftRepository.delete({ workspaceId: tenantId, userId });
  }
}
