import { isTransientDbError, DbCircuitOpenError } from "../db/transient-db-error";

export type OutboxPublishErrorClass = "transient" | "poison";

const POISON_MESSAGE_PREFIXES = [
  "OUTBOX_PAYLOAD_INVALID",
  "OUTBOX_TENANT_PAYLOAD_MISMATCH",
  "OUTBOX_DOMAIN_EVENT_ID_REQUIRED",
  "OUTBOX_ROW_NOT_VISIBLE_UNDER_TENANT_SESSION",
  "OUTBOX_MARK_DONE_CONDITION_FAILED",
] as const;

function errorChainMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined; depth += 1) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
      continue;
    }
    messages.push(String(current));
    break;
  }
  return messages;
}

function matchesPoisonPrefix(message: string): boolean {
  const upper = message.toUpperCase();
  return POISON_MESSAGE_PREFIXES.some((prefix) => upper.includes(prefix));
}

/**
 * Classifies relay publish errors — transient rows return to `pending` (DEC-110).
 * Poison rows terminal `failed` on first failure (DEC-086).
 */
export function classifyOutboxPublishError(error: unknown): OutboxPublishErrorClass {
  if (error instanceof DbCircuitOpenError || isTransientDbError(error)) {
    return "transient";
  }

  for (const message of errorChainMessages(error)) {
    if (matchesPoisonPrefix(message)) {
      return "poison";
    }
  }

  const haystack = errorChainMessages(error).join(" ").toLowerCase();
  if (
    haystack.includes("econnreset") ||
    haystack.includes("etimedout") ||
    haystack.includes("epipe") ||
    haystack.includes("socket hang up")
  ) {
    return "transient";
  }

  return "poison";
}

export function isOutboxPoisonErrorCode(code: string): boolean {
  return matchesPoisonPrefix(code);
}
