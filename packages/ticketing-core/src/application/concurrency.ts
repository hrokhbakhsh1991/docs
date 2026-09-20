import { ticketingErr, ticketingOk, type TicketingResult } from "../domain/errors";

export function assertRowVersion(
  expected: number,
  actual: number,
): TicketingResult<void> {
  if (expected !== actual) {
    return ticketingErr(
      "ROW_VERSION_CONFLICT",
      `expected rowVersion ${expected} but ticket has ${actual}`,
      "rowVersion",
    );
  }
  return ticketingOk(undefined);
}

export function buildIdempotencyFingerprint(input: {
  readonly scope: string;
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly idempotencyKey: string;
}): string {
  return `${input.scope}:${input.tenantId}:${input.actorUserId}:${input.idempotencyKey}`;
}

export function resolveDuplicateCommand<T>(
  fingerprint: string,
  seen: ReadonlySet<string> | ReadonlyMap<string, T>,
): TicketingResult<T | void> {
  if (seen instanceof Map) {
    if (seen.has(fingerprint)) {
      return ticketingOk(seen.get(fingerprint) as T);
    }
    return ticketingOk(undefined);
  }
  if (seen.has(fingerprint)) {
    return ticketingErr("DUPLICATE_COMMAND", "duplicate command rejected");
  }
  return ticketingOk(undefined);
}
