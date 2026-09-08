/**
 * DP-2 roster enrichment — DEC-055 budget-safe composition.
 *
 * Tour workspace transport + finance follow-up tabs depend on this path.
 * Page-wide parallel fan-out over bookings × Finance exceeded
 * TENANT_MAX_CONCURRENT_DB_OPS (default 4) and returned 503 on staging.
 *
 * @see docs/workspaces/denali/operational-roster.mdoc § Composition budget
 */
import {
  composeTourOperationalRosterRow,
  type TourOperationalRosterRow,
} from "@app-tour/workspace-denali/roster";
import type { BookingListItem } from "@app-tour/booking-http-contracts";
import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import { getPaymentHoldRepository } from "../finance/payment-hold.repository.ts";
import type { FinanceService } from "../workspace-finance/finance.service.ts";

type PaymentHoldRepository = ReturnType<typeof getPaymentHoldRepository>;

export type OperationalRosterEnrichmentPorts = {
  readonly finance: FinanceService;
  readonly financeAuth: FinanceActorContext;
  readonly holdRepo: PaymentHoldRepository;
};

/**
 * Enrich bookings into roster rows one registration at a time.
 * Each row loads invoice → refunds → hold sequentially (≤1 tenant DB slot).
 */
export async function enrichOperationalRosterRowsBudgetSafe(
  auth: BookingActorContext,
  bookings: readonly BookingListItem[],
  ports: OperationalRosterEnrichmentPorts,
  nowIso: string
): Promise<TourOperationalRosterRow[]> {
  const composed: TourOperationalRosterRow[] = [];

  for (const booking of bookings) {
    let invoice: {
      readonly remainingMinor: string;
      readonly paidAmountMinor: string;
      readonly invoiceTotalMinor: string;
      readonly currency: string;
    } | null = null;
    let refundStatuses: string[] = [];

    try {
      const compiled = await ports.finance.getRegistrationInvoice(
        ports.financeAuth,
        booking.id
      );
      invoice = {
        remainingMinor: compiled.remainingMinor,
        paidAmountMinor: compiled.paidAmountMinor,
        invoiceTotalMinor: compiled.invoiceTotalMinor,
        currency: compiled.currency,
      };
      const refunds = await ports.finance.listRefundsForRegistration(
        ports.financeAuth,
        booking.id
      );
      refundStatuses = refunds.map((row) => row.status);
    } catch {
      invoice = null;
      refundStatuses = [];
    }

    const hold = await ports.holdRepo.getByRegistrationId(auth.tenantId, booking.id);
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

  return composed;
}
