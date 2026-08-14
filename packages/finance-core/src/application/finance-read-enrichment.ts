/**
 * Shared read-path helpers for finance list surfaces (exceptions, outstanding, tour rollup).
 * Behavior-neutral extraction from FinanceService.
 */
import type { RegistrationInvoiceReadModel } from "../domain/compile-invoice-balances";
import type { FinanceRegistrationContext } from "../domain/finance-registration-context";
import type { IBookingPaymentPort } from "../ports/booking-payment.port";

export type FinanceReadEnrichmentDeps = {
  readonly bookingPayments: IBookingPaymentPort;
  readonly compileRegistrationInvoice: (
    tenantId: string,
    registrationId: string
  ) => Promise<RegistrationInvoiceReadModel>;
};

export function normalizeListLimit(limitRaw: number | undefined, fallback = 50): number {
  const value = limitRaw ?? fallback;
  return Math.min(Math.max(Math.floor(value), 1), 200);
}

export function normalizeOptionalTourId(tourId: string | undefined): string | undefined {
  const normalized = tourId?.trim() ?? "";
  return normalized.length > 0 ? normalized : undefined;
}

export async function tryGetBookingPaymentStatus(
  deps: FinanceReadEnrichmentDeps,
  tenantId: string,
  registrationId: string
): Promise<"unpaid" | "partial" | "paid" | null> {
  try {
    return await deps.bookingPayments.getPaymentStatus({
      tenantId,
      registrationId,
    });
  } catch {
    return null;
  }
}

export async function tryCompileRegistrationInvoiceInternal(
  deps: FinanceReadEnrichmentDeps,
  tenantId: string,
  registrationId: string
): Promise<RegistrationInvoiceReadModel | null> {
  try {
    return await deps.compileRegistrationInvoice(tenantId, registrationId);
  } catch {
    return null;
  }
}

export async function tryGetRegistrationBalanceDueMinor(
  deps: FinanceReadEnrichmentDeps,
  tenantId: string,
  registrationId: string
): Promise<string | null> {
  const invoice = await tryCompileRegistrationInvoiceInternal(deps, tenantId, registrationId);
  return invoice?.balanceDueMinor ?? null;
}

export function attachRegistrationDisplayIdentity<
  T extends {
    readonly identity: {
      readonly memberDisplayName: string | null;
      readonly tourTitle: string | null;
      readonly tourId: string | null;
    };
  },
>(item: T, context: FinanceRegistrationContext | undefined): T {
  if (context === undefined) {
    return item;
  }
  return {
    ...item,
    identity: {
      memberDisplayName: context.memberDisplayName,
      tourTitle: context.tourTitle,
      tourId: context.tourId,
    },
  };
}
