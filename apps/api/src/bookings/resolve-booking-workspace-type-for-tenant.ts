/**
 * Phase B1.5 / B2.1 — tenant → workspaceType for Booking composition.
 * Fail-closed on unsupported / unknown workspace types (no Denali silent fallback).
 */

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { BookingWorkspaceUnsupportedError } from "./bookings.errors";
import { isBookingSupportedWorkspace } from "./workspace-booking-bindings.generated";

/**
 * Resolve workspaceType for Booking capability composition.
 * @throws {@link BookingWorkspaceUnsupportedError} when tenantId is empty,
 *   workspaceType is empty/unknown, or workspaceType is not booking-supported.
 */
export async function resolveBookingWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) {
    throw new BookingWorkspaceUnsupportedError("tenantId is required");
  }
  const raw = await resolveWorkspaceTypeForTenant(trimmed);
  const workspaceType = raw.trim().toLowerCase();
  if (workspaceType.length === 0) {
    throw new BookingWorkspaceUnsupportedError("workspaceType is empty");
  }
  if (!isBookingSupportedWorkspace(workspaceType)) {
    throw new BookingWorkspaceUnsupportedError(`workspaceType=${workspaceType}`);
  }
  return workspaceType;
}
