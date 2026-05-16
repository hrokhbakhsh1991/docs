import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RequireCapability } from "../../common/casl/require-capability.decorator";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { UserEntity } from "../identity/entities/user.entity";
import {
  AcknowledgeReconciliationFindingDto,
  ApplyReconciliationLedgerAdjustmentDto,
  ListReconciliationFindingsQueryDto
} from "./dto/reconciliation-findings.dto";
import {
  ReconciliationFindingsService,
  type ReconciliationFindingRowDto
} from "./reconciliation-findings.service";

@ApiTags("Finance")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class ReconciliationFindingsController {
  constructor(
    private readonly findings: ReconciliationFindingsService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly requestContextService: RequestContextService
  ) {}

  private requireWorkspaceTenantMatch(paramTenantId: string): string {
    const jwtTenantId = this.requestContextService.resolveEffectiveTenantId()?.trim().toLowerCase();
    const normalized = paramTenantId.trim().toLowerCase();
    if (!jwtTenantId || jwtTenantId !== normalized) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Workspace reconciliation requires a token scoped to this tenant"
        }
      });
    }
    return normalized;
  }

  private async actorLabel(): Promise<{ userId: string; label: string }> {
    const userId = this.requestContextService.getUserId();
    if (!userId) {
      throw new UnauthorizedException({
        error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" }
      });
    }
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    return { userId, label: user?.email?.trim() || userId };
  }

  @Get(":tenantId/reconciliation-findings")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @RequireCapability("module.finance")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Reconciliation"))
  @ApiOperation({
    summary: "List persisted payment–finance reconciliation findings (triage)",
    description:
      "Keyset-paginated open findings for the workspace. Requires JWT tenant match and read Reconciliation."
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or insufficient role" })
  async listFindings(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Query() query: ListReconciliationFindingsQueryDto
  ): Promise<{ data: ReconciliationFindingRowDto[]; nextCursor: string | null }> {
    const t = this.requireWorkspaceTenantMatch(tenantId);
    return this.findings.listForTenant({
      tenantId: t,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor
    });
  }

  @Post(":tenantId/reconciliation-findings/:findingId/acknowledge")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Manage, "Reconciliation"))
  @ApiOperation({ summary: "Acknowledge an open reconciliation finding" })
  async acknowledge(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("findingId", ParseUUIDPipe) findingId: string,
    @Body() body: AcknowledgeReconciliationFindingDto
  ): Promise<ReconciliationFindingRowDto> {
    const t = this.requireWorkspaceTenantMatch(tenantId);
    const actor = await this.actorLabel();
    return this.findings.acknowledgeFinding({
      tenantId: t,
      findingId,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      note: body.note
    });
  }

  @Post(":tenantId/reconciliation-findings/:findingId/apply-ledger-adjustment")
  @Roles(UserRole.Owner, UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Manage, "Reconciliation"))
  @ApiOperation({
    summary: "Apply a manual clearing↔booking wallet ledger adjustment for a triad mismatch",
    description:
      "Posts `finance.ledger.double_entry_applied` (mandatory financial audit) and appends `reconciliation.ledger.adjustment_applied` on the tenant audit stream. Idempotent via `idempotencyKey` + outbox `domainEventId`."
  })
  async applyLedgerAdjustment(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("findingId", ParseUUIDPipe) findingId: string,
    @Body() body: ApplyReconciliationLedgerAdjustmentDto
  ): Promise<ReconciliationFindingRowDto> {
    const t = this.requireWorkspaceTenantMatch(tenantId);
    const actor = await this.actorLabel();
    return this.findings.applyLedgerAdjustment({
      tenantId: t,
      findingId,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      idempotencyKey: body.idempotencyKey,
      amountMinor: body.amountMinor,
      flow: body.flow,
      currencyOverride: body.currencyOverride,
      note: body.note
    });
  }
}
