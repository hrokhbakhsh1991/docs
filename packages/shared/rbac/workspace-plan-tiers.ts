export const WORKSPACE_PLAN_TIER_VALUES = ["starter", "growth", "enterprise"] as const;

export type WorkspacePlanTier = (typeof WORKSPACE_PLAN_TIER_VALUES)[number];

export type WorkspacePlanTierLimits = {
  tier: WorkspacePlanTier;
  maxActiveTours: number | null;
  maxUsers: number | null;
};

export const WORKSPACE_PLAN_TIER_DEFAULTS: Readonly<
  Record<WorkspacePlanTier, Omit<WorkspacePlanTierLimits, "tier">>
> = {
  starter: { maxActiveTours: 5, maxUsers: 10 },
  growth: { maxActiveTours: 25, maxUsers: 50 },
  enterprise: { maxActiveTours: null, maxUsers: null },
};

export const DEFAULT_WORKSPACE_PLAN_TIER: WorkspacePlanTier = "starter";

export function tryParseWorkspacePlanTier(raw: unknown): WorkspacePlanTier | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const key = raw.trim().toLowerCase();
  return (WORKSPACE_PLAN_TIER_VALUES as readonly string[]).includes(key)
    ? (key as WorkspacePlanTier)
    : undefined;
}

export function resolveWorkspacePlanTierLimits(input: {
  planTier?: string | null;
  maxActiveTours?: string | number | null;
  maxUsers?: string | number | null;
}): WorkspacePlanTierLimits {
  const tier = tryParseWorkspacePlanTier(input.planTier) ?? DEFAULT_WORKSPACE_PLAN_TIER;
  const defaults = WORKSPACE_PLAN_TIER_DEFAULTS[tier];
  const maxActiveTours =
    input.maxActiveTours != null && String(input.maxActiveTours).trim() !== ""
      ? Number(input.maxActiveTours)
      : defaults.maxActiveTours;
  const maxUsers =
    input.maxUsers != null && String(input.maxUsers).trim() !== ""
      ? Number(input.maxUsers)
      : defaults.maxUsers;
  return {
    tier,
    maxActiveTours: Number.isFinite(maxActiveTours as number) ? (maxActiveTours as number) : null,
    maxUsers: Number.isFinite(maxUsers as number) ? (maxUsers as number) : null,
  };
}
