/**
 * Booking-ws2 workspace plugin — product-capable Booking second workspace (B1.3).
 * Distinct capacity policy (CASE_A reject); included in API/web plugin registries.
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import {
  DEFAULT_BOOKING_OPS_MANIFEST,
  resolveBookingOpsManifestFromTheme,
} from "./bookings/ops-manifest";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const bookingWs2WorkspacePlugin = Object.freeze({
  ...base,
  id: "booking-ws2",
  supportedWorkspaceTypes: Object.freeze(["booking-ws2"] as const),
  capabilities: Object.freeze({
    bookingOps: Object.freeze({
      resolveManifest: (theme: unknown = null) =>
        theme === null || theme === undefined
          ? DEFAULT_BOOKING_OPS_MANIFEST
          : resolveBookingOpsManifestFromTheme(theme),
    }),
  }),
}) as WorkspacePlugin;

export function getBookingWs2WorkspacePlugin(): WorkspacePlugin {
  return bookingWs2WorkspacePlugin;
}

/** Canonical host-contract getter (manifest plugin/web.export; Phase 4p). */
export function getWorkspacePlugin(): WorkspacePlugin {
  return getBookingWs2WorkspacePlugin();
}
