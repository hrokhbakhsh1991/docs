/**
 * Phase 3 — manual Completed refund → member wallet credit (Denali operator workflow).
 * Finance refund rows are read-only; wallet ledger is the only mutation surface.
 */
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { WalletTransaction } from "@app-tour/wallet-core";

import { getBookingsRepository } from "../bookings/create-bookings-repository";
import { withTenantRls } from "../db/with-tenant-rls";
import { getIdentityRepository } from "../identity/create-identity-repository";
import { assertWalletOperatorAccess } from "./assert-wallet-operator-access";
import { assertWalletWorkspaceGate } from "./assert-wallet-access";
import { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";

export const REFUND_WALLET_REFERENCE_TYPE = "finance_refund" as const;

export type RefundWalletCreditStatus = {
  readonly credited: boolean;
  readonly transactionId: string | null;
  readonly accountId: string | null;
  readonly creditedAt: string | null;
  readonly replay: boolean;
};

function buildRefundWalletReason(reasonCode: string, reasonNote: string | null): string {
  const code = reasonCode.trim();
  const note = reasonNote?.trim() ?? "";
  if (code.length === 0) {
    return note.length > 0 ? note : "finance_refund";
  }
  return note.length > 0 ? `${code}: ${note}` : code;
}

function mapWalletCreditStatus(
  transaction: WalletTransaction,
  replay: boolean
): RefundWalletCreditStatus {
  return {
    credited: true,
    transactionId: transaction.id,
    accountId: transaction.accountId,
    creditedAt: transaction.postedAt ?? transaction.createdAt,
    replay,
  };
}

function emptyWalletCreditStatus(): RefundWalletCreditStatus {
  return {
    credited: false,
    transactionId: null,
    accountId: null,
    creditedAt: null,
    replay: false,
  };
}

export function buildRefundWalletCreditIdempotencyKey(
  tenantId: string,
  refundId: string
): string {
  return `wallet:refund-credit:${tenantId.trim()}:${refundId.trim()}`;
}

export async function resolveRefundMemberOwner(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<{ readonly memberUserId: string; readonly workspaceId: string } | null> {
  const booking = await getBookingsRepository().getById(
    input.registrationId.trim(),
    input.tenantId.trim()
  );
  if (booking === null) {
    return null;
  }
  const memberUserId = booking.submittedByUserId.trim();
  if (memberUserId.length === 0) {
    return null;
  }
  const membership = await getIdentityRepository().findMembership(
    memberUserId,
    input.tenantId.trim()
  );
  const workspaceId = membership?.workspaceId?.trim() ?? "";
  if (workspaceId.length === 0) {
    return null;
  }
  return { memberUserId, workspaceId };
}

function mapCreditResponse(input: {
  readonly refundId: string;
  readonly registrationId: string;
  readonly memberUserId: string;
  readonly transaction: WalletTransaction;
  readonly amountMinor: string;
  readonly currency: string;
  readonly replay: boolean;
}) {
  return {
    refundId: input.refundId,
    registrationId: input.registrationId,
    memberUserId: input.memberUserId,
    accountId: input.transaction.accountId,
    transactionId: input.transaction.id,
    amountMinor: input.amountMinor,
    currency: input.currency,
    replay: input.replay,
    walletCredit: mapWalletCreditStatus(input.transaction, input.replay),
  };
}

export async function creditCompletedRefundToWallet(
  auth: TenantAuthContext,
  refundId: string
): Promise<ReturnType<typeof mapCreditResponse>> {
  assertWalletOperatorAccess(auth);

  const tenantId = auth.tenantId.trim();
  const trimmedRefundId = refundId.trim();
  if (trimmedRefundId.length === 0) {
    throw new Error("REFUND_NOT_FOUND");
  }

  await assertWalletWorkspaceGate(tenantId);

  const refundRow = await withTenantRls(tenantId, async (tx) =>
    tx.financeRefund.findFirst({
      where: { tenantId, id: trimmedRefundId },
    })
  );
  if (refundRow === null) {
    throw new Error("REFUND_NOT_FOUND");
  }
  if (refundRow.status !== "Completed") {
    throw new Error("REFUND_WALLET_NOT_COMPLETED");
  }

  const memberOwner = await resolveRefundMemberOwner({
    tenantId,
    registrationId: refundRow.registrationId,
  });
  if (memberOwner === null) {
    throw new Error("REFUND_WALLET_MEMBER_OWNER_MISSING");
  }

  const repo = new PrismaWalletRepository();
  const idempotencyKey = buildRefundWalletCreditIdempotencyKey(tenantId, trimmedRefundId);

  const existingByReference = await repo.findPostedTransactionByReference(
    tenantId,
    REFUND_WALLET_REFERENCE_TYPE,
    trimmedRefundId
  );
  const existingByIdempotency = await repo.findPostedTransactionByIdempotencyKey(
    tenantId,
    idempotencyKey
  );
  const existingCredit = existingByReference ?? existingByIdempotency;
  if (existingCredit !== null) {
    return mapCreditResponse({
      refundId: trimmedRefundId,
      registrationId: refundRow.registrationId,
      memberUserId: memberOwner.memberUserId,
      transaction: existingCredit,
      amountMinor: existingCredit.amountMinor,
      currency: existingCredit.currency,
      replay: true,
    });
  }

  const accountResult = await repo.getOrCreateAccount({
    tenantId,
    workspaceId: memberOwner.workspaceId,
    userId: memberOwner.memberUserId,
    currency: refundRow.currency,
  });
  if (!accountResult.ok) {
    throw new Error(accountResult.error.code);
  }

  const reason = buildRefundWalletReason(refundRow.reasonCode, refundRow.reasonNote);
  const creditResult = await repo.operatorCredit({
    tenantId,
    workspaceId: memberOwner.workspaceId,
    userId: memberOwner.memberUserId,
    accountId: accountResult.value.id,
    amountMinor: refundRow.amountMinor,
    currency: refundRow.currency,
    creationIdempotencyKey: idempotencyKey,
    reference: { type: REFUND_WALLET_REFERENCE_TYPE, id: trimmedRefundId },
    actor: { actorUserId: auth.userId, actorRole: "operator" },
    refundCreditAudit: {
      refundId: trimmedRefundId,
      reason,
    },
  });
  if (!creditResult.ok) {
    throw new Error(creditResult.error.code);
  }

  const transaction = creditResult.value.transaction;

  return mapCreditResponse({
    refundId: trimmedRefundId,
    registrationId: refundRow.registrationId,
    memberUserId: memberOwner.memberUserId,
    transaction,
    amountMinor: refundRow.amountMinor,
    currency: refundRow.currency,
    replay: false,
  });
}

export async function enrichOperatorRefundsWithWalletCredit(
  auth: TenantAuthContext,
  items: readonly Record<string, unknown>[]
): Promise<readonly Record<string, unknown>[]> {
  if (items.length === 0) {
    return items;
  }

  let walletEnabled = true;
  try {
    await assertWalletWorkspaceGate(auth.tenantId);
  } catch {
    walletEnabled = false;
  }

  const tenantId = auth.tenantId.trim();
  const registrationIds = [
    ...new Set(
      items
        .map((row) => (typeof row.registrationId === "string" ? row.registrationId.trim() : ""))
        .filter((id) => id.length > 0)
    ),
  ];
  const bookings =
    registrationIds.length > 0
      ? await getBookingsRepository().getByIds(registrationIds, tenantId)
      : [];
  const memberByRegistration = new Map(
    bookings.map((booking) => [booking.id, booking.submittedByUserId.trim()])
  );

  const refundIds = items
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter((id) => id.length > 0);

  const repo = new PrismaWalletRepository();
  const creditedByRefundId = walletEnabled
    ? await repo.findPostedTransactionsByReferences(
        tenantId,
        REFUND_WALLET_REFERENCE_TYPE,
        refundIds
      )
    : new Map<string, WalletTransaction>();

  return items.map((row) => {
    const refundId = typeof row.id === "string" ? row.id.trim() : "";
    const registrationId =
      typeof row.registrationId === "string" ? row.registrationId.trim() : "";
    const memberUserId = memberByRegistration.get(registrationId) ?? null;
    const existing = refundId.length > 0 ? creditedByRefundId.get(refundId) : undefined;
    const walletCredit =
      existing !== undefined
        ? mapWalletCreditStatus(existing, false)
        : emptyWalletCreditStatus();

    const canCreditToWallet =
      walletEnabled &&
      row.status === "Completed" &&
      memberUserId !== null &&
      memberUserId.length > 0 &&
      !walletCredit.credited;

    return {
      ...row,
      memberUserId,
      walletCredit,
      canCreditToWallet,
    };
  });
}
