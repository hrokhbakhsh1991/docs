/**
 * Booking ops UI capability contract (Phase B1.6 / Thin Shell 4bf).
 *
 * Workspace packages dual-publish: packaging via `workspaceBooking.opsManifest`
 * (manifest) and runtime via `capabilities.bookingOps.resolveManifest`.
 * Generic web depends on this type only — never on product workspace bookings modules.
 */
import type { RegistrationOpsManifest } from "@app-tour/workspace-sdk";

/** UI metadata only — views / columns / actions / filters / KPIs. */
export type BookingOpsCapability = RegistrationOpsManifest;
