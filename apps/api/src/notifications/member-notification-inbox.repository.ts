/**
 * DP-4 — durable member notification inbox (process-local; provider-independent).
 */
import { randomUUID } from "node:crypto";

export type MemberNotificationInboxRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly templateId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly readAt: string | null;
  readonly createdAt: string;
};

const inboxById = new Map<string, MemberNotificationInboxRow>();
const idempotencyKeys = new Set<string>();

export function resetMemberNotificationInboxForTests(): void {
  inboxById.clear();
  idempotencyKeys.clear();
}

function inboxIdempotencyKey(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly correlationId: string;
}): string {
  return `${input.tenantId}\0${input.userId}\0${input.correlationId}`;
}

export function insertMemberNotificationInboxRow(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly templateId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
}): MemberNotificationInboxRow | null {
  const key = inboxIdempotencyKey(input);
  if (idempotencyKeys.has(key)) {
    return null;
  }
  idempotencyKeys.add(key);
  const row: MemberNotificationInboxRow = {
    id: randomUUID(),
    tenantId: input.tenantId,
    userId: input.userId,
    templateId: input.templateId,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    payload: input.payload,
    correlationId: input.correlationId,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  inboxById.set(row.id, row);
  return row;
}

export function listMemberNotificationInbox(
  tenantId: string,
  userId: string
): readonly MemberNotificationInboxRow[] {
  return [...inboxById.values()]
    .filter((row) => row.tenantId === tenantId && row.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function memberNotificationInboxCountForTests(): number {
  return inboxById.size;
}
