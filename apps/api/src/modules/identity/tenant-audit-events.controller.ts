import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { Response } from "express";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TENANT_AUDIT_LIST_DEFAULT_LIMIT } from "../../common/audit/tenant-audit.constants";
import {
  decodeTenantAuditListCursor,
  TenantAuditEventsService
} from "../../common/audit/tenant-audit-events.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { ExportTenantAuditQueryDto } from "./dto/export-tenant-audit-query.dto";
import { ListDraftConflictsQueryDto } from "./dto/list-draft-conflicts-query.dto";
import { ListTenantAuditQueryDto } from "./dto/list-tenant-audit-query.dto";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort,
} from "./domain/ports/workspace-identity-repository.port";

@ApiTags("Compliance")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
@Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
export class TenantAuditEventsController {
  constructor(
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort
  ) {}

  /**
   * Ensures the JWT workspace tenant matches `:tenantId` (defense in depth vs CASL).
   */
  private requireWorkspaceTenantMatch(paramTenantId: string): string {
    const jwtTenantId = this.requestContextService.resolveEffectiveTenantId()?.trim().toLowerCase();
    const normalized = paramTenantId.trim().toLowerCase();
    if (!jwtTenantId || jwtTenantId !== normalized) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Workspace audit requires a token scoped to this tenant"
        }
      });
    }
    return normalized;
  }

  @Get(":tenantId/audit-events/export")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Audit"))
  @ApiOperation({
    summary: "Export tenant-scoped audit event stream",
    description:
      "Append-only compliance audit (`tenant_audit_events`) for the workspace. " +
      "Requires JWT tenant to match `:tenantId`. Owner, admin, or leader (read Audit)."
  })
  @ApiOkResponse({
    description: "CSV, NDJSON, or JSON array depending on `format`",
    schema: { type: "string", format: "binary" }
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or insufficient role" })
  async exportTenantAudit(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Query() query: ExportTenantAuditQueryDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<string | Record<string, unknown>[]> {
    const paramTenantId = this.requireWorkspaceTenantMatch(tenantId);

    const exporterUserId = this.requestContextService.getUserId();
    if (!exporterUserId) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }

    const exporter = await this.identityRepository.findUserById(exporterUserId);
    const actorLabel = exporter?.email ?? exporterUserId;

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const rows = await this.tenantAuditEventsService.listForTenantExport({
      tenantId: paramTenantId,
      from,
      to,
      limit: query.limit
    });

    await this.tenantAuditEventsService.appendOrWarn({
      tenantId: paramTenantId,
      actorUserId: exporterUserId,
      actor: actorLabel,
      userId: exporterUserId,
      action: TenantAuditAction.DATA_EXPORT_AUDIT,
      resourceType: "audit_trail",
      resourceId: paramTenantId,
      metadata: {
        format: query.format ?? "csv",
        row_count: rows.length,
        filters: { from: query.from ?? null, to: query.to ?? null }
      },
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    const fmt = query.format ?? "csv";
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tenant-audit-${paramTenantId}.csv"`
      );
      return this.tenantAuditEventsService.toCsv(rows);
    }
    if (fmt === "ndjson") {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tenant-audit-${paramTenantId}.ndjson"`
      );
      return this.tenantAuditEventsService.toNdjson(rows);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenantId,
      timestamp: row.occurredAt.toISOString(),
      user_id: row.userId,
      actor_user_id: row.actorUserId,
      actor: row.actor,
      action: row.action,
      resource_type: row.resourceType,
      resource_id: row.resourceId,
      client_ip: row.clientIp,
      request_id: row.requestId,
      metadata: row.metadata
    }));
  }

  @Get(":tenantId/audit-events")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Audit"))
  @ApiOperation({
    summary: "List tenant-scoped audit events (keyset paginated)",
    description:
      "Append-only compliance audit rows for the workspace. Requires JWT tenant to match `:tenantId`. " +
      "Owner, admin, or leader (read Audit)."
  })
  @ApiOkResponse({
    description: "Paginated audit rows (newest first)",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              occurredAt: { type: "string", format: "date-time" },
              actor: { type: "string" },
              actorUserId: { type: "string", format: "uuid", nullable: true },
              userId: { type: "string", format: "uuid", nullable: true },
              action: { type: "string" },
              resourceType: { type: "string" },
              resourceId: { type: "string", nullable: true },
              clientIp: { type: "string" },
              requestId: { type: "string", nullable: true },
              metadata: { type: "object", nullable: true, additionalProperties: true }
            }
          }
        },
        nextCursor: { type: "string", nullable: true }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or insufficient role" })
  async listTenantAudit(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Query() query: ListTenantAuditQueryDto
  ): Promise<{
    data: Array<{
      id: string;
      occurredAt: string;
      actor: string;
      actorUserId: string | null;
      userId: string | null;
      action: string;
      resourceType: string;
      resourceId: string | null;
      clientIp: string;
      requestId: string | null;
      metadata: Record<string, unknown> | null;
    }>;
    nextCursor: string | null;
  }> {
    const paramTenantId = this.requireWorkspaceTenantMatch(tenantId);

    let after: ReturnType<typeof decodeTenantAuditListCursor> = null;
    if (query.cursor?.trim()) {
      after = decodeTenantAuditListCursor(query.cursor.trim());
      if (!after) {
        throw new BadRequestException({
          error: {
            code: "AUDIT_CURSOR_INVALID",
            message: "Invalid pagination cursor"
          }
        });
      }
    }

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const limit = query.limit ?? TENANT_AUDIT_LIST_DEFAULT_LIMIT;

    const { rows, nextCursor } = await this.tenantAuditEventsService.listForTenantPaged({
      tenantId: paramTenantId,
      from,
      to,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorContains: query.actorContains,
      limit,
      after
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        actor: row.actor,
        actorUserId: row.actorUserId,
        userId: row.userId,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        clientIp: row.clientIp,
        requestId: row.requestId,
        metadata: row.metadata
      })),
      nextCursor
    };
  }

  @Get(":tenantId/audit-events/draft-conflicts")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Audit"))
  @ApiOperation({
    summary: "Top conflict-ridden draft resources for tenant",
    description:
      "Aggregated hotspot view from tenant audit rows where action is `draft_engine.conflict`.",
  })
  @ApiOkResponse({
    description: "Conflict hotspot rows (count descending)",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              resourceType: { type: "string" },
              resourceId: { type: "string" },
              conflictCount: { type: "number" },
              lastOccurredAt: { type: "string", format: "date-time" },
              sampleRequestId: { type: "string", nullable: true },
            },
          },
        },
      },
    },
  })
  async listDraftConflicts(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Query() query: ListDraftConflictsQueryDto,
  ): Promise<{
    data: Array<{
      resourceType: string;
      resourceId: string;
      conflictCount: number;
      lastOccurredAt: string;
      sampleRequestId: string | null;
    }>;
  }> {
    const paramTenantId = this.requireWorkspaceTenantMatch(tenantId);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const rows = await this.tenantAuditEventsService.listDraftConflictHotspots({
      tenantId: paramTenantId,
      from,
      to,
      limit: query.limit,
    });
    return {
      data: rows.map((row) => ({
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        conflictCount: row.conflictCount,
        lastOccurredAt: row.lastOccurredAt.toISOString(),
        sampleRequestId: row.sampleRequestId,
      })),
    };
  }
}
