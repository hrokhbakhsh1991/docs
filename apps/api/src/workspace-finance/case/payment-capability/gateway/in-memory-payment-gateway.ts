/**
 * In-memory Host gateway SoT + webhook ingestion target (PR10-C).
 * Case never consumes webhooks — Host mutates this ledger first.
 */

import type {
  GatewayPaymentRecord,
  GatewayReadResult,
  PaymentGatewayPort,
} from "./payment-gateway.port";

export type GatewayWebhookIngestEvent = {
  readonly subjectId: string;
  readonly subjectKind: string;
  readonly externalPaymentRef: string;
  readonly lifecycle: GatewayPaymentRecord["lifecycle"];
  readonly settlement: GatewayPaymentRecord["settlement"];
  readonly evidence: GatewayPaymentRecord["evidence"];
  readonly evidenceInspectable?: boolean;
  readonly unsupportedFields?: readonly string[];
};

function subjectKey(subjectKind: string, subjectId: string): string {
  return `${subjectKind}:${subjectId}`;
}

/**
 * Host payment ledger stand-in. Implements PaymentGatewayPort for tests / local DI.
 */
export class InMemoryPaymentGateway implements PaymentGatewayPort {
  private readonly bySubject = new Map<string, GatewayPaymentRecord>();
  private readonly byExternalRef = new Map<string, string>();
  private failNext: GatewayReadResult | null = null;
  private artificialLatencyMs = 0;

  put(record: GatewayPaymentRecord): void {
    const key = subjectKey(record.subjectKind, record.subjectId);
    this.bySubject.set(key, record);
    this.byExternalRef.set(record.externalPaymentRef, key);
  }

  /** Force next read to fail (outage simulation). */
  simulateOutage(result: Extract<GatewayReadResult, { ok: false }>): void {
    this.failNext = result;
  }

  setArtificialLatencyMs(ms: number): void {
    this.artificialLatencyMs = ms;
  }

  async readPaymentBySubject(input: {
    readonly subjectId: string;
    readonly subjectKind: string;
  }): Promise<GatewayReadResult> {
    const started = Date.now();
    if (this.artificialLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.artificialLatencyMs));
    }
    if (this.failNext !== null) {
      const fail = this.failNext;
      this.failNext = null;
      return {
        ...fail,
        latencyMs: fail.latencyMs ?? Date.now() - started,
      };
    }
    const key = subjectKey(input.subjectKind, input.subjectId);
    const record = this.bySubject.get(key) ?? null;
    return { ok: true, record, latencyMs: Date.now() - started };
  }
}

/**
 * Webhook → Host gateway SoT only.
 * Provider webhook event names must already be mapped by the Host HTTP layer.
 */
export function ingestGatewayWebhookEvent(
  gateway: InMemoryPaymentGateway,
  event: GatewayWebhookIngestEvent
): void {
  gateway.put({
    subjectId: event.subjectId,
    subjectKind: event.subjectKind,
    externalPaymentRef: event.externalPaymentRef,
    lifecycle: event.lifecycle,
    settlement: event.settlement,
    evidence: event.evidence,
    evidenceInspectable: event.evidenceInspectable,
    unsupportedFields: event.unsupportedFields,
  });
}
