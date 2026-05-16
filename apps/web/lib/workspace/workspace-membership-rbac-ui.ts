/**
 * UI hints for workspace role PATCH options (must mirror backend policy in
 * `apps/api/src/common/rbac/workspace-membership-rbac.policy.ts`). Security is enforced server-side.
 */
import { ROLE_RANK, tryParseWorkspaceRole, WorkspaceRole } from "@repo/shared";

const RANK = ROLE_RANK;

const PATCH_NEW_ROLES: readonly WorkspaceRole[] = [
  WorkspaceRole.Leader,
  WorkspaceRole.Admin,
  WorkspaceRole.Member,
  WorkspaceRole.Viewer
];

export type WorkspacePatchRoleChangeInput = {
  actorUserId: string;
  actorRole: string | undefined;
  targetUserId: string;
  targetRole: string | undefined;
};

type WorkspacePatchGateBlockedReason =
  | "self"
  | "owner_target"
  | "unknown_role"
  | "insufficient_rank";

type WorkspacePatchGateResult =
  | { ok: true; actorRank: number }
  | { ok: false; reason: WorkspacePatchGateBlockedReason };

function evaluateWorkspacePatchGate(input: WorkspacePatchRoleChangeInput): WorkspacePatchGateResult {
  if (input.actorUserId.trim() === input.targetUserId.trim()) {
    return { ok: false, reason: "self" };
  }
  const actor = tryParseWorkspaceRole(input.actorRole);
  const target = tryParseWorkspaceRole(input.targetRole);
  if (!actor || !target) {
    return { ok: false, reason: "unknown_role" };
  }
  if (target === WorkspaceRole.Owner) {
    return { ok: false, reason: "owner_target" };
  }
  const actorRank = RANK[actor];
  const targetRank = RANK[target];
  if (actorRank === undefined || targetRank === undefined) {
    return { ok: false, reason: "unknown_role" };
  }
  if (actorRank <= targetRank) {
    return { ok: false, reason: "insufficient_rank" };
  }
  return { ok: true, actorRank };
}

function computeSelectablePatchRoles(actorRank: number): WorkspaceRole[] {
  const out: WorkspaceRole[] = [];
  for (const r of PATCH_NEW_ROLES) {
    const newRank = RANK[r];
    if (newRank !== undefined && actorRank > newRank) {
      out.push(r);
    }
  }
  return out;
}

export type WorkspaceRoleSelectUiHintKey =
  | WorkspacePatchGateBlockedReason
  | "no_alternative_role";

export type WorkspaceRoleSelectUiResolution = {
  optionValues: readonly string[];
  assignableOtherThanCurrent: readonly string[];
  /** True when there is no role change available without mutation in flight. */
  disabledWithoutMutation: boolean;
  /** Explains why the control is locked when {@link disabledWithoutMutation} is true; null when changes are allowed. */
  hintKey: WorkspaceRoleSelectUiHintKey | null;
};

/**
 * Single UI-facing resolution for the directory row role `<Select>` from the same PATCH gate logic.
 * Does not know about mutation pending — compose that in the component.
 */
export function resolveWorkspaceRoleSelectUi(
  input: WorkspacePatchRoleChangeInput & { normalizedCurrentRole: string }
): WorkspaceRoleSelectUiResolution {
  const gate = evaluateWorkspacePatchGate(input);
  const rawSelectable = gate.ok ? computeSelectablePatchRoles(gate.actorRank) : [];
  const currentParsed = tryParseWorkspaceRole(input.normalizedCurrentRole);
  const assignableOtherThanCurrent = rawSelectable.filter(
    (r) => String(r) !== String(currentParsed ?? input.normalizedCurrentRole)
  );
  const optionValues = Array.from(
    new Set([input.normalizedCurrentRole, ...rawSelectable.map((r) => String(r))])
  );

  let hintKey: WorkspaceRoleSelectUiHintKey | null = null;
  if (!gate.ok) {
    hintKey = gate.reason;
  } else if (assignableOtherThanCurrent.length === 0) {
    hintKey = "no_alternative_role";
  }

  return {
    optionValues,
    assignableOtherThanCurrent: assignableOtherThanCurrent.map(String),
    disabledWithoutMutation: assignableOtherThanCurrent.length === 0,
    hintKey
  };
}
