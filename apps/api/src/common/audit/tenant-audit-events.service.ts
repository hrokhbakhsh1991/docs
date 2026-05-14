import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Brackets, Repository } from "typeorm";
import { TENANT_AUDIT_LIST_MAX_LIMIT } from "./tenant-audit.constants";
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

export type TenantAuditListCursor = { occurredAt: Date; id: string };

export function encodeTenantAuditListCursor(cursor: TenantAuditListCursor): string {
  return Buffer.from(
    JSON.stringify({ at: cursor.occurredAt.toISOString(), id: cursor.id }),
    "utf8"
  ).toString("base64url");
}

export function decodeTenantAuditListCursor(raw: string): TenantAuditListCursor | null {
  try {
    const decoded = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const j = JSON.parse(decoded) as { at?: string; id?: string };
    if (typeof j.at !== "string" || typeof j.id !== "string") {
      return null;
    }
    const occurredAt = new Date(j.at);
    if (Number.isNaN(occurredAt.getTime())) {
      return null;
    }
    const id = j.id.trim();
    if (!id) {
      return null;
    }
    return { occurredAt, id };
  } catch {
    return null;
  }
}

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

  /**
   * Keyset-paginated tenant audit stream for admin UI (`occurred_at` + `id` descending).
   * Fetches `limit + 1` rows to compute `nextCursor`.
   */
  async listForTenantPaged(params: {
    tenantId: string;
    from?: Date;
    to?: Date;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    actorContains?: string;
    limit: number;
    after?: TenantAuditListCursor | null;
  }): Promise<{ rows: TenantAuditEventEntity[]; nextCursor: string | null }> {
    const tenantId = params.tenantId.trim().toLowerCase();
    const take = Math.min(Math.max(params.limit, 1), TENANT_AUDIT_LIST_MAX_LIMIT);
    const qb = this.repo
      .createQueryBuilder("e")
      .where("e.tenant_id = :tenantId", { tenantId })
      .orderBy("e.occurred_at", "DESC")
      .addOrderBy("e.id", "DESC")
      .take(take + 1);

    if (params.from) {
      qb.andWhere("e.occurred_at >= :from", { from: params.from });
    }
    if (params.to) {
      qb.andWhere("e.occurred_at <= :to", { to: params.to });
    }
    if (params.action?.trim()) {
      qb.andWhere("e.action = :action", { action: params.action.trim() });
    }
    if (params.resourceType?.trim()) {
      qb.andWhere("e.resource_type = :resourceType", { resourceType: params.resourceType.trim() });
    }
    if (params.resourceId?.trim()) {
      qb.andWhere("e.resource_id = :resourceId", { resourceId: params.resourceId.trim() });
    }
    const ac = params.actorContains?.trim();
    if (ac) {
      const stripped = ac.replace(/[%_\\]/g, "");
      if (stripped) {
        qb.andWhere("e.actor ILIKE :actorPat", { actorPat: `%${stripped}%` });
      }
    }
    if (params.after) {
      const cAt = params.after.occurredAt;
      const cId = params.after.id;
      qb.andWhere(
        new Brackets((w) => {
          w.where("e.occurred_at < :cAt", { cAt }).orWhere(
            "(e.occurred_at = :cAt2 AND e.id < :cId)",
            { cAt2: cAt, cId }
          );
        })
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const tail = page.length > 0 ? page[page.length - 1] : undefined;
    const nextCursor =
      hasMore && tail !== undefined
        ? encodeTenantAuditListCursor({ occurredAt: tail.occurredAt, id: tail.id })
        : null;
    return { rows: page, nextCursor };
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
