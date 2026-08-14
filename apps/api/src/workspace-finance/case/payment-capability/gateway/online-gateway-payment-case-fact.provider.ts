/**
 * Real online gateway → CasePaymentFactPort (PR10-C).
 * Translates PaymentGatewayPort records → portable Intent/Settlement facts only.
 * Forbidden: ownership, eligibility, exception, Case state creation.
 */

import type {
  CaseFactProviderResult,
  CaseFactReadScope,
  CasePaymentFactBundle,
  CasePaymentFactPort,
  IntentFacts,
  SettlementFacts,
} from "@app-tour/finance-core/case";
import {
  knownFact,
  unknownFact,
  unknownPaymentBundle,
} from "@app-tour/finance-core/case";

import type { GatewayObservationSink } from "./gateway-observation";
import { createNoopGatewayObservationSink } from "./gateway-observation";
import type {
  GatewayPaymentLifecycle,
  GatewayPaymentRecord,
  GatewaySettlementState,
  PaymentGatewayPort,
} from "./payment-gateway.port";

function mapIntent(lifecycle: GatewayPaymentLifecycle): IntentFacts {
  switch (lifecycle) {
    case "intent_none":
      return {
        intentSet: knownFact("none"),
        intentKind: knownFact("one_shot"),
        intentOpen: knownFact(false),
        provenanceKnown: knownFact(true),
        duplicateOrParallelSuspected: knownFact(false),
      };
    case "intent_requires_action":
    case "intent_processing":
      return {
        intentSet: knownFact("one"),
        intentKind: knownFact("one_shot"),
        intentOpen: knownFact(true),
        provenanceKnown: knownFact(true),
        duplicateOrParallelSuspected: knownFact(false),
      };
    case "intent_succeeded":
      return {
        intentSet: knownFact("one"),
        intentKind: knownFact("one_shot"),
        intentOpen: knownFact(false),
        provenanceKnown: knownFact(true),
        duplicateOrParallelSuspected: knownFact(false),
      };
    case "intent_canceled":
      return {
        intentSet: knownFact("one"),
        intentKind: knownFact("one_shot"),
        intentOpen: knownFact(false),
        provenanceKnown: knownFact(true),
        duplicateOrParallelSuspected: knownFact(false),
      };
    case "intent_unknown":
      return {
        intentSet: unknownFact("gateway_intent_unread"),
        intentKind: unknownFact("gateway_intent_unread"),
        intentOpen: unknownFact("gateway_intent_unread"),
        provenanceKnown: knownFact(false),
        duplicateOrParallelSuspected: unknownFact("gateway_intent_unread"),
      };
    default:
      return {
        intentSet: unknownFact("gateway_intent_unread"),
        intentKind: unknownFact("gateway_intent_unread"),
        intentOpen: unknownFact("gateway_intent_unread"),
        provenanceKnown: knownFact(false),
        duplicateOrParallelSuspected: unknownFact("gateway_intent_unread"),
      };
  }
}

/**
 * Settlement mapping:
 * - pending → unsettled
 * - settled → captured
 * - none with no intent → idle
 * - unknown / missing after success → unknown (NOT unpaid/unsettled)
 */
function mapSettlement(
  settlement: GatewaySettlementState,
  lifecycle: GatewayPaymentLifecycle
): SettlementFacts {
  switch (settlement) {
    case "pending":
      return { settlementMeaning: knownFact("unsettled") };
    case "settled":
      return { settlementMeaning: knownFact("captured") };
    case "refunded":
      return { settlementMeaning: knownFact("refunded") };
    case "disputed":
      return { settlementMeaning: knownFact("disputed") };
    case "none":
      if (lifecycle === "intent_none" || lifecycle === "intent_canceled") {
        return { settlementMeaning: knownFact("idle") };
      }
      // Missing settlement with an active/succeeded intent ≠ unpaid.
      return { settlementMeaning: unknownFact("gateway_settlement_absent") };
    case "unknown":
      return { settlementMeaning: unknownFact("gateway_settlement_unread") };
    default:
      return { settlementMeaning: unknownFact("gateway_settlement_unread") };
  }
}

function assertNoGatewayLeak(
  value: CasePaymentFactBundle,
  record: GatewayPaymentRecord
): boolean {
  const leaked = JSON.stringify(value);
  if (leaked.includes(record.externalPaymentRef)) return false;
  if (/stripe|paypal|braintree|adyen|pi_|ch_|evt_/i.test(leaked)) return false;
  return true;
}

export type OnlineGatewayPaymentCaseFactProviderOptions = {
  readonly observation?: GatewayObservationSink;
};

/**
 * Online gateway payment fact provider — real Host adapter over PaymentGatewayPort.
 */
export class OnlineGatewayPaymentCaseFactProvider implements CasePaymentFactPort {
  private readonly observation: GatewayObservationSink;

  constructor(
    private readonly gateway: PaymentGatewayPort,
    options: OnlineGatewayPaymentCaseFactProviderOptions = {}
  ) {
    this.observation = options.observation ?? createNoopGatewayObservationSink();
  }

  async readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    try {
      const result = await this.gateway.readPaymentBySubject({
        subjectId: scope.subjectId,
        subjectKind: scope.subjectKind,
      });

      if (result.latencyMs !== undefined) {
        this.observation.observe({
          kind: "provider_latency",
          subjectId: scope.subjectId,
          latencyMs: result.latencyMs,
        });
      }

      if (!result.ok) {
        this.observation.observe({
          kind: "provider_degradation",
          subjectId: scope.subjectId,
          reason: result.reason,
        });
        return {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownPaymentBundle(`gateway_${result.reason}`),
        };
      }

      if (result.record === null) {
        return {
          ok: true,
          value: {
            intent: mapIntent("intent_none"),
            settlement: mapSettlement("none", "intent_none"),
          },
        };
      }

      const record = result.record;
      if (record.unsupportedFields !== undefined && record.unsupportedFields.length > 0) {
        this.observation.observe({
          kind: "unsupported_gateway_fields",
          subjectId: scope.subjectId,
          fields: record.unsupportedFields,
        });
      }

      const value: CasePaymentFactBundle = {
        intent: mapIntent(record.lifecycle),
        settlement: mapSettlement(record.settlement, record.lifecycle),
      };

      if (!assertNoGatewayLeak(value, record)) {
        this.observation.observe({
          kind: "provider_degradation",
          subjectId: scope.subjectId,
          reason: "gateway_metadata_leak_blocked",
        });
        return {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownPaymentBundle("gateway_metadata_leak_blocked"),
        };
      }

      return { ok: true, value };
    } catch {
      this.observation.observe({
        kind: "provider_degradation",
        subjectId: scope.subjectId,
        reason: "gateway_throw",
      });
      return {
        ok: false,
        degraded: true,
        failureReason: "unavailable",
        value: unknownPaymentBundle("online_gateway_throw"),
      };
    }
  }
}
