/**
 * Booking-ws2 workspace plugin — product-capable Booking second workspace (B1.3).
 * Distinct capacity policy (CASE_A reject); included in API/web plugin registries.
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const bookingWs2WorkspacePlugin = Object.freeze({
  ...base,
  id: "booking-ws2",
  supportedWorkspaceTypes: Object.freeze(["booking-ws2"] as const),
}) as WorkspacePlugin;

export function getBookingWs2WorkspacePlugin(): WorkspacePlugin {
  return bookingWs2WorkspacePlugin;
}
