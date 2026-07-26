import { randomUUID } from "node:crypto";

import type {
  PortalMemberPlanRecord,
  PortalMemberPlanRepository,
  UpsertPortalMemberPlanInput,
} from "./portal-member-plan.types";

function normalizePlanCode(planCode: string): string {
  return planCode.trim();
}

function normalizeModuleGrants(grants: readonly string[]): readonly string[] {
  return Object.freeze([
    ...new Set(grants.map((g) => g.trim()).filter((g) => g.length > 0)),
  ]);
}

function normalizeCapabilityFlags(
  flags: Readonly<Record<string, boolean>> | undefined
): Readonly<Record<string, boolean>> {
  if (flags === undefined) {
    return Object.freeze({});
  }
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(flags)) {
    const trimmed = key.trim();
    if (trimmed.length > 0 && typeof value === "boolean") {
      out[trimmed] = value;
    }
  }
  return Object.freeze(out);
}

/** Test / memory driver for BP-7 plan tables. */
export class InMemoryPortalMemberPlanRepository implements PortalMemberPlanRepository {
  private readonly byTenantCode = new Map<string, PortalMemberPlanRecord>();

  private key(tenantId: string, planCode: string): string {
    return `${tenantId}\0${normalizePlanCode(planCode)}`;
  }

  async upsert(input: UpsertPortalMemberPlanInput): Promise<PortalMemberPlanRecord> {
    const planCode = normalizePlanCode(input.planCode);
    if (planCode.length === 0) {
      throw new Error("PORTAL_MEMBER_PLAN_CODE_REQUIRED");
    }
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      throw new Error("PORTAL_MEMBER_PLAN_DISPLAY_NAME_REQUIRED");
    }
    const existing = this.byTenantCode.get(this.key(input.tenantId, planCode));
    const record: PortalMemberPlanRecord = Object.freeze({
      id: existing?.id ?? randomUUID(),
      tenantId: input.tenantId,
      planCode,
      displayName,
      moduleGrants: normalizeModuleGrants(input.moduleGrants),
      capabilityFlags: normalizeCapabilityFlags(input.capabilityFlags),
      active: input.active !== false,
    });
    this.byTenantCode.set(this.key(input.tenantId, planCode), record);
    return record;
  }

  async findActiveByCode(
    tenantId: string,
    planCode: string
  ): Promise<PortalMemberPlanRecord | null> {
    const record = this.byTenantCode.get(this.key(tenantId, planCode));
    if (record === undefined || !record.active) {
      return null;
    }
    return record;
  }
}
