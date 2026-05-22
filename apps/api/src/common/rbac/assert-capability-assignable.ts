import {
  MODULE_CAPABILITIES,
  normalizeProductCapabilityId,
  parseMembershipMetadata,
  partitionMembershipCapabilityTokens,
  resolveEffectiveCapabilities,
  tryParseWorkspaceRole,
  WORKSPACE_CAPABILITY_VALUES,
  WorkspaceRole,
  type CapabilityGrantContext,
  type WorkspaceCapability,
} from "@repo/shared";

export const RBAC_CAPABILITY_ASSIGN_FORBIDDEN = "RBAC_CAPABILITY_ASSIGN_FORBIDDEN";
export const RBAC_CAPABILITY_UNKNOWN = "RBAC_CAPABILITY_UNKNOWN";
export const RBAC_CAPABILITY_REGIONAL_SCOPE_INVALID = "RBAC_CAPABILITY_REGIONAL_SCOPE_INVALID";
export const RBAC_PROTECTED_MEMBERSHIP_CAPABILITIES = "RBAC_PROTECTED_MEMBERSHIP_CAPABILITIES";

const MODULE_CAPABILITY_SET = new Set<string>(MODULE_CAPABILITIES);

const OWNER_ONLY_TARGET_CAPABILITIES = new Set<WorkspaceCapability>([
  "module.finance",
  "module.form_builder",
  "settings.themes.manage",
]);

export type CapabilityAssignablePayload = {
  capabilities: readonly string[];
  allowedRegionIds?: readonly string[];
};

export type CapabilityAssignableDecision =
  | { ok: true; normalizedCapabilities: WorkspaceCapability[]; allowedRegionIds: string[] }
  | { ok: false; code: string; message: string };

function normalizeCapabilityList(raw: readonly string[]): {
  capabilities: WorkspaceCapability[];
  unknown: string[];
} {
  const capabilities: WorkspaceCapability[] = [];
  const unknown: string[] = [];
  for (const item of raw) {
    const normalized = normalizeProductCapabilityId(item);
    if (normalized) {
      capabilities.push(normalized);
    } else if (item.trim() !== "") {
      unknown.push(item.trim());
    }
  }
  return {
    capabilities: [...new Set(capabilities)].sort((a, b) => a.localeCompare(b)),
    unknown,
  };
}

function isLowPrivilegeTargetRole(role: string): boolean {
  const parsed = tryParseWorkspaceRole(role);
  return parsed === WorkspaceRole.Member || parsed === WorkspaceRole.Viewer;
}

/**
 * Validates membership capability assignment (Phase 6.2).
 * Caller must enforce Owner/Admin route role separately.
 */
export function assertCapabilityAssignable(input: {
  actorGrantContext: CapabilityGrantContext;
  targetRole: string;
  payload: CapabilityAssignablePayload;
}): CapabilityAssignableDecision {
  const { capabilities, unknown } = normalizeCapabilityList(input.payload.capabilities);
  if (unknown.length > 0) {
    return {
      ok: false,
      code: RBAC_CAPABILITY_UNKNOWN,
      message: `Unknown capabilities: ${unknown.join(", ")}`,
    };
  }

  const invalidRegistered = capabilities.filter(
    (c) => !(WORKSPACE_CAPABILITY_VALUES as readonly string[]).includes(c),
  );
  if (invalidRegistered.length > 0) {
    return {
      ok: false,
      code: RBAC_CAPABILITY_UNKNOWN,
      message: `Unsupported capabilities: ${invalidRegistered.join(", ")}`,
    };
  }

  const targetNorm = tryParseWorkspaceRole(input.targetRole);
  if (targetNorm === WorkspaceRole.Owner) {
    return {
      ok: false,
      code: RBAC_PROTECTED_MEMBERSHIP_CAPABILITIES,
      message: "Workspace owner membership capabilities cannot be modified on this endpoint",
    };
  }

  const actorRole = tryParseWorkspaceRole(input.actorGrantContext.role);
  const actorEffective = new Set(resolveEffectiveCapabilities(input.actorGrantContext));
  const actorIsOwner = actorRole === WorkspaceRole.Owner;

  for (const cap of capabilities) {
    if (!actorIsOwner && !actorEffective.has(cap)) {
      return {
        ok: false,
        code: RBAC_CAPABILITY_ASSIGN_FORBIDDEN,
        message: `You cannot assign capability you do not have: ${cap}`,
      };
    }

    if (
      !actorIsOwner &&
      isLowPrivilegeTargetRole(input.targetRole) &&
      OWNER_ONLY_TARGET_CAPABILITIES.has(cap)
    ) {
      return {
        ok: false,
        code: RBAC_CAPABILITY_ASSIGN_FORBIDDEN,
        message: `Capability ${cap} cannot be assigned to member/viewer unless assigner is owner`,
      };
    }

    if (MODULE_CAPABILITY_SET.has(cap)) {
      const tenantModules = input.actorGrantContext.tenantModules ?? [];
      const moduleId = cap === "module.finance" ? "finance" : "form_builder";
      if (!tenantModules.includes(moduleId)) {
        return {
          ok: false,
          code: RBAC_CAPABILITY_ASSIGN_FORBIDDEN,
          message: `Tenant module ${moduleId} is not enabled`,
        };
      }
    }
  }

  const hasRegional = capabilities.includes("tour.regional.manage");
  const allowedRegionIds = (input.payload.allowedRegionIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (hasRegional && allowedRegionIds.length === 0) {
    return {
      ok: false,
      code: RBAC_CAPABILITY_REGIONAL_SCOPE_INVALID,
      message: "allowedRegionIds is required when tour.regional.manage is granted",
    };
  }

  if (hasRegional && !actorIsOwner) {
    const actorMeta = parseMembershipMetadata(input.actorGrantContext.membershipMetadata);
    const actorRegional = actorEffective.has("tour.regional.manage");
    if (actorRegional) {
      const actorRegions = new Set(actorMeta.allowedRegionIds ?? []);
      const outOfScope = allowedRegionIds.filter((id) => !actorRegions.has(id));
      if (outOfScope.length > 0) {
        return {
          ok: false,
          code: RBAC_CAPABILITY_REGIONAL_SCOPE_INVALID,
          message: "allowedRegionIds must be a subset of your regional scope",
        };
      }
    }
  }

  if (!hasRegional && allowedRegionIds.length > 0) {
    return {
      ok: false,
      code: RBAC_CAPABILITY_REGIONAL_SCOPE_INVALID,
      message: "allowedRegionIds is only valid when tour.regional.manage is granted",
    };
  }

  return {
    ok: true,
    normalizedCapabilities: capabilities,
    allowedRegionIds: hasRegional ? allowedRegionIds : [],
  };
}

export function buildMembershipMetadataFromAssignment(
  existing: Record<string, unknown> | null | undefined,
  assignment: { normalizedCapabilities: WorkspaceCapability[]; allowedRegionIds: string[] },
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  const next: Record<string, unknown> = { ...base };
  const existingMeta = parseMembershipMetadata(base);
  const { micro } = partitionMembershipCapabilityTokens(existingMeta.capabilities);
  const mergedCapabilities = [...micro, ...assignment.normalizedCapabilities];
  if (mergedCapabilities.length > 0) {
    next.capabilities = mergedCapabilities;
  } else {
    delete next.capabilities;
  }
  if (assignment.allowedRegionIds.length > 0) {
    next.allowedRegionIds = assignment.allowedRegionIds;
  } else {
    delete next.allowedRegionIds;
  }
  return next;
}
