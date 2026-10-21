/**
 * DP-2 — tour operational roster service (composed projection).
 */
import {
  filterOperationalRosterRows,
  summarizeOperationalRosterCapacity,
  type OperationalRosterListQuery,
  type OperationalRosterListResponse,
  type OperationalRosterTransportParticipant,
} from "@app-tour/workspace-denali/roster";
import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import { resolveFinanceServiceForTenant } from "../boot/lazy-finance-service.ts";
import { listBookings } from "../bookings/create-bookings-service.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import { HostBookingTourCapacityAdapter } from "../bookings/infrastructure/host-booking-tour-capacity.adapter.ts";
import { getPaymentHoldRepository } from "../finance/payment-hold.repository.ts";
import { enrichOperationalRosterRowsBudgetSafe } from "./operational-roster-enrichment.ts";

function toFinanceAuth(auth: BookingActorContext): FinanceActorContext {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    role: auth.role,
    status: auth.status,
    workspaceId: `ws-${auth.tenantId}`,
  };
}

export async function listTourOperationalRoster(
  auth: BookingActorContext,
  tourId: string,
  query: OperationalRosterListQuery
): Promise<OperationalRosterListResponse> {
  const normalizedTourId = tourId.trim();
  const status = query.filter === "waitlist" ? ("waitlisted" as const) : ("approved" as const);
  const bookings = query.countOnly
    ? await listAllTourBookings(auth, normalizedTourId, status)
    : await listBookings(auth, {
        view: "ops",
        tourId: normalizedTourId,
        status,
        limit: query.limit,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        sort: "submittedAt",
      });

  const finance = await resolveFinanceServiceForTenant(auth.tenantId);
  const financeAuth = toFinanceAuth(auth);
  const holdRepo = getPaymentHoldRepository();
  const nowIso = new Date().toISOString();

  const composed = await enrichOperationalRosterRowsBudgetSafe(
    auth,
    bookings.items,
    { finance, financeAuth, holdRepo },
    nowIso
  );

  const filtered = filterOperationalRosterRows({
    rows: composed,
    filter: query.filter,
    ...(query.transportKind !== undefined ? { transportKind: query.transportKind } : {}),
    nowIso,
  });

  const capacitySnapshot = query.includeCapacitySummary
    ? await resolveCapacitySummary(auth, normalizedTourId)
    : undefined;

  return {
    tourId: normalizedTourId,
    filter: query.filter,
    items: query.countOnly ? [] : filtered,
    total: filtered.length,
    nextCursor: query.countOnly ? null : bookings.nextCursor,
    ...(capacitySnapshot !== undefined
      ? {
          capacitySummary: capacitySnapshot.summary,
          transportParticipants: capacitySnapshot.transportParticipants,
        }
      : {}),
  };
}

async function resolveCapacitySummary(
  auth: BookingActorContext,
  tourId: string
): Promise<{
  readonly summary: Awaited<ReturnType<typeof summarizeOperationalRosterCapacity>>;
  readonly transportParticipants: readonly OperationalRosterTransportParticipant[];
}> {
  const items: Array<Awaited<ReturnType<typeof listBookings>>["items"][number]> = [];
  let cursor: string | undefined;
  do {
    const page = await listBookings(auth, {
      view: "ops",
      tourId,
      statuses: ["pending", "approved", "waitlisted"],
      limit: 100,
      ...(cursor !== undefined ? { cursor } : {}),
      sort: "submittedAt",
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  const capacityMax = await new HostBookingTourCapacityAdapter().resolveTourCapacityMax(
    auth.tenantId,
    tourId
  );
  const summary = summarizeOperationalRosterCapacity({
    capacityMax,
    bookings: items.map((item) => ({
      partySize: item.partySize,
      status: item.status,
      transportKind: item.transportKind,
      personalCarOccupants: item.personalCarOccupants,
    })),
  });
  return {
    summary,
    transportParticipants: items
      .filter((item) => item.status === "approved")
      .map((item) => ({
        registrationId: item.id,
        guestLabel: item.guestLabel,
        partySize: item.partySize,
        transportKind: item.transportKind,
        personalCarOccupants: item.personalCarOccupants,
      })),
  };
}

async function listAllTourBookings(
  auth: BookingActorContext,
  tourId: string,
  status: "approved" | "waitlisted"
): Promise<Awaited<ReturnType<typeof listBookings>>> {
  const items: Array<Awaited<ReturnType<typeof listBookings>>["items"][number]> = [];
  let cursor: string | undefined;

  do {
    const page = await listBookings(auth, {
      view: "ops",
      tourId,
      status,
      limit: 100,
      ...(cursor !== undefined ? { cursor } : {}),
      sort: "submittedAt",
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  return { items, total: items.length, nextCursor: null };
}
