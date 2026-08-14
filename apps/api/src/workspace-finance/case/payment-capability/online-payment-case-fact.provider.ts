/**
 * Online payment capability adapter — fake/test contract (PR10-B).
 * Gateway-specific fields stay on the Host snapshot; only portable facts leave.
 * No real gateway SDK / webhooks / capture.
 */

import type {
  CaseFactProviderResult,
  CaseFactReadScope,
  CasePaymentFactBundle,
  CasePaymentFactPort,
} from "@app-tour/finance-core/case";
import {
  knownFact,
  unknownFact,
  unknownPaymentBundle,
} from "@app-tour/finance-core/case";

/**
 * Host-only fake gateway snapshot — must never be passed into CaseFacts.
 */
export type FakeOnlineGatewayPaymentSnapshot = {
  /** Gateway brand id — adapter-local only. */
  readonly stripePaymentIntentId: string;
  readonly stripeCustomerId?: string;
  readonly webhookEventId?: string;
  readonly status:
    | "requires_payment_method"
    | "processing"
    | "succeeded"
    | "canceled"
    | "unknown";
  /** When true, treat as provider failure → unknown facts. */
  readonly readFailed?: boolean;
};

export type OnlinePaymentGatewayLoader = (
  scope: CaseFactReadScope
) => Promise<FakeOnlineGatewayPaymentSnapshot | null>;

function mapSettlement(
  status: FakeOnlineGatewayPaymentSnapshot["status"]
): CasePaymentFactBundle["settlement"] {
  switch (status) {
    case "succeeded":
      return { settlementMeaning: knownFact("captured") };
    case "requires_payment_method":
    case "processing":
      return { settlementMeaning: knownFact("unsettled") };
    case "canceled":
      return { settlementMeaning: knownFact("idle") };
    case "unknown":
      return { settlementMeaning: unknownFact("gateway_settlement_unread") };
    default:
      return { settlementMeaning: unknownFact("gateway_settlement_unread") };
  }
}

/**
 * Fake online provider proving the same CasePaymentFactPort shape.
 * Stripe/webhook ids are read then discarded from the fact payload.
 */
export class OnlinePaymentCaseFactProvider implements CasePaymentFactPort {
  constructor(private readonly loadGateway: OnlinePaymentGatewayLoader) {}

  async readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    try {
      const snap = await this.loadGateway(scope);
      if (snap === null) {
        // Successful empty read — no intent (not a failed payment).
        return {
          ok: true,
          value: {
            intent: {
              intentSet: knownFact("none"),
              intentKind: knownFact("one_shot"),
              intentOpen: knownFact(false),
              provenanceKnown: knownFact(true),
              duplicateOrParallelSuspected: knownFact(false),
            },
            settlement: { settlementMeaning: knownFact("idle") },
          },
        };
      }
      if (snap.readFailed === true) {
        return {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownPaymentBundle("online_gateway_unavailable"),
        };
      }

      const open =
        snap.status === "requires_payment_method" || snap.status === "processing";
      const value: CasePaymentFactBundle = {
        intent: {
          intentSet: knownFact("one"),
          intentKind: knownFact("one_shot"),
          intentOpen: knownFact(open),
          provenanceKnown: knownFact(true),
          duplicateOrParallelSuspected: knownFact(false),
        },
        settlement: mapSettlement(snap.status),
      };
      // Prove gateway metadata never enters the portable bundle.
      const leaked = JSON.stringify(value);
      if (
        leaked.includes("stripe") ||
        leaked.includes(snap.stripePaymentIntentId) ||
        (snap.stripeCustomerId !== undefined && leaked.includes(snap.stripeCustomerId))
      ) {
        return {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownPaymentBundle("gateway_metadata_leak_blocked"),
        };
      }
      return { ok: true, value };
    } catch {
      return {
        ok: false,
        degraded: true,
        failureReason: "unavailable",
        value: unknownPaymentBundle("online_gateway_throw"),
      };
    }
  }
}
