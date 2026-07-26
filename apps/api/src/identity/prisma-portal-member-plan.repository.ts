import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

import type {
  PortalMemberPlanRecord,
  PortalMemberPlanRepository,
  UpsertPortalMemberPlanInput,
} from "./portal-member-plan.types";

function asStringArray(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) {
    return Object.freeze([]);
  }
  return Object.freeze([
    ...new Set(
      raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    ),
  ]);
}

function asCapabilityFlags(raw: unknown): Readonly<Record<string, boolean>> {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return Object.freeze({});
  }
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.trim().length > 0 && typeof value === "boolean") {
      out[key.trim()] = value;
    }
  }
  return Object.freeze(out);
}

function toRecord(row: {
  id: string;
  tenantId: string;
  planCode: string;
  displayName: string;
  moduleGrants: Prisma.JsonValue;
  capabilityFlags: Prisma.JsonValue;
  active: boolean;
}): PortalMemberPlanRecord {
  return Object.freeze({
    id: row.id,
    tenantId: row.tenantId,
    planCode: row.planCode,
    displayName: row.displayName,
    moduleGrants: asStringArray(row.moduleGrants),
    capabilityFlags: asCapabilityFlags(row.capabilityFlags),
    active: row.active,
  });
}

export class PrismaPortalMemberPlanRepository implements PortalMemberPlanRepository {
  async upsert(input: UpsertPortalMemberPlanInput): Promise<PortalMemberPlanRecord> {
    const planCode = input.planCode.trim();
    if (planCode.length === 0) {
      throw new Error("PORTAL_MEMBER_PLAN_CODE_REQUIRED");
    }
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      throw new Error("PORTAL_MEMBER_PLAN_DISPLAY_NAME_REQUIRED");
    }
    const moduleGrants = [
      ...new Set(input.moduleGrants.map((g) => g.trim()).filter((g) => g.length > 0)),
    ];
    const capabilityFlags = input.capabilityFlags ?? {};
    const active = input.active !== false;

    const row = await withTenantRls(input.tenantId, async (tx) => {
      return tx.portalMemberPlan.upsert({
        where: {
          tenantId_planCode: { tenantId: input.tenantId, planCode },
        },
        create: {
          tenantId: input.tenantId,
          planCode,
          displayName,
          moduleGrants,
          capabilityFlags,
          active,
        },
        update: {
          displayName,
          moduleGrants,
          capabilityFlags,
          active,
        },
      });
    });
    return toRecord(row);
  }

  async findActiveByCode(
    tenantId: string,
    planCode: string
  ): Promise<PortalMemberPlanRecord | null> {
    const code = planCode.trim();
    if (code.length === 0) {
      return null;
    }
    const row = await withTenantRls(tenantId, async (tx) => {
      return tx.portalMemberPlan.findUnique({
        where: { tenantId_planCode: { tenantId, planCode: code } },
      });
    });
    if (row === null || !row.active) {
      return null;
    }
    return toRecord(row);
  }
}
