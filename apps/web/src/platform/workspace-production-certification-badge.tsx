import type { WorkspaceProductionTier } from "./resolve-workspace-production-tier";

export type WorkspaceProductionCertificationBadgeProps = {
  readonly tier: WorkspaceProductionTier;
};

export function workspaceProductionTierLabel(tier: WorkspaceProductionTier): string {
  return tier === "certified" ? "Certified" : "Stub";
}

/**
 * Phase H4 — Super Admin production certification badge (manifest-derived tier).
 */
export function WorkspaceProductionCertificationBadge({
  tier,
}: WorkspaceProductionCertificationBadgeProps) {
  const certified = tier === "certified";
  return (
    <span
      className={
        certified
          ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
          : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800"
      }
      data-testid="workspace-production-certification-badge"
      data-production-tier={tier}
    >
      {workspaceProductionTierLabel(tier)}
    </span>
  );
}
