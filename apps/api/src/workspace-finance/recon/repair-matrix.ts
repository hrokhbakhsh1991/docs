/**
 * Declarative recon repair matrix — FINANCE_RECON_REPAIR_ENGINE.md
 */
import { FINANCE_RECON_CODE, type FinanceReconCode } from "./codes";

export type FinanceReconRepairMode = "preview" | "manual" | "approved" | "automatic";

export type FinanceReconRollbackStrategy =
  | "none_idempotent_reenqueue"
  | "re_sync_booking_status"
  | "quarantine_orphan_or_ticket"
  | "ticket_only"
  | "outbox_re_fail"
  | "retry_booking_sync"
  | "ignore_ack";

export type FinanceReconRepairMatrixEntry = {
  readonly code: FinanceReconCode;
  readonly divergence: string;
  readonly action: string;
  readonly modes: readonly FinanceReconRepairMode[];
  readonly autoSafe: boolean;
  readonly requiresApprovedConfirm: boolean;
  readonly rollbackStrategy: FinanceReconRollbackStrategy;
};

export const FINANCE_RECON_REPAIR_MATRIX: readonly FinanceReconRepairMatrixEntry[] = [
  {
    code: FINANCE_RECON_CODE.paidNoLedger,
    divergence: "Paid without ledger",
    action: "enqueue_capture",
    modes: ["preview", "manual", "approved", "automatic"],
    autoSafe: true,
    requiresApprovedConfirm: false,
    rollbackStrategy: "none_idempotent_reenqueue",
  },
  {
    code: FINANCE_RECON_CODE.ledgerNoPayment,
    divergence: "Ledger without payment",
    action: "quarantine_orphan_ledger",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "quarantine_orphan_or_ticket",
  },
  {
    code: FINANCE_RECON_CODE.dupCapture,
    divergence: "Duplicate ledger",
    action: "ticket_ack",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "ticket_only",
  },
  {
    code: FINANCE_RECON_CODE.prepayNoLedger,
    divergence: "Missing prepayment ledger",
    action: "enqueue_prepay_ledger",
    modes: ["preview", "manual", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: false,
    rollbackStrategy: "none_idempotent_reenqueue",
  },
  {
    code: FINANCE_RECON_CODE.outboxFailed,
    divergence: "Outbox divergence (failed)",
    action: "replay_outbox",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "outbox_re_fail",
  },
  {
    code: FINANCE_RECON_CODE.outboxStale,
    divergence: "Outbox divergence (stale pending)",
    action: "replay_outbox_noop_or_inspect",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "ticket_only",
  },
  {
    code: FINANCE_RECON_CODE.paidBookingDrift,
    divergence: "Paid vs booking payment_status",
    action: "booking_sync",
    modes: ["preview", "manual", "approved", "automatic"],
    autoSafe: true,
    requiresApprovedConfirm: false,
    rollbackStrategy: "re_sync_booking_status",
  },
  {
    code: FINANCE_RECON_CODE.prepayBookingDegraded,
    divergence: "Prepay booking sync degraded",
    action: "retry_booking_sync",
    modes: ["preview", "manual", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: false,
    rollbackStrategy: "retry_booking_sync",
  },
  {
    code: FINANCE_RECON_CODE.paidAmtMismatch,
    divergence: "Paid amount vs ledger debit sum",
    action: "ticket_ack",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "ticket_only",
  },
  {
    code: FINANCE_RECON_CODE.stuckPending,
    divergence: "Stuck pending payment",
    action: "ticket_ack",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "ticket_only",
  },
  {
    code: FINANCE_RECON_CODE.doubleWallet,
    divergence: "TourCreated ∩ capture double wallet",
    action: "ticket_ack",
    modes: ["preview", "approved"],
    autoSafe: false,
    requiresApprovedConfirm: true,
    rollbackStrategy: "ticket_only",
  },
] as const;

const BY_CODE = new Map(FINANCE_RECON_REPAIR_MATRIX.map((e) => [e.code, e]));

export function getFinanceReconRepairMatrixEntry(
  code: string
): FinanceReconRepairMatrixEntry | undefined {
  return BY_CODE.get(code as FinanceReconCode);
}

export function listFinanceReconRepairMatrix(): readonly FinanceReconRepairMatrixEntry[] {
  return FINANCE_RECON_REPAIR_MATRIX;
}
