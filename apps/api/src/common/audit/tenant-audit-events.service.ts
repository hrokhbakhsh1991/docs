import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { LoggerService } from "../logger/logger.service";
import { TenantAuditEventEntity } from "./entities/tenant-audit-event.entity";
import type { TenantAuditActionType } from "./tenant-audit-actions";

export type TenantAuditAppendInput = {
  tenantId: string;
  actorUserId?: string | null;
  /** Human-readable actor (e.g. email). */
  actor: string;
  userId?: string | null;
  action: TenantAuditActionType | string;
  resourceType?: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  clientIp?: string;
  requestId?: string | null;
};

export const TENANT_AUDIT_EXPORT_MAX_ROWS = 50_000;

@Injectable()
export class TenantAuditEventsService {
  constructor(
    @InjectRepository(TenantAuditEventEntity)
    private readonly repo: Repository<TenantAuditEventEntity>,
    @Inject(LoggerService) private readonly logger: LoggerService
  ) {}

  async append(
    input: TenantAuditAppendInput,
    manager?: EntityManager
  ): Promise<void> {
    const r = manager?.getRepository(TenantAuditEventEntity) ?? this.repo;
    await r.insert({
      tenantId: input.tenantId.trim().toLowerCase(),
      actorUserId: input.actorUserId ?? null,
      actor: input.actor,
      userId: input.userId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? "",
      resourceId: input.resourceId ?? null,
      metadata:
        input.metadata === undefined || input.metadata === null
          ? null
          : (input.metadata as object),
      clientIp: input.clientIp?.trim() || "unknown",
      requestId: input.requestId?.trim() || null
    });
  }

  async appendMany(
    inputs: TenantAuditAppendInput[],
    manager?: EntityManager
  ): Promise<void> {
    if (inputs.length === 0) {
      return;
    }
    const r = manager?.getRepository(TenantAuditEventEntity) ?? this.repo;
    await r.insert(
      inputs.map((input) => ({
        tenantId: input.tenantId.trim().toLowerCase(),
        actorUserId: input.actorUserId ?? null,
        actor: input.actor,
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? "",
        resourceId: input.resourceId ?? null,
        metadata:
          input.metadata === undefined || input.metadata === null
            ? null
            : (input.metadata as object),
        clientIp: input.clientIp?.trim() || "unknown",
        requestId: input.requestId?.trim() || null
      }))
    );
  }

  /** Same as {@link append} but never throws (login/session paths must not fail if audit insert breaks). */
  async appendOrWarn(
    input: TenantAuditAppendInput,
    manager?: EntityManager
  ): Promise<void> {
    try {
      await this.append(input, manager);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn("tenant_audit.append_failed", {
        tenant_id: input.tenantId,
        action: input.action,
        error: msg
      });
    }
  }

  async listForTenantExport(params: {
    tenantId: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<TenantAuditEventEntity[]> {
    const cap = Math.min(params.limit ?? TENANT_AUDIT_EXPORT_MAX_ROWS, TENANT_AUDIT_EXPORT_MAX_ROWS);
    const tenantId = params.tenantId.trim().toLowerCase();
    const qb = this.repo
      .createQueryBuilder("e")
      .where("e.tenant_id = :tenantId", { tenantId })
      .orderBy("e.occurred_at", "DESC")
      .addOrderBy("e.id", "DESC")
      .take(cap);
    if (params.from) {
      qb.andWhere("e.occurred_at >= :from", { from: params.from });
    }
    if (params.to) {
      qb.andWhere("e.occurred_at <= :to", { to: params.to });
    }
    return qb.getMany();
  }

  toNdjson(rows: TenantAuditEventEntity[]): string {
    return `${rows.map((row) => JSON.stringify(this.toExportDto(row))).join("\n")}\n`;
  }

  toCsv(rows: TenantAuditEventEntity[]): string {
    const headers = [
      "id",
      "tenant_id",
      "timestamp",
      "user_id",
      "actor_user_id",
      "actor",
      "action",
      "resource_type",
      "resource_id",
      "client_ip",
      "request_id",
      "metadata"
    ];
    const escape = (v: string): string => {
      if (/[",\n\r]/.test(v)) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      const dto = this.toExportDto(row);
      lines.push(
        [
          dto.id,
          dto.tenant_id,
          dto.timestamp,
          dto.user_id ?? "",
          dto.actor_user_id ?? "",
          dto.actor,
          dto.action,
          dto.resource_type,
          dto.resource_id ?? "",
          dto.client_ip,
          dto.request_id ?? "",
          escape(JSON.stringify(dto.metadata ?? null))
        ].join(",")
      );
    }
    return `${lines.join("\n")}\n`;
  }

  private toExportDto(row: TenantAuditEventEntity): Record<string, unknown> {
    return {
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
    };
  }
}
