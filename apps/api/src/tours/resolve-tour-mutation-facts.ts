import type { DenaliTourOperationalFacts } from "../workspace/denali-host-legacy-bindings.generated.ts";

import { getBookingsRepository } from "../bookings/create-bookings-repository";
import type { BookingPaymentStatus, BookingRecord } from "../bookings/bookings.types";

const ACTIVE_STATUSES = new Set(["pending", "approved", "waitlisted"]);
const PAID_STATUSES = new Set<BookingPaymentStatus>(["paid", "partial"]);

export type TourMutationFacts = DenaliTourOperationalFacts;

function aggregateTourMutationFacts(rows: readonly BookingRecord[]): TourMutationFacts {
  let activeRegistrationCount = 0;
  let approvedRegistrationCount = 0;
  let paidRegistrationCount = 0;
  let occupiedApprovedPartySize = 0;

  for (const row of rows) {
    if (!ACTIVE_STATUSES.has(row.status)) {
      continue;
    }
    activeRegistrationCount += 1;
    if (row.status === "approved") {
      approvedRegistrationCount += 1;
      occupiedApprovedPartySize += row.partySize;
      if (PAID_STATUSES.has(row.paymentStatus)) {
        paidRegistrationCount += 1;
      }
    }
  }

  return {
    activeRegistrationCount,
    approvedRegistrationCount,
    paidRegistrationCount,
    occupiedApprovedPartySize,
    hasTransportAllocations: false,
  };
}

export async function resolveTourMutationFacts(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourData?: Record<string, unknown>;
}): Promise<TourMutationFacts> {
  const repo = getBookingsRepository();
  const page = await repo.listByTenantPage({
    tenantId: input.tenantId,
    tourId: input.tourId,
    limit: 500,
  });

  const facts = aggregateTourMutationFacts(page.items);
  const transport = input.tourData?.transport;
  const allocations =
    transport !== null &&
    typeof transport === "object" &&
    !Array.isArray(transport) &&
    Array.isArray((transport as Record<string, unknown>).allocations)
      ? ((transport as Record<string, unknown>).allocations as unknown[])
      : [];

  return {
    ...facts,
    hasTransportAllocations: facts.hasTransportAllocations || allocations.length > 0,
  };
}
