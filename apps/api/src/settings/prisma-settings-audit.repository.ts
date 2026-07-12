import { withTenantRls } from "../db/with-tenant-rls";
import type { AuditTrailEvent } from "./settings.types";
import type { SettingsAuditRepository } from "./in-memory-settings-audit.repository";
import {
  MAX_SETTINGS_AUDIT_EVENTS_PER_TENANT,
  SETTINGS_AUDIT_LIST_SELECT,
} from "./settings-audit-list-projection";

function toAuditEvent(row: {
  id: string;
  tenantId: string;
  occurredAt: Date;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string;
}): AuditTrailEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    summary: row.summary,
  };
}

export class PrismaSettingsAuditRepository implements SettingsAuditRepository {
  async listByTenantPage(input: {
    readonly tenantId: string;
    readonly limit: number;
  }): Promise<{ readonly items: AuditTrailEvent[]; readonly nextCursor: string | null }> {
    const limit = input.limit;
    const rows = await withTenantRls(input.tenantId, (tx) =>
      tx.operatorSettingsAuditEvent.findMany({
        where: { tenantId: input.tenantId },
        select: SETTINGS_AUDIT_LIST_SELECT,
        orderBy: [{ occurredAt: "desc" }],
        take: limit + 1,
      })
    );
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map((row) => toAuditEvent(row));
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
    };
  }

  async listByTenant(tenantId: string): Promise<AuditTrailEvent[]> {
    const page = await this.listByTenantPage({
      tenantId,
      limit: MAX_SETTINGS_AUDIT_EVENTS_PER_TENANT,
    });
    return page.items;
  }

  async append(event: AuditTrailEvent): Promise<void> {
    await withTenantRls(event.tenantId, (tx) =>
      tx.operatorSettingsAuditEvent.create({
        data: {
          id: event.id,
          tenantId: event.tenantId,
          occurredAt: new Date(event.occurredAt),
          actorUserId: event.actorUserId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          summary: event.summary,
        },
      })
    );
  }

  async seed(event: AuditTrailEvent): Promise<void> {
    await this.append(event);
  }
}
