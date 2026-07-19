/**
 * Booking ops UI capability contract (Phase B1.6).
 *
 * Workspace packages supply concrete defaults via `workspaceBooking.opsManifest`.
 * Generic web depends on this capability type only — never on Denali (or any workspace)
 * bookings ops modules. Resolve through generated bindings.
 */
import type { RegistrationOpsManifest } from "@app-tour/workspace-sdk";

/** UI metadata only — views / columns / actions / filters / KPIs. */
export type BookingOpsCapability = RegistrationOpsManifest;
