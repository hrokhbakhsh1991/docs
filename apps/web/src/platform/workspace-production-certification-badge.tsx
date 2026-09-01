import {
  OPERATOR_SUCCESS_BADGE_CLASS,
  OPERATOR_WARNING_BADGE_CLASS,
} from "@/admin/patterns/operator-semantic-surfaces";
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
      className={certified ? OPERATOR_SUCCESS_BADGE_CLASS : OPERATOR_WARNING_BADGE_CLASS}
      data-testid="workspace-production-certification-badge"
      data-production-tier={tier}
    >
      {workspaceProductionTierLabel(tier)}
    </span>
  );
}
