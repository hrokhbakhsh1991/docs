import type { AppAbility } from "@repo/shared";

import type { UserRole } from "../../../common/auth/user-role.enum";
import type { UpdateTourDto } from "../dto/update-tour.dto";
import { assertPatchFieldsAllowedForWorkspaceRole } from "../utils/assert-patch-field-policy";
import { assertTourPatchAbilities } from "./assert-tour-mutation-abilities";
import { assertSensitiveTripDetailsPatch } from "./assert-sensitive-trip-details-patch";

export type TourPatchWritePipelineContext = {
  ability: AppAbility;
  workspaceRole: UserRole | string | null;
  dto: UpdateTourDto;
  /** Membership labels / marketing ids (optional capability aliases). */
  labels?: readonly string[] | null;
  /** Explicit capability grants from membership row (DB hydration hook). */
  capabilities?: readonly string[] | null;
  membershipMetadata?: unknown;
  tenantModules?: readonly string[] | null;
};

/**
 * Frozen tour PATCH write pipeline (Phase 5.3 — prompt.md):
 *
 * 1. CASL route guards (`@CheckAbilities`, `RolesGuard`) — before handler
 * 2. Capability check — {@link assertTourPatchAbilities}
 * 3. Patch field policy — {@link assertPatchFieldsAllowedForWorkspaceRole}
 * 4. Profile invariants + publish gates — service (`updateTour`, pre/post merge)
 * 5. Save — service persistence
 */
export function assertTourPatchWritePreMerge(ctx: TourPatchWritePipelineContext): void {
  assertTourPatchAbilities(ctx.ability, ctx.dto);

  assertPatchFieldsAllowedForWorkspaceRole(ctx.workspaceRole, ctx.dto, {
    role: ctx.workspaceRole ?? "",
    labels: ctx.labels ?? null,
    capabilities: ctx.capabilities ?? null,
  });

  assertSensitiveTripDetailsPatch(ctx.ability, ctx.dto, {
    role: ctx.workspaceRole,
    membershipMetadata: ctx.membershipMetadata,
    tenantModules: ctx.tenantModules,
  });
}
