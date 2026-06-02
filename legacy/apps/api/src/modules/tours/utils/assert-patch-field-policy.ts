import { ForbiddenException } from "@nestjs/common";
import {
  tryParseWorkspaceRole,
  type CapabilityGrantContext,
} from "@repo/shared";
import type { TourPatchViewerRole } from "@repo/types";

import type { UserRole } from "../../../common/auth/user-role.enum";
import {
  canPerformAdministrativeAction,
  isWorkspaceLeader,
  isWorkspaceMember,
  isWorkspaceViewer,
} from "../../../common/rbac/workspace-access.helper";
import type { UpdateTourDto } from "../dto/update-tour.dto";
import {
  getForbiddenTourPatchDtoKeysForPatchContext,
  type TourPatchDtoKey,
} from "./tour-patch-field-policy";

export const TOUR_PATCH_FIELD_FORBIDDEN = "TOUR_PATCH_FIELD_FORBIDDEN" as const;

/** Maps workspace membership role to Edit RBAC viewer rank (parity with `normalizeFieldUserRole`). */
export function workspaceRoleToTourPatchViewerRole(role: string): TourPatchViewerRole | null {
  const parsed = tryParseWorkspaceRole(role);
  if (!parsed) {
    return null;
  }
  if (canPerformAdministrativeAction(parsed)) {
    return "admin";
  }
  if (isWorkspaceLeader(parsed)) {
    return "leader";
  }
  if (isWorkspaceMember(parsed)) {
    return "member";
  }
  if (isWorkspaceViewer(parsed)) {
    return "guest";
  }
  return null;
}

function presentPatchDtoKeys(dto: UpdateTourDto): string[] {
  return (Object.keys(dto) as (keyof UpdateTourDto)[]).filter((key) => dto[key] !== undefined);
}

/**
 * Rejects PATCH bodies that include DTO keys the actor may not edit (capability + rank).
 * Aligns with `TOUR_PATCH_FIELD_POLICY_RULES` and `@repo/shared` tour capabilities.
 */
export function assertPatchFieldsAllowedForWorkspaceRole(
  workspaceRole: UserRole | string | null,
  dto: UpdateTourDto,
  capabilityContext?: CapabilityGrantContext,
): void {
  const viewerRole = workspaceRoleToTourPatchViewerRole(workspaceRole ?? "");
  if (!viewerRole) {
    throw new ForbiddenException({
      error: {
        code: "AUTH_FORBIDDEN_ROLE",
        message: "Insufficient role for this operation",
      },
    });
  }

  const grantContext: CapabilityGrantContext = capabilityContext ?? {
    role: workspaceRole ?? "",
  };

  const forbidden = getForbiddenTourPatchDtoKeysForPatchContext(
    viewerRole,
    grantContext,
    presentPatchDtoKeys(dto),
  ) as TourPatchDtoKey[];
  if (forbidden.length === 0) {
    return;
  }

  throw new ForbiddenException({
    error: {
      code: TOUR_PATCH_FIELD_FORBIDDEN,
      message: `PATCH forbidden for role on fields: ${forbidden.join(", ")}`,
      fields: forbidden,
    },
  });
}
