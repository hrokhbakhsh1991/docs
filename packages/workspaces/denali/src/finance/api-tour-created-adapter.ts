import {
  handleTourCreatedLedgerEvent,
  type TourCreatedLedgerPayload,
} from "./handlers/tour-created-ledger";
import type { DenaliOutboxDomainEvent } from "./outbox-reader.port";
import type { OutboxWriter } from "./outbox-writer.port";

export type TourCreatedFinanceSideEffectRow = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
};

export type TourCreatedFinanceSideEffectDeps = {
  readonly tryClaimProcessedEvent: (tenantId: string, domainEventId: string) => Promise<boolean>;
  readonly createOutboxWriter: () => OutboxWriter;
  readonly logTourCreatedFailed: (input: {
    readonly tenantId: string;
    readonly domainEventId: string;
    readonly message: string;
  }) => void;
  /**
   * Host exclusive Path B emit (advisory lock + skip if Path A/B already credited).
   * When set, replaces direct outboxWriter emit inside handleTourCreatedLedgerEvent.
   */
  readonly emitPaidLedgerExclusive?: (input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paidAmountMinor: string;
    readonly currency: string;
    readonly tourCreatedDomainEventId: string;
  }) => Promise<"emitted" | "skipped">;
};

let registeredDeps: TourCreatedFinanceSideEffectDeps | undefined;

/** Test-only: optional module singleton for unit tests without a reaction HostIo. */
export function registerTourCreatedFinanceSideEffectDeps(
  deps: TourCreatedFinanceSideEffectDeps
): void {
  registeredDeps = deps;
}

function requireDeps(): TourCreatedFinanceSideEffectDeps {
  if (registeredDeps === undefined) {
    throw new Error("TOUR_CREATED_FINANCE_SIDE_EFFECT_DEPS_NOT_REGISTERED");
  }
  return registeredDeps;
}

function tourCreatedHasFinancePayload(payload: Record<string, unknown>): boolean {
  const finance = payload as TourCreatedLedgerPayload;
  return Boolean(finance.registrationId?.trim() && finance.paidAmountMinor?.trim());
}

function mapTourCreatedRow(row: TourCreatedFinanceSideEffectRow): DenaliOutboxDomainEvent {
  const payload =
    typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    tenantId: row.tenantId,
    domainEventId: row.domainEventId,
    eventType: row.eventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload,
  };
}

/**
 * TourCreated → ledger side effect.
 * Prefer explicit `deps` from the reaction adapter HostIo (production).
 * Module singleton via {@link registerTourCreatedFinanceSideEffectDeps} is test-only.
 */
export async function runTourCreatedFinanceSideEffect(
  row: TourCreatedFinanceSideEffectRow,
  deps?: TourCreatedFinanceSideEffectDeps
): Promise<boolean> {
  const resolved = deps ?? requireDeps();

  if (row.eventType !== "TourCreated" || !row.domainEventId.trim()) {
    return false;
  }

  const event = mapTourCreatedRow(row);
  if (!tourCreatedHasFinancePayload(event.payload)) {
    return false;
  }

  const claimed = await resolved.tryClaimProcessedEvent(row.tenantId, row.domainEventId);
  if (!claimed) {
    return false;
  }

  try {
    if (resolved.emitPaidLedgerExclusive !== undefined) {
      const payload = event.payload as TourCreatedLedgerPayload;
      const registrationId = payload.registrationId?.trim() ?? "";
      const paidAmountMinor = payload.paidAmountMinor?.trim() ?? "";
      const currency = payload.currency?.trim() || "USD";
      const exclusive = await resolved.emitPaidLedgerExclusive({
        tenantId: row.tenantId,
        registrationId,
        paidAmountMinor,
        currency,
        tourCreatedDomainEventId: row.domainEventId,
      });
      return exclusive === "emitted" || exclusive === "skipped";
    }
    return await handleTourCreatedLedgerEvent({
      tenantId: row.tenantId,
      event,
      outboxWriter: resolved.createOutboxWriter(),
    });
  } catch (error: unknown) {
    resolved.logTourCreatedFailed({
      tenantId: row.tenantId,
      domainEventId: row.domainEventId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
