/**
 * Live Denali Case SoT reader — host repositories under tenant scope.
 * Translates storage rows into Denali Case-read DTOs only (no interpretation).
 */

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";
import {
  compileRegistrationInvoice,
  type FinancePaymentRow,
  type FinanceReceiptRow,
  type FinanceRepositoryPort,
  type RegistrationInvoiceFacts,
} from "@app-tour/finance-core";
import type {
  CaseFactReadScope,
  DenaliEvidenceSource,
  DenaliLedgerSource,
  DenaliLifecycleSource,
  DenaliObligationSource,
  DenaliPaymentRowSource,
  DenaliPaymentSource,
  DenaliSignalSource,
} from "@app-tour/workspace-denali/host/finance/case-read";

import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import type { DenaliCaseReadSourcePort } from "../case-read/denali-case-read-source.port";
import { isBookingPaidWithPositiveInvoiceRemaining } from "./booking-paid-invoice-remaining-coherence";

export type HostDenaliCaseReadFinancePort = Pick<
  FinanceRepositoryPort,
  | "findLatestReceiptForRegistration"
  | "getRegistrationInvoiceFacts"
  | "findPaymentStatusesByRegistration"
  | "findFirstPendingManualPayment"
  | "listPendingReceipts"
  | "listLedgerEvents"
> & {
  /** Optional registration-scoped payment list (preferred over status synthesis). */
  readonly listPaymentsForRegistration?: (
    tenantId: string,
    registrationId: string
  ) => Promise<readonly FinancePaymentRow[]>;
};

export type HostDenaliCaseReadDeps = {
  readonly tenantId: string;
  readonly bookings: Pick<BookingRepositoryPort, "getById">;
  readonly finance: HostDenaliCaseReadFinancePort;
  readonly obligation: Pick<
    FinanceObligationPort,
    "resolveRegistrationObligation" | "resolveRegistrationPaymentCollection"
  >;
};

function registrationIdFromScope(scope: CaseFactReadScope): string {
  return scope.subjectId;
}

function toPaymentRows(
  rows: readonly FinancePaymentRow[]
): readonly DenaliPaymentRowSource[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    method: row.method,
    provider: row.provider,
    amountMinor: row.amount,
  }));
}

function synthesizePaymentsFromStatuses(
  statuses: readonly string[],
  pending: FinancePaymentRow | null
): readonly DenaliPaymentRowSource[] {
  if (pending !== null) {
    const others = statuses.filter((s) => s !== pending.status);
    return [
      {
        id: pending.id,
        status: pending.status,
        method: pending.method,
        provider: pending.provider,
        amountMinor: pending.amount,
      },
      ...others.map((status, index) => ({
        id: `synth-${index}`,
        status,
        method: "Manual",
        provider: "manual",
      })),
    ];
  }
  return statuses.map((status, index) => ({
    id: `synth-${index}`,
    status,
    method: "Manual",
    provider: "manual",
  }));
}

function mapReceipt(row: FinanceReceiptRow): DenaliEvidenceSource["receipt"] {
  return {
    id: row.id,
    status: row.status,
    fileKey: row.fileKey,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

/** Invoice remaining for Case money / coherence — null when unread (never invent zero). */
async function resolveInvoiceRemainingMinor(
  deps: HostDenaliCaseReadDeps,
  registrationId: string,
  obligationMinor: string,
  currency: string | null
): Promise<string | null> {
  try {
    const facts: RegistrationInvoiceFacts = await deps.finance.getRegistrationInvoiceFacts(
      deps.tenantId,
      registrationId
    );
    const invoice = compileRegistrationInvoice({
      registrationId,
      currency: currency ?? facts.currency,
      prepaymentMinor: facts.prepaymentMinor,
      paidPaymentsMinor: facts.paidPaymentsMinor,
      paymentAmountsMinor: facts.paymentAmountsMinor,
      scheduleAmountsMinor: [],
      obligationMinor,
    });
    return invoice.balanceDueMinor;
  } catch {
    return null;
  }
}

/**
 * Tenant-bound live SoT adapter. Callers must construct one instance per tenant request
 * after auth — never share across tenants.
 */
export class HostDenaliCaseReadSource implements DenaliCaseReadSourcePort {
  constructor(private readonly deps: HostDenaliCaseReadDeps) {}

  async readObligation(scope: CaseFactReadScope): Promise<DenaliObligationSource> {
    const registrationId = registrationIdFromScope(scope);
    try {
      const booking = await this.deps.bookings.getById(registrationId, this.deps.tenantId);
      if (booking === null) {
        return { readStatus: "missing" };
      }

      const collectionMode = await this.deps.obligation.resolveRegistrationPaymentCollection({
        tenantId: this.deps.tenantId,
        registrationId,
      });

      const resolved = await this.deps.obligation.resolveRegistrationObligation({
        tenantId: this.deps.tenantId,
        registrationId,
      });

      if (resolved === null && collectionMode !== "free") {
        return {
          readStatus: "ok",
          collectionMode,
          obligationMinor: null,
          remainingMinor: null,
          currency: null,
          scheduleKind: "none",
          partialScopeDeclared: false,
        };
      }

      const obligationMinor = resolved?.obligationMinor ?? "0";
      const currency = resolved?.currency ?? null;
      const remainingMinor = await resolveInvoiceRemainingMinor(
        this.deps,
        registrationId,
        obligationMinor,
        currency
      );

      return {
        readStatus: "ok",
        collectionMode,
        obligationMinor,
        remainingMinor,
        currency,
        scheduleKind: "none",
        // Denali has no partial-plan SoT — do not infer true from remaining (PR15-G).
        partialScopeDeclared: false,
      };
    } catch {
      return { readStatus: "failed" };
    }
  }

  async readPayment(scope: CaseFactReadScope): Promise<DenaliPaymentSource> {
    const registrationId = registrationIdFromScope(scope);
    try {
      const booking = await this.deps.bookings.getById(registrationId, this.deps.tenantId);
      if (booking === null) {
        return { readStatus: "missing" };
      }

      let payments: readonly DenaliPaymentRowSource[];
      if (this.deps.finance.listPaymentsForRegistration !== undefined) {
        const rows = await this.deps.finance.listPaymentsForRegistration(
          this.deps.tenantId,
          registrationId
        );
        payments = toPaymentRows(rows);
      } else {
        const statuses = await this.deps.finance.findPaymentStatusesByRegistration(
          this.deps.tenantId,
          registrationId
        );
        const pending = await this.deps.finance.findFirstPendingManualPayment(
          this.deps.tenantId,
          registrationId
        );
        payments = synthesizePaymentsFromStatuses(statuses, pending);
      }

      return {
        readStatus: "ok",
        payments,
        bookingPaymentStatus: booking.paymentStatus,
      };
    } catch {
      return { readStatus: "failed" };
    }
  }

  async readEvidence(scope: CaseFactReadScope): Promise<DenaliEvidenceSource> {
    const registrationId = registrationIdFromScope(scope);
    try {
      const booking = await this.deps.bookings.getById(registrationId, this.deps.tenantId);
      if (booking === null) {
        return { readStatus: "missing" };
      }
      const receipt = await this.deps.finance.findLatestReceiptForRegistration(
        this.deps.tenantId,
        registrationId
      );
      return {
        readStatus: "ok",
        receipt: receipt === null ? null : mapReceipt(receipt),
      };
    } catch {
      return { readStatus: "failed" };
    }
  }

  async readLifecycle(scope: CaseFactReadScope): Promise<DenaliLifecycleSource> {
    const registrationId = registrationIdFromScope(scope);
    try {
      const booking = await this.deps.bookings.getById(registrationId, this.deps.tenantId);
      if (booking === null) {
        return { readStatus: "missing" };
      }

      const closed = booking.status === "cancelled" || booking.status === "rejected";
      let leftoverArtifactsProven: boolean | null = false;
      if (closed) {
        try {
          const receipt = await this.deps.finance.findLatestReceiptForRegistration(
            this.deps.tenantId,
            registrationId
          );
          leftoverArtifactsProven =
            receipt !== null &&
            (receipt.status === "Pending" || booking.paymentStatus !== "paid");
        } catch {
          leftoverArtifactsProven = null;
        }
      }

      // PR15-G — booking.paid vs positive invoice remaining is a meaning conflict cue.
      // Do not invent partialScopeDeclared; do not rewrite booking SoT from Case.
      let meaningConflictProven = false;
      try {
        const resolved = await this.deps.obligation.resolveRegistrationObligation({
          tenantId: this.deps.tenantId,
          registrationId,
        });
        const obligationMinor = resolved?.obligationMinor ?? null;
        if (obligationMinor !== null) {
          const remainingMinor = await resolveInvoiceRemainingMinor(
            this.deps,
            registrationId,
            obligationMinor,
            resolved?.currency ?? null
          );
          meaningConflictProven = isBookingPaidWithPositiveInvoiceRemaining({
            bookingPaymentStatus: booking.paymentStatus,
            remainingMinor,
          });
        }
      } catch {
        meaningConflictProven = false;
      }

      return {
        readStatus: "ok",
        bookingStatus: booking.status,
        leftoverArtifactsProven,
        meaningConflictProven,
      };
    } catch {
      return { readStatus: "failed" };
    }
  }

  async readLedger(scope: CaseFactReadScope): Promise<DenaliLedgerSource> {
    const registrationId = registrationIdFromScope(scope);
    try {
      const booking = await this.deps.bookings.getById(registrationId, this.deps.tenantId);
      if (booking === null) {
        return { readStatus: "missing" };
      }
      const events = await this.deps.finance.listLedgerEvents(this.deps.tenantId, 50);
      const related = events.filter((e) => e.aggregateId === registrationId);
      return {
        readStatus: "ok",
        ledgerRefsPresent: related.length > 0,
        reconFinding: "none",
      };
    } catch {
      return { readStatus: "failed" };
    }
  }

  async readSignal(scope: CaseFactReadScope): Promise<DenaliSignalSource> {
    const registrationId = registrationIdFromScope(scope);
    try {
      const booking = await this.deps.bookings.getById(registrationId, this.deps.tenantId);
      if (booking === null) {
        return { readStatus: "missing" };
      }
      const pendingPage = await this.deps.finance.listPendingReceipts(this.deps.tenantId, {
        limit: 1,
        registrationId,
      });
      const hasPendingForSubject = pendingPage.rows.length > 0;
      if (hasPendingForSubject) {
        return {
          readStatus: "ok",
          attentionClass: "pending_receipt_review",
          reasonCode: "pending_receipt",
        };
      }
      if (booking.paymentStatus === "unpaid" || booking.paymentStatus === "partial") {
        return {
          readStatus: "ok",
          attentionClass: "unsettled_obligation",
          reasonCode: "booking_payment_unsettled",
        };
      }
      return { readStatus: "ok", attentionClass: null };
    } catch {
      return { readStatus: "failed" };
    }
  }
}

/** Opaque enrollment case key — never embeds Denali branded type names in core. */
export function buildEnrollmentCaseKey(registrationId: string): string {
  return `enrollment:${registrationId}:primary`;
}

export function buildEnrollmentCaseScope(input: {
  readonly registrationId: string;
  readonly counterpartyId: string;
}): CaseFactReadScope {
  return {
    caseKey: buildEnrollmentCaseKey(input.registrationId),
    subjectId: input.registrationId,
    subjectKind: "enrollment",
    counterpartyId: input.counterpartyId,
  };
}
