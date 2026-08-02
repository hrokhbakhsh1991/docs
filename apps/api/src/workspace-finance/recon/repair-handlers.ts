/**
 * Per-code recon repair handlers — mutations only; mode gating in repair-engine.
 */
import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../../db/background-admin-client";
import { tryReplayFailedOutboxEvent } from "../../outbox/outbox-replay";
import { resolveFinanceLedgerPolicy } from "../finance-dependency-registry";
import { enqueueFinanceLedgerCaptureOutbox } from "../enqueue-finance-ledger-capture";
import { createTxScopedOutboxWriter } from "../infrastructure/prisma-workspace-outbox-writer";
import { paymentLedgerCaptureDomainEventId } from "../paid-without-ledger-detection";
import { resolveFinanceWorkspaceTypeForTenant } from "../resolve-finance-workspace-type-for-tenant";
import { FINANCE_RECON_CODE } from "./codes";
import { markFinanceReconFindingStatus } from "./findings-store";
import { createBookingPaymentPort } from "../../bookings/create-booking-payment-port";

export type ReconFindingRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly paymentId: string | null;
  readonly registrationId: string | null;
  readonly outboxEventId: string | null;
  readonly details: unknown;
};

export type HandlerResult = {
  readonly result: "ok" | "conflict" | "error" | "noop" | "unsupported";
  readonly preview: boolean;
  readonly payload: Record<string, unknown>;
  readonly resolveFinding?: boolean;
};

function detailsOf(finding: ReconFindingRow): Record<string, unknown> {
  return finding.details !== null && typeof finding.details === "object"
    ? (finding.details as Record<string, unknown>)
    : {};
}

export async function handlePaidNoLedger(
  finding: ReconFindingRow,
  preview: boolean,
  _actorUserId?: string
): Promise<HandlerResult> {
  if (finding.paymentId === null) {
    return { result: "error", preview, payload: { error: "missing_payment_id" } };
  }
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const payment = await admin.payment.findFirst({
    where: { id: finding.paymentId, tenantId: finding.tenantId, status: "Paid" },
  });
  if (payment === null) {
    return { result: "conflict", preview, payload: { error: "payment_not_paid" } };
  }

  const expectedId = paymentLedgerCaptureDomainEventId(payment.id);
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(finding.tenantId);
  const policy = await resolveFinanceLedgerPolicy(workspaceType);
  const plan = policy.buildPaymentCaptureJournal({
    tenantId: finding.tenantId,
    paymentId: payment.id,
    registrationId: payment.registrationId,
    amountMinor: payment.amount,
    currency: payment.currency,
    capturedAtIso: (payment.paidAt ?? new Date()).toISOString(),
  });

  if (plan.domainEventId !== expectedId) {
    return {
      result: "error",
      preview,
      payload: {
        error: "domain_event_id_mismatch",
        expectedId,
        actualId: plan.domainEventId,
      },
    };
  }

  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: {
        wouldEnqueue: true,
        domainEventId: plan.domainEventId,
        journalId: plan.journalId,
        lineCount: plan.lines.length,
      },
    };
  }

  const inserted = await withTenantRls(finding.tenantId, async (tx) => {
    return enqueueFinanceLedgerCaptureOutbox({
      outboxWriter: createTxScopedOutboxWriter(tx),
      tenantId: finding.tenantId,
      registrationId: payment.registrationId,
      capture: plan,
    });
  });

  return {
    result: inserted ? "ok" : "noop",
    preview: false,
    payload: { inserted, domainEventId: plan.domainEventId },
    resolveFinding: true,
  };
}

export async function handlePaidBookingDrift(
  finding: ReconFindingRow,
  preview: boolean
): Promise<HandlerResult> {
  if (finding.registrationId === null) {
    return { result: "error", preview, payload: { error: "missing_registration_id" } };
  }
  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: {
        wouldSync: true,
        registrationId: finding.registrationId,
        paymentStatus: "paid",
      },
    };
  }

  const adapter = createBookingPaymentPort();
  const status = await adapter.syncStatus({
    tenantId: finding.tenantId,
    registrationId: finding.registrationId,
    paymentStatus: "paid",
  });

  return {
    result: status === "paid" ? "ok" : "conflict",
    preview: false,
    payload: { paymentStatus: status },
    resolveFinding: status === "paid",
  };
}

export async function handleLedgerNoPayment(
  finding: ReconFindingRow,
  preview: boolean
): Promise<HandlerResult> {
  if (finding.outboxEventId === null) {
    return { result: "error", preview, payload: { error: "missing_outbox_event_id" } };
  }
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const row = await admin.outboxEvent.findFirst({
    where: { id: finding.outboxEventId, tenantId: finding.tenantId },
  });
  if (row === null) {
    return { result: "conflict", preview, payload: { error: "outbox_not_found" } };
  }

  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: {
        wouldQuarantine: row.status === "pending" || row.status === "processing",
        wouldTicketOnly: row.status === "done" || row.status === "failed",
        outboxStatus: row.status,
        domainEventId: row.domainEventId,
      },
    };
  }

  if (row.status === "pending" || row.status === "processing") {
    await admin.outboxEvent.update({
      where: { id: row.id },
      data: {
        status: "failed",
        processedAt: new Date(),
        lastError: {
          code: "FINANCE_RECON_ORPHAN_LEDGER_QUARANTINE",
          at: new Date().toISOString(),
        },
      },
    });
    return {
      result: "ok",
      preview: false,
      payload: { quarantined: true, outboxEventId: row.id },
      resolveFinding: true,
    };
  }

  return {
    result: "ok",
    preview: false,
    payload: {
      ticketOnly: true,
      outboxStatus: row.status,
      note: "done_or_failed_requires_compensating_reverse_journal",
    },
    resolveFinding: true,
  };
}

export async function handleTicketAck(
  finding: ReconFindingRow,
  preview: boolean,
  note: string
): Promise<HandlerResult> {
  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: { wouldAck: true, code: finding.code, note },
    };
  }
  return {
    result: "ok",
    preview: false,
    payload: { acknowledged: true, code: finding.code, note },
    resolveFinding: true,
  };
}

export async function handlePrepayNoLedger(
  finding: ReconFindingRow,
  preview: boolean
): Promise<HandlerResult> {
  const details = detailsOf(finding);
  const prepaymentDomainEventId =
    typeof details.prepaymentDomainEventId === "string"
      ? details.prepaymentDomainEventId
      : null;
  const expectedLedgerId =
    typeof details.expectedLedgerDomainEventId === "string"
      ? details.expectedLedgerDomainEventId
      : prepaymentDomainEventId !== null
        ? `${prepaymentDomainEventId}:ledger`
        : null;

  if (finding.outboxEventId === null || prepaymentDomainEventId === null || expectedLedgerId === null) {
    return {
      result: "error",
      preview,
      payload: { error: "missing_prepay_domain_ids" },
    };
  }

  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const recorded = await admin.outboxEvent.findFirst({
    where: {
      id: finding.outboxEventId,
      tenantId: finding.tenantId,
      eventType: "finance.prepayment.recorded",
    },
  });
  if (recorded === null) {
    return { result: "conflict", preview, payload: { error: "prepay_recorded_missing" } };
  }

  const payload =
    recorded.payload !== null && typeof recorded.payload === "object"
      ? (recorded.payload as Record<string, unknown>)
      : {};
  const registrationId =
    finding.registrationId ??
    (typeof payload.registrationId === "string" ? payload.registrationId : null);
  const amountMinor =
    typeof payload.amountMinor === "string" ? payload.amountMinor : null;
  const currency = typeof payload.currency === "string" ? payload.currency : null;
  const method = typeof payload.method === "string" ? payload.method : "Manual";
  const recordedAtIso =
    typeof payload.recordedAt === "string"
      ? payload.recordedAt
      : recorded.createdAt.toISOString();
  const keyHash =
    typeof payload.keyHash === "string"
      ? payload.keyHash
      : prepaymentDomainEventId.split(":").pop() ?? "repair";

  if (registrationId === null || amountMinor === null || currency === null) {
    return {
      result: "error",
      preview,
      payload: { error: "prepay_payload_incomplete", payload },
    };
  }

  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(finding.tenantId);
  const policy = await resolveFinanceLedgerPolicy(workspaceType);
  const plan = policy.buildPrepaymentJournal({
    tenantId: finding.tenantId,
    registrationId,
    amountMinor,
    currency,
    method,
    recordedAtIso,
    keyHash,
    prepaymentDomainEventId,
    ledgerDomainEventId: expectedLedgerId,
    journalSeed: expectedLedgerId,
  });

  if (plan.domainEventId !== expectedLedgerId) {
    return {
      result: "error",
      preview,
      payload: {
        error: "ledger_domain_event_id_mismatch",
        expectedLedgerId,
        actualId: plan.domainEventId,
      },
    };
  }

  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: {
        wouldEnqueue: true,
        domainEventId: plan.domainEventId,
        journalId: plan.journalId,
        lineCount: plan.lines.length,
      },
    };
  }

  const inserted = await withTenantRls(finding.tenantId, async (tx) => {
    return enqueueFinanceLedgerCaptureOutbox({
      outboxWriter: createTxScopedOutboxWriter(tx),
      tenantId: finding.tenantId,
      registrationId,
      capture: plan,
    });
  });

  return {
    result: inserted ? "ok" : "noop",
    preview: false,
    payload: { inserted, domainEventId: plan.domainEventId },
    resolveFinding: true,
  };
}

export async function handleOutboxFailed(
  finding: ReconFindingRow,
  preview: boolean
): Promise<HandlerResult> {
  if (finding.outboxEventId === null) {
    return { result: "error", preview, payload: { error: "missing_outbox_event_id" } };
  }
  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: {
        wouldReplay: true,
        outboxEventId: finding.outboxEventId,
        tenantId: finding.tenantId,
      },
    };
  }

  const outcome = await tryReplayFailedOutboxEvent({
    tenantId: finding.tenantId,
    outboxId: finding.outboxEventId,
  });

  return {
    result: outcome === "replayed" ? "ok" : "noop",
    preview: false,
    payload: { replay: outcome },
    resolveFinding: outcome === "replayed",
  };
}

export async function handlePrepayBookingDegraded(
  finding: ReconFindingRow,
  preview: boolean
): Promise<HandlerResult> {
  if (finding.registrationId === null) {
    return { result: "error", preview, payload: { error: "missing_registration_id" } };
  }
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const paid = await admin.payment.findFirst({
    where: {
      tenantId: finding.tenantId,
      registrationId: finding.registrationId,
      status: "Paid",
    },
    select: { id: true },
  });
  const paymentStatus = paid !== null ? "paid" : "unpaid";
  if (preview) {
    return {
      result: "ok",
      preview: true,
      payload: { wouldSync: true, paymentStatus, registrationId: finding.registrationId },
    };
  }

  const adapter = createBookingPaymentPort();
  const status = await adapter.syncStatus({
    tenantId: finding.tenantId,
    registrationId: finding.registrationId,
    paymentStatus,
  });

  if (finding.outboxEventId !== null) {
    await admin.outboxEvent.updateMany({
      where: {
        id: finding.outboxEventId,
        tenantId: finding.tenantId,
        status: "pending",
        eventType: "finance.prepayment.booking_sync.degraded",
      },
      data: {
        status: "done",
        processedAt: new Date(),
        lastError: Prisma.JsonNull,
      },
    });
  }

  return {
    result: "ok",
    preview: false,
    payload: { paymentStatus: status },
    resolveFinding: true,
  };
}

export async function dispatchRepairHandler(
  finding: ReconFindingRow,
  preview: boolean,
  actorUserId?: string
): Promise<HandlerResult> {
  switch (finding.code) {
    case FINANCE_RECON_CODE.paidNoLedger:
      return handlePaidNoLedger(finding, preview, actorUserId);
    case FINANCE_RECON_CODE.paidBookingDrift:
      return handlePaidBookingDrift(finding, preview);
    case FINANCE_RECON_CODE.ledgerNoPayment:
      return handleLedgerNoPayment(finding, preview);
    case FINANCE_RECON_CODE.prepayNoLedger:
      return handlePrepayNoLedger(finding, preview);
    case FINANCE_RECON_CODE.outboxFailed:
      return handleOutboxFailed(finding, preview);
    case FINANCE_RECON_CODE.prepayBookingDegraded:
      return handlePrepayBookingDegraded(finding, preview);
    case FINANCE_RECON_CODE.dupCapture:
    case FINANCE_RECON_CODE.paidAmtMismatch:
    case FINANCE_RECON_CODE.stuckPending:
    case FINANCE_RECON_CODE.doubleWallet:
    case FINANCE_RECON_CODE.outboxStale:
      return handleTicketAck(finding, preview, "operator_ack_ticket_path");
    default:
      return {
        result: "unsupported",
        preview,
        payload: { code: finding.code, message: "repair_not_allowlisted" },
      };
  }
}

export { markFinanceReconFindingStatus };
