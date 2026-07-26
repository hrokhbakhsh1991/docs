/**
 * SK3 BP-7 — tenant-scoped portal member plans (codes are tenant data, not platform SKUs).
 */
export type PortalMemberPlanRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly planCode: string;
  readonly displayName: string;
  readonly moduleGrants: readonly string[];
  readonly capabilityFlags: Readonly<Record<string, boolean>>;
  readonly active: boolean;
};

export type UpsertPortalMemberPlanInput = {
  readonly tenantId: string;
  readonly planCode: string;
  readonly displayName: string;
  readonly moduleGrants: readonly string[];
  readonly capabilityFlags?: Readonly<Record<string, boolean>>;
  readonly active?: boolean;
};

export type ApplyPortalMemberPlanInput = {
  readonly tenantId: string;
  readonly userId: string;
  readonly planCode: string;
};

export type ApplyPortalMemberPlanResult = {
  readonly ok: true;
  readonly tenantId: string;
  readonly userId: string;
  readonly planCode: string;
  readonly moduleGrants: readonly string[];
  readonly capabilityFlags: Readonly<Record<string, boolean>>;
  readonly entitlementsRevision: number;
};

export interface PortalMemberPlanRepository {
  upsert(input: UpsertPortalMemberPlanInput): Promise<PortalMemberPlanRecord>;
  findActiveByCode(tenantId: string, planCode: string): Promise<PortalMemberPlanRecord | null>;
}
