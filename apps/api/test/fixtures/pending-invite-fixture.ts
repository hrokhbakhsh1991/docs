import {
  OPERATOR_INVITE_STATUS_INVITED,
  computeInviteExpiresAt,
} from "../../src/identity/invite-lifecycle";
import type { PendingInviteRecord } from "../../src/identity/in-memory-identity.repository";

export function buildPendingInviteSeed(
  partial: Omit<PendingInviteRecord, "createdAt" | "expiresAt"> & {
    readonly createdAt?: Date;
    readonly expiresAt?: Date;
  }
): PendingInviteRecord {
  const createdAt = partial.createdAt ?? new Date();
  return {
    ...partial,
    status: partial.status ?? OPERATOR_INVITE_STATUS_INVITED,
    createdAt,
    expiresAt: partial.expiresAt ?? computeInviteExpiresAt(createdAt),
  };
}

export function buildExpiredPendingInviteSeed(
  partial: Omit<PendingInviteRecord, "createdAt" | "expiresAt" | "status">
): PendingInviteRecord {
  const expiresAt = new Date(Date.now() - 60_000);
  const createdAt = new Date(expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  return buildPendingInviteSeed({
    ...partial,
    status: OPERATOR_INVITE_STATUS_INVITED,
    createdAt,
    expiresAt,
  });
}
