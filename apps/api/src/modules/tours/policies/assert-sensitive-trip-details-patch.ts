import { ForbiddenException } from "@nestjs/common";
import type { AppAbility } from "@repo/shared";
import {
  listSensitiveTripDetailsPathsFromPatch,
  parseMembershipMetadata,
  tryParseWorkspaceRole,
  WorkspaceRole,
} from "@repo/shared";

import { AbilityAction } from "../../../common/casl/ability-actions";
import type { UpdateTourDto } from "../dto/update-tour.dto";

function forbidSensitiveTripDetails(paths: readonly string[]): never {
  throw new ForbiddenException({
    error: {
      code: "AUTH_FORBIDDEN_SENSITIVE_TRIP_DETAILS",
      message: `Insufficient permissions for sensitive tripDetails paths: ${paths.join(", ")}`,
    },
  });
}

/**
 * Phase 8.1 — per-field gate for high-risk tripDetails slices after coarse TourTripDetails check.
 */
export function assertSensitiveTripDetailsPatch(
  ability: AppAbility,
  dto: UpdateTourDto,
  context: {
    role: string | null;
    membershipMetadata?: unknown;
    tenantModules?: readonly string[] | null;
  },
): void {
  if (dto.tripDetails === undefined || dto.tripDetails === null) {
    return;
  }

  const sensitivePaths = listSensitiveTripDetailsPathsFromPatch(dto.tripDetails);
  if (sensitivePaths.length === 0) {
    return;
  }

  if (ability.can(AbilityAction.Update, "TourTripDetailsSensitive")) {
    return;
  }

  const role = tryParseWorkspaceRole(context.role ?? "");
  if (
    role === WorkspaceRole.Owner ||
    role === WorkspaceRole.Admin ||
    role === WorkspaceRole.Leader
  ) {
    return;
  }

  const meta = parseMembershipMetadata(context.membershipMetadata);
  if ((meta.capabilities ?? []).some((c) => c.trim() === "tour.form.architect")) {
    return;
  }

  if ((context.tenantModules ?? []).includes("form_builder")) {
    return;
  }

  forbidSensitiveTripDetails(sensitivePaths);
}
