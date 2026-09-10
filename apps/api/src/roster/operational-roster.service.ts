/**
 * DP-2 — tour operational roster service (composed projection).
 */
import {
  composeTourOperationalRosterRow,
  filterOperationalRosterRows,
  type OperationalRosterListQuery,
  type OperationalRosterListResponse,
} from "@app-tour/workspace-denali/roster";
import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import { resolveFinanceServiceForTenant } from "../boot/lazy-finance-service.ts";
import { listBookings } from "../bookings/create-bookings-service.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import { getPaymentHoldRepository } from "../finance/payment-hold.repository.ts";

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
  const bookings = await listBookings(auth, {
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

  // Keep the finance projection within the tenant DB semaphore. A roster can contain many
  // approved bookings, and fan-out here would start two finance reads per row concurrently;
  // with the production default of four tenant DB operations that turns a normal roster load
  // into TENANT_DB_BUDGET_EXCEEDED instead of a usable response.
  const composed = [] as Awaited<ReturnType<typeof composeTourOperationalRosterRow>>[];
  for (const booking of bookings.items) {
    let invoice: {
      readonly remainingMinor: string;
      readonly paidAmountMinor: string;
      readonly invoiceTotalMinor: string;
      readonly currency: string;
    } | null = null;
    let refundStatuses: string[] = [];
    try {
      const compiled = await finance.getRegistrationInvoice(financeAuth, booking.id);
      invoice = {
        remainingMinor: compiled.remainingMinor,
        paidAmountMinor: compiled.paidAmountMinor,
        invoiceTotalMinor: compiled.invoiceTotalMinor,
        currency: compiled.currency,
      };
      const refunds = await finance.listRefundsForRegistration(financeAuth, booking.id);
      refundStatuses = refunds.map((row) => row.status);
    } catch {
      invoice = null;
      refundStatuses = [];
    }

    const hold = await holdRepo.getByRegistrationId(auth.tenantId, booking.id);
    composed.push(
      composeTourOperationalRosterRow({
        booking,
        invoice,
        hold:
          hold !== null
            ? {
                status: hold.status,
                dueAt: hold.dueAt,
              }
            : null,
        refundStatuses,
        nowIso,
      })
    );
  }

  const filtered = filterOperationalRosterRows({
    rows: composed,
    filter: query.filter,
    ...(query.transportKind !== undefined ? { transportKind: query.transportKind } : {}),
    nowIso,
  });

  return {
    tourId: normalizedTourId,
    filter: query.filter,
    items: filtered,
    total: filtered.length,
    nextCursor: bookings.nextCursor,
  };
}
