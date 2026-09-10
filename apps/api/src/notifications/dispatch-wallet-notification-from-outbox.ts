/**
 * MNI-001 — wallet module outbox → shared member notification inbox.
 */
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { insertMemberNotificationRow } from "./member-notification.repository";

const WALLET_NOTIFICATION_EVENT_MAP: Readonly<
  Record<
    string,
    { readonly templateId: string; readonly titleKey: string; readonly bodyKey: string }
  >
> = Object.freeze({
  "wallet.transaction.posted": {
    templateId: "wallet.transaction.posted",
    titleKey: "notification.wallet.transaction.posted.title",
    bodyKey: "notification.wallet.transaction.posted.body",
  },
  "wallet.balance.updated": {
    templateId: "wallet.balance.updated",
    titleKey: "notification.wallet.balance.updated.title",
    bodyKey: "notification.wallet.balance.updated.body",
  },
  "wallet.refund.credited": {
    templateId: "wallet.refund.credited",
    titleKey: "notification.wallet.refund.credited.title",
    bodyKey: "notification.wallet.refund.credited.body",
  },
});

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

function resolveWalletRecipientUserId(payload: Readonly<Record<string, unknown>>): string | null {
  const userId = payload.userId ?? payload.memberUserId ?? payload.accountUserId;
  return typeof userId === "string" && userId.trim().length > 0 ? userId.trim() : null;
}

function resolveWalletEntityId(
  payload: Readonly<Record<string, unknown>>,
  aggregateId: string
): string | null {
  const transactionId = payload.transactionId ?? payload.walletTransactionId;
  if (typeof transactionId === "string") {
    return transactionId;
  }
  return aggregateId.length > 0 ? aggregateId : null;
}

export async function dispatchWalletNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow
): Promise<void> {
  const mapping = WALLET_NOTIFICATION_EVENT_MAP[row.eventType];
  if (mapping === undefined) {
    return;
  }

  const payload = asRecord(row.payload);
  const userId = resolveWalletRecipientUserId(payload);
  if (userId === null) {
    return;
  }

  await insertMemberNotificationRow({
    tenantId: row.tenantId,
    userId,
    sourceModule: "wallet",
    eventType: row.eventType,
    entityType: "wallet_event",
    entityId: resolveWalletEntityId(payload, row.aggregateId),
    title: mapping.titleKey,
    body: mapping.bodyKey,
    titleKey: mapping.titleKey,
    bodyKey: mapping.bodyKey,
    templateKey: mapping.templateId,
    dedupeKey: row.domainEventId,
    payload: {
      ...payload,
      eventType: row.eventType,
      domainEventId: row.domainEventId,
    },
  });
}
