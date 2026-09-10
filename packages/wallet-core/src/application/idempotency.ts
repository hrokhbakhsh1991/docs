import { walletErr, walletOk, type WalletResult } from "../domain/errors";

export type WalletIdempotencyRecord<TSnapshot = unknown> = {
  readonly tenantId: string;
  readonly creationIdempotencyKey: string;
  readonly commandFingerprint: string;
  readonly resultSnapshot: TSnapshot;
};

/**
 * Deterministic fingerprint for idempotency comparison (no persistence).
 */
export function computeCommandFingerprint(
  payload: Readonly<Record<string, string | null>>,
): string {
  const keys = Object.keys(payload).sort();
  return keys.map((key) => `${key}=${payload[key] ?? ""}`).join("&");
}

export function resolveIdempotencyReplay<T>(
  existing: WalletIdempotencyRecord<T> | null | undefined,
  fingerprint: string,
  freshResult: T,
): WalletResult<T> {
  if (!existing) {
    return walletOk(freshResult);
  }
  if (existing.commandFingerprint === fingerprint) {
    return walletOk(existing.resultSnapshot);
  }
  return walletErr(
    "WALLET_IDEMPOTENCY_CONFLICT",
    "creation idempotency key reused with different command fingerprint",
  );
}

export function operatorCreditFingerprint(
  command: import("./commands").OperatorCreditCommand,
): string {
  return computeCommandFingerprint({
    accountId: command.accountId,
    actorUserId: command.actor.actorUserId,
    amountMinor: command.amountMinor,
    currency: command.currency,
    referenceId: command.reference?.id ?? null,
    referenceType: command.reference?.type ?? null,
    tenantId: command.tenantId,
    userId: command.userId,
    workspaceId: command.workspaceId,
  });
}

export function operatorDebitFingerprint(
  command: import("./commands").OperatorDebitCommand,
): string {
  return computeCommandFingerprint({
    accountId: command.accountId,
    actorUserId: command.actor.actorUserId,
    amountMinor: command.amountMinor,
    currency: command.currency,
    referenceId: command.reference?.id ?? null,
    referenceType: command.reference?.type ?? null,
    tenantId: command.tenantId,
    userId: command.userId,
    workspaceId: command.workspaceId,
  });
}

export function reversalFingerprint(
  command: import("./commands").ReversalCommand,
): string {
  return computeCommandFingerprint({
    accountId: command.accountId,
    actorUserId: command.actor.actorUserId,
    originalTransactionId: command.originalTransactionId,
    referenceId: command.reference?.id ?? null,
    referenceType: command.reference?.type ?? null,
    tenantId: command.tenantId,
    userId: command.userId,
    workspaceId: command.workspaceId,
  });
}
