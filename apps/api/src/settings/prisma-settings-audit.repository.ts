import { withTenantRls } from "../db/with-tenant-rls";
import type { AuditTrailEvent } from "./settings.types";
import type { SettingsAuditRepository } from "./in-memory-settings-audit.repository";

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
  async listByTenant(tenantId: string): Promise<AuditTrailEvent[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.operatorSettingsAuditEvent.findMany({
        where: { tenantId },
        orderBy: { occurredAt: "desc" },
      })
    );
    return rows.map((row) => toAuditEvent(row));
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
