import {
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
import { InjectRepository } from "@nestjs/typeorm";
import type { Response } from "express";
import { IsNull, Repository } from "typeorm";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { ExportTenantAuditQueryDto } from "./dto/export-tenant-audit-query.dto";
import { UserEntity } from "./entities/user.entity";

@ApiTags("Compliance")
@Controller("api/v2/workspaces")
@UseGuards(AuthorizationPresenceGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.OWNER, Role.ADMIN)
export class TenantAuditEventsController {
  constructor(
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  @Get(":tenantId/audit-events/export")
  @ApiOperation({
    summary: "Export tenant-scoped audit event stream",
    description:
      "Append-only compliance audit (`tenant_audit_events`) for the workspace. " +
      "Requires JWT tenant to match `:tenantId`. Owner/admin only."
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
    const jwtTenantId = this.requestContextService
      .resolveEffectiveTenantId()
      ?.trim()
      .toLowerCase();
    const paramTenantId = tenantId.trim().toLowerCase();
    if (!jwtTenantId || jwtTenantId !== paramTenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Workspace audit export requires a token scoped to this tenant"
        }
      });
    }

    const exporterUserId = this.requestContextService.getUserId();
    if (!exporterUserId) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }

    const exporter = await this.userRepository.findOne({
      where: { id: exporterUserId, deletedAt: IsNull() }
    });
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
}
