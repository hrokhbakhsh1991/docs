import type { ImmutableInvoice } from "../../invoicing/immutable-invoice";

export const INVOICE_READ_MODEL_PORT = Symbol("INVOICE_READ_MODEL_PORT");

/**
 * Runtime-derived invoice view — never persisted; compiled from immutable snapshot + ledger lines.
 */
export type ImmutableInvoiceSnapshot = {
  readonly tenantId: string;
  readonly bookingWalletId: string;
  readonly bookingId: string;
  readonly snapshotId: string;
  readonly currency: string;
  /** Authoritative booking-time total from {@link BookingPriceSnapshotEntity}. */
  readonly invoiceTotalMinor: string;
  /** Net prepayment credited to the booking wallet (from append-only ledger lines). */
  readonly paidAmountMinor: string;
  /** Remaining amount due: max(0, invoiceTotalMinor − paidAmountMinor). */
  readonly balanceDueMinor: string;
  readonly issuedAtIso: string;
  /** Sealed derived artifact (tamper-evident fingerprint). */
  readonly invoice: ImmutableInvoice;
};

export interface InvoiceReadModelPort {
  getDerivedInvoice(
    bookingWalletId: string,
    tenantId: string
  ): Promise<ImmutableInvoiceSnapshot>;
}
