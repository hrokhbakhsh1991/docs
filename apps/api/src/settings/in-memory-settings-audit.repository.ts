import type { AuditTrailEvent } from "./settings.types";

let auditStore: AuditTrailEvent[] = [];

export function resetSettingsAuditRepositoryForTests(): void {
  auditStore = [];
}

export interface SettingsAuditRepository {
  listByTenant(tenantId: string): Promise<AuditTrailEvent[]>;
  append(event: AuditTrailEvent): Promise<void>;
  seed(event: AuditTrailEvent): Promise<void>;
}

export class InMemorySettingsAuditRepository implements SettingsAuditRepository {
  async listByTenant(tenantId: string): Promise<AuditTrailEvent[]> {
    return auditStore
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((row) => ({ ...row }));
  }

  async append(event: AuditTrailEvent): Promise<void> {
    auditStore.push({ ...event });
  }

  async seed(event: AuditTrailEvent): Promise<void> {
    await this.append(event);
  }
}
