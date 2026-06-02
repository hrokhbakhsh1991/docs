import type { WorkspacePlanTier } from "@repo/shared";

export const WORKSPACE_METERING_PORT = Symbol("WORKSPACE_METERING_PORT");

export type WorkspacePlanLimits = {
  tier: WorkspacePlanTier;
  maxActiveTours: number | null;
  maxUsers: number | null;
};

export type WorkspaceUsageSnapshot = {
  activeTours: number;
  users: number;
};

export interface WorkspaceMeteringPort {
  getCachedPlanLimits(tenantId: string): Promise<WorkspacePlanLimits>;
  getCachedUsageSnapshot(tenantId: string): Promise<WorkspaceUsageSnapshot>;
}

export type WorkspaceQuotaScope = "active_tours" | "users";
