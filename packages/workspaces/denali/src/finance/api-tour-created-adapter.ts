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
};

let registeredDeps: TourCreatedFinanceSideEffectDeps | undefined;

/** API host registers Prisma claim/outbox adapters once at boot (P0 PR-1). */
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

/** Manifest-driven host outbox runner — plugin ledger + injected API adapters. */
export async function runTourCreatedFinanceSideEffect(
  row: TourCreatedFinanceSideEffectRow
): Promise<boolean> {
  const deps = requireDeps();

  if (row.eventType !== "TourCreated" || !row.domainEventId.trim()) {
    return false;
  }

  const event = mapTourCreatedRow(row);
  if (!tourCreatedHasFinancePayload(event.payload)) {
    return false;
  }

  const claimed = await deps.tryClaimProcessedEvent(row.tenantId, row.domainEventId);
  if (!claimed) {
    return false;
  }

  try {
    return await handleTourCreatedLedgerEvent({
      tenantId: row.tenantId,
      event,
      outboxWriter: deps.createOutboxWriter(),
    });
  } catch (error: unknown) {
    deps.logTourCreatedFailed({
      tenantId: row.tenantId,
      domainEventId: row.domainEventId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
