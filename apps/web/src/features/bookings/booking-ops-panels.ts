/**
 * Booking **ops UI** capability resolution — metadata only (Phase B1.6).
 * Ops SoT: workspace `workspaceBooking.opsManifest` → generated bindings.
 *
 * Generic web depends on {@link BookingOpsCapability} only — never imports workspace packages.
 */
import {
  hasBookingOpsManifest,
  resolveWorkspaceBookingOpsManifest,
} from "@/bootstrap/workspace-booking-ops-bindings.generated";
import type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

export type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

/**
 * Resolve booking ops capability for the command center.
 * Unbound / missing `opsManifest` → `null` (no Denali fallback).
 */
export function resolveBookingOpsCapabilityForHub(
  theme: unknown = null,
  pluginId: string
): BookingOpsCapability | null {
  const id = pluginId.trim();
  if (id.length === 0 || !hasBookingOpsManifest(id)) {
    return null;
  }
  return resolveWorkspaceBookingOpsManifest(id, theme);
}
