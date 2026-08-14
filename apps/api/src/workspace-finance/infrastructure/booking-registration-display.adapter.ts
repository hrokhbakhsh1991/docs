import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import type {
  FinanceRegistrationDisplay,
  RegistrationDisplayPort,
} from "../ports/registration-display.port";

/**
 * Infrastructure adapter — maps Booking list identity fields into finance display DTO.
 * `guestLabel` → `memberDisplayName` (API contract unchanged).
 * Bookings port must be injected (no silent getBookingsRepository — TODO-008).
 */
export class BookingRegistrationDisplayAdapter implements RegistrationDisplayPort {
  constructor(private readonly bookings: BookingRepositoryPort) {}

  async getByRegistrationIds(
    tenantId: string,
    registrationIds: readonly string[]
  ): Promise<ReadonlyMap<string, FinanceRegistrationDisplay>> {
    const unique = [
      ...new Set(registrationIds.map((id) => id.trim()).filter((id) => id.length > 0)),
    ];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.bookings.getByIds(unique, tenantId.trim());
    const map = new Map<string, FinanceRegistrationDisplay>();
    for (const booking of rows) {
      map.set(booking.id, {
        registrationId: booking.id,
        tourId: booking.tourId,
        tourTitle: booking.tourTitle,
        memberDisplayName: booking.guestLabel,
      });
    }
    return map;
  }

  async listRegistrationIdsByTourId(
    tenantId: string,
    tourId: string
  ): Promise<readonly string[]> {
    const trimmedTenant = tenantId.trim();
    const trimmedTour = tourId.trim();
    if (trimmedTenant.length === 0 || trimmedTour.length === 0) {
      return [];
    }
    const ids: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.bookings.listByTenantPage({
        tenantId: trimmedTenant,
        tourId: trimmedTour,
        limit: 200,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      for (const booking of page.items) {
        ids.push(booking.id);
      }
      if (page.nextCursor === null || page.nextCursor.length === 0) {
        break;
      }
      cursor = page.nextCursor;
    }
    return ids;
  }
}
