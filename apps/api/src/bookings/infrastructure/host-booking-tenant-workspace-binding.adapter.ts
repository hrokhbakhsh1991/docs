/**
 * Host binding — tenantId → workspaceType must equal the BookingRuntime workspaceType.
 */
import {
  BookingWorkspaceTenantMismatchError,
  BookingWorkspaceUnsupportedError,
} from "../bookings.errors";
import type { BookingTenantWorkspaceBindingPort } from "../ports/booking-tenant-workspace-binding.port";
import { resolveBookingWorkspaceTypeForTenant } from "../resolve-booking-workspace-type-for-tenant";

export class HostBookingTenantWorkspaceBindingAdapter implements BookingTenantWorkspaceBindingPort {
  async assertTenantBoundToRuntime(
    tenantId: string,
    runtimeWorkspaceType: string
  ): Promise<void> {
    const expectedRuntime = runtimeWorkspaceType.trim().toLowerCase();
    if (expectedRuntime.length === 0) {
      throw new BookingWorkspaceUnsupportedError("runtimeWorkspaceType is required");
    }
    let owned: string;
    try {
      owned = await resolveBookingWorkspaceTypeForTenant(tenantId);
    } catch (error: unknown) {
      if (error instanceof BookingWorkspaceUnsupportedError) {
        throw error;
      }
      throw error;
    }
    if (owned !== expectedRuntime) {
      throw new BookingWorkspaceTenantMismatchError({
        tenantId: tenantId.trim(),
        runtimeWorkspaceType: expectedRuntime,
        tenantWorkspaceType: owned,
      });
    }
  }
}
