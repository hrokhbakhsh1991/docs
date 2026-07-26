/**
 * Booking **ops UI** capability resolution — metadata only (Phase B1.6).
 * Ops SoT: capabilities.bookingOps.resolveManifest (Phase 4bf) — no generated binder.
 *
 * Generic web depends on {@link BookingOpsCapability} only — never imports workspace packages.
 */
import { resolveBookingOpsCapability } from "@app-cloud/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

export type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

/**
 * Resolve booking ops capability for the command center.
 * Unbound / missing bookingOps capability → `null` (no product fallback).
 */
export async function resolveBookingOpsCapabilityForHub(
  theme: unknown = null,
  pluginId: string
): Promise<BookingOpsCapability | null> {
  const id = pluginId.trim();
  if (id.length === 0) {
    return null;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(id);
    const bookingOps = resolveBookingOpsCapability(plugin);
    if (bookingOps == null) {
      return null;
    }
    return bookingOps.resolveManifest(theme);
  } catch {
    return null;
  }
}
