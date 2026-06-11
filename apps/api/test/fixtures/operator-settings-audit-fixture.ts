import { OPERATOR_SMOKE } from "./operator-smoke-e2e-tenant";
import {
  getSettingsAuditRepository,
  resetSettingsAuditRepositorySingletonForTests,
} from "../../src/settings/create-settings-audit-repository";

export async function seedOperatorSettingsAuditFixture(): Promise<void> {
  resetSettingsAuditRepositorySingletonForTests();
  const repo = getSettingsAuditRepository();
  const now = new Date().toISOString();
  await repo.seed({
    id: "00000000-0000-4000-8000-000000000601",
    tenantId: OPERATOR_SMOKE.tenantId,
    occurredAt: now,
    actorUserId: OPERATOR_SMOKE.ownerUserId,
    action: "settings.equipment.create",
    resourceType: "equipment",
    resourceId: "00000000-0000-4000-8000-000000000602",
    summary: "Created equipment: Trekking Poles",
  });
  await repo.seed({
    id: "00000000-0000-4000-8000-000000000603",
    tenantId: OPERATOR_SMOKE.tenantId,
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    actorUserId: OPERATOR_SMOKE.ownerUserId,
    action: "settings.config.put",
    resourceType: "tenant_config",
    resourceId: "wizard_template",
    summary: "Updated wizard template seed",
  });
}
