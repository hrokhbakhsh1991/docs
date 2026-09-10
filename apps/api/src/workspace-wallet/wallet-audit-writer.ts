/**
 * WALLET-P2C — wallet operator mutation audit writer (forensic allowlist).
 */
import type { Prisma } from "@prisma/client";

import type { WalletActor, WalletMutationResult } from "@app-tour/wallet-core";

import { appendAuditEvent } from "../audit/audit-logger";

const WALLET_AUDIT_ACTION_CREDIT = "WALLET_OPERATOR_CREDIT";
const WALLET_AUDIT_ACTION_DEBIT = "WALLET_OPERATOR_DEBIT";
const WALLET_AUDIT_ACTION_REVERSAL = "WALLET_REVERSAL";

const WALLET_AUDIT_ACTION_REFUND_CREDIT = "WALLET_REFUND_CREDIT";

export async function appendRefundWalletCreditAudit(
  tx: Prisma.TransactionClient,
  input: {
    readonly mutation: WalletMutationResult;
    readonly actorUserId: string;
    readonly refundId: string;
    readonly reason: string;
  },
): Promise<void> {
  const transaction = input.mutation.transaction;
  const timestamp = transaction.postedAt ?? transaction.createdAt;
  await appendAuditEvent(tx, {
    action: WALLET_AUDIT_ACTION_REFUND_CREDIT,
    entityType: "wallet_transaction",
    entityId: transaction.id,
    metadata: {
      actorUserId: input.actorUserId,
      refundId: input.refundId,
      accountId: transaction.accountId,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      reason: input.reason,
      timestamp,
    },
  });
}

export async function appendWalletMutationAudit(
  tx: Prisma.TransactionClient,
  mutation: WalletMutationResult,
  actor: WalletActor,
): Promise<void> {
  const action =
    mutation.transaction.kind === "operator_credit"
      ? WALLET_AUDIT_ACTION_CREDIT
      : mutation.transaction.kind === "operator_debit"
        ? WALLET_AUDIT_ACTION_DEBIT
        : WALLET_AUDIT_ACTION_REVERSAL;

  await appendAuditEvent(tx, {
    action,
    entityType: "wallet_transaction",
    entityId: mutation.transaction.id,
    metadata: {
      accountId: mutation.transaction.accountId,
      amountMinor: mutation.transaction.amountMinor,
      currency: mutation.transaction.currency,
      actorRole: actor.actorRole,
    },
  });
}

export async function appendWalletReadAudit(
  tx: Prisma.TransactionClient,
  input: {
    readonly action: "WALLET_MEMBER_BALANCE_READ" | "WALLET_MEMBER_HISTORY_READ";
    readonly accountId: string;
  },
): Promise<void> {
  await appendAuditEvent(tx, {
    action: input.action,
    entityType: "wallet_account",
    entityId: input.accountId,
  });
}
