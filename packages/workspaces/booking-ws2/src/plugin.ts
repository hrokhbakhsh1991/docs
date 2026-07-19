/**
 * Minimal plugin stub — registryOnly booking fixture (not product-gated).
 * Excluded from API/web plugin registries via workspaceBooking.registryOnly.
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
