/**
 * Phase 2 — operator-facing finance chain verification (pure / in-memory IO).
 * Proves: TourCreated → consume → ledger outbox visible, without apps/web.
 */

import { DEFAULT_FINANCE_OPS_MANIFEST, type FinanceOpsManifest } from "./finance-ops-manifest";
import {
  createDenaliFinanceOutboxConsumer,
  type FinanceOutboxConsumerResult,
} from "./finance-outbox-consumer";
import type { DenaliOutboxDomainEvent, OutboxReader } from "./outbox-reader.port";
import type { FinanceLedgerOutboxEnqueueInput, OutboxWriter } from "./outbox-writer.port";

export type DenaliFinanceLedgerVisibility = {
  readonly panelLedgerEnabled: boolean;
  readonly journalEventCount: number;
  readonly registrationIds: readonly string[];
  readonly eventTypes: readonly string[];
  /** True when ops ledger panel is on and at least one ledger outbox row exists. */
  readonly ledgerVisible: boolean;
};

export type DenaliTourCreatedFinanceChainResult = {
  readonly consumer: FinanceOutboxConsumerResult;
  readonly ledgerEvents: readonly FinanceLedgerOutboxEnqueueInput[];
  readonly visibility: DenaliFinanceLedgerVisibility;
  readonly processed: boolean;
};

export function buildDenaliFinanceLedgerVisibility(input: {
  readonly ledgerEvents: readonly FinanceLedgerOutboxEnqueueInput[];
  readonly opsManifest?: FinanceOpsManifest;
}): DenaliFinanceLedgerVisibility {
  const ops = input.opsManifest ?? DEFAULT_FINANCE_OPS_MANIFEST;
  const panelLedgerEnabled = ops.panels.ledger === true;
  const registrationIds = Object.freeze(
    input.ledgerEvents.map((e) => String(e.payload.registrationId ?? ""))
  );
  const eventTypes = Object.freeze(input.ledgerEvents.map((e) => e.eventType));
  return Object.freeze({
    panelLedgerEnabled,
    journalEventCount: input.ledgerEvents.length,
    registrationIds,
    eventTypes,
    ledgerVisible: panelLedgerEnabled && input.ledgerEvents.length > 0,
  });
}

/**
 * Run TourCreated events through the Denali finance outbox consumer
 * and return operator-visible ledger evidence.
 */
export async function verifyDenaliTourCreatedFinanceChain(input: {
  readonly events: readonly DenaliOutboxDomainEvent[];
  readonly opsManifest?: FinanceOpsManifest;
  /** Optional underlying writer (e.g. failing stub). Successful rows are captured. */
  readonly writer?: OutboxWriter;
}): Promise<DenaliTourCreatedFinanceChainResult> {
  const ledgerEvents: FinanceLedgerOutboxEnqueueInput[] = [];
  const inner: OutboxWriter = input.writer ?? {
    async addEvent() {
      return true;
    },
  };
  const writer: OutboxWriter = {
    async addEvent(event) {
      const ok = await inner.addEvent(event);
      if (ok) {
        ledgerEvents.push(event);
      }
      return ok;
    },
  };

  const reader: OutboxReader = {
    async readPending() {
      return [...input.events];
    },
  };

  const consumer = createDenaliFinanceOutboxConsumer({ reader, writer });
  const consumerResult = await consumer.consumePending();
  const primaryId = input.events[0]?.domainEventId ?? "";
  const processed =
    primaryId.length > 0 ? Boolean(await consumer.hasProcessed(primaryId)) : false;

  return Object.freeze({
    consumer: consumerResult,
    ledgerEvents: Object.freeze([...ledgerEvents]),
    visibility: buildDenaliFinanceLedgerVisibility({
      ledgerEvents,
      ...(input.opsManifest !== undefined ? { opsManifest: input.opsManifest } : {}),
    }),
    processed,
  });
}
