/**
 * Operator workspace invite lifecycle — TTL and status vocabulary.
 * API pending queue exposes status "INVITED" (pending/active alias).
 */
export const OPERATOR_INVITE_STATUS_INVITED = "INVITED" as const;
export const OPERATOR_INVITE_STATUS_ACCEPTED = "ACCEPTED" as const;
export const OPERATOR_INVITE_STATUS_EXPIRED = "EXPIRED" as const;
export const OPERATOR_INVITE_STATUS_REVOKED = "REVOKED" as const;

export type OperatorInviteLifecycleStatus =
  | typeof OPERATOR_INVITE_STATUS_INVITED
  | typeof OPERATOR_INVITE_STATUS_ACCEPTED
  | typeof OPERATOR_INVITE_STATUS_EXPIRED
  | typeof OPERATOR_INVITE_STATUS_REVOKED;

const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveOperatorInviteTtlMs(): number {
  const raw = process.env.OPERATOR_INVITE_TTL_MS?.trim();
  if (raw !== undefined && raw.length > 0 && /^\d+$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_INVITE_TTL_MS;
}

export function computeInviteExpiresAt(
  createdAt: Date,
  ttlMs: number = resolveOperatorInviteTtlMs()
): Date {
  return new Date(createdAt.getTime() + ttlMs);
}

export function isOperatorInviteActive(
  input: { readonly status: string; readonly expiresAt: Date },
  now: Date = new Date()
): boolean {
  return input.status === OPERATOR_INVITE_STATUS_INVITED && input.expiresAt.getTime() > now.getTime();
}

export function isOperatorInviteExpiredByTtl(
  input: { readonly status: string; readonly expiresAt: Date },
  now: Date = new Date()
): boolean {
  return (
    input.status === OPERATOR_INVITE_STATUS_INVITED && input.expiresAt.getTime() <= now.getTime()
  );
}
