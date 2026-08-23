/**
 * Phase B1.5 / B2.1 — tenant → workspaceType for Booking composition.
 * Fail-closed on unsupported / unknown workspace types (no product silent fallback).
 */

import {
  isWorkspaceTypeUnresolvedError,
  resolveWorkspaceTypeForTenant,
  WORKSPACE_TYPE_UNRESOLVED,
} from "../tenant/resolve-workspace-type";
import { BookingWorkspaceUnsupportedError } from "./bookings.errors";
import { isBookingSupportedWorkspace } from "./workspace-booking-bindings.generated";

/**
 * Resolve workspaceType for Booking capability composition.
 * @throws {@link BookingWorkspaceUnsupportedError} when tenantId is empty,
 *   workspace type is unresolved/empty/unknown, or workspaceType is not booking-supported.
 */
export async function resolveBookingWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) {
    throw new BookingWorkspaceUnsupportedError("tenantId is required");
  }
  let raw: string;
  try {
    raw = await resolveWorkspaceTypeForTenant(trimmed);
  } catch (error: unknown) {
    if (isWorkspaceTypeUnresolvedError(error)) {
      // Preserve Booking domain boundary — never leak platform WORKSPACE_TYPE_UNRESOLVED as HTTP 500.
      throw new BookingWorkspaceUnsupportedError(WORKSPACE_TYPE_UNRESOLVED);
    }
    throw error;
  }
  const workspaceType = raw.trim().toLowerCase();
  if (workspaceType.length === 0) {
    throw new BookingWorkspaceUnsupportedError("workspaceType is empty");
  }
  if (!isBookingSupportedWorkspace(workspaceType)) {
    throw new BookingWorkspaceUnsupportedError(`workspaceType=${workspaceType}`);
  }
  return workspaceType;
}
