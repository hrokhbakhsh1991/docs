/**
 * Phase B1.5 — tenant → workspaceType for Booking composition.
 * Unregistered workspace types fall back to denali (preserve pre-B1.5 behavior).
 */

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { isBookingDependencyBindingRegistered } from "./booking-dependency-registry";

/** Boot / fallback when tenant workspace is not booking-registered. */
export const BOOT_BOOKING_WORKSPACE_TYPE = "denali";

/**
 * Resolve workspaceType for Booking dependency composition.
 * @throws `BOOKING_WORKSPACE_UNSUPPORTED` when tenantId is empty.
 */
export async function resolveBookingWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) {
    throw new Error("BOOKING_WORKSPACE_UNSUPPORTED: tenantId is required");
  }
  const raw = await resolveWorkspaceTypeForTenant(trimmed);
  const workspaceType = raw.trim().toLowerCase();
  if (workspaceType.length > 0 && isBookingDependencyBindingRegistered(workspaceType)) {
    return workspaceType;
  }
  return BOOT_BOOKING_WORKSPACE_TYPE;
}
