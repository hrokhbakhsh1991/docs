function envFlagEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Leader dashboard data-source switch.
 * Prefer `NEXT_PUBLIC_` variant for client components; non-public variant is
 * also checked to support build-time toggling in some environments.
 */
export function leaderDashboardUseAggregateApi(): boolean {
  return (
    envFlagEnabled(process.env.NEXT_PUBLIC_LEADER_DASHBOARD_USE_AGGREGATE_API) ||
    envFlagEnabled(process.env.LEADER_DASHBOARD_USE_AGGREGATE_API)
  );
}

