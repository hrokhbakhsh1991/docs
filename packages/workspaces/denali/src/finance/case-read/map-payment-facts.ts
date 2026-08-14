/**
 * Denali payment / intent SoT → IntentFacts + SettlementFacts.
 * Settlement meaning is a fact contributor — not a Case "settled" verdict.
 */

import type { DenaliPaymentSource } from "./denali-case-read-sources";
import { knownFact, unknownFact } from "./fact-tokens";
import type {
  CasePaymentFactBundle,
  IntentFacts,
  IntentKind,
  IntentSet,
  SettlementFacts,
  SettlementMeaning,
} from "./portable-facts";
import { unknownPaymentBundle } from "./unknown-fact-groups";

function mapIntentKind(method: string, provider: string): IntentKind {
  const m = method.toLowerCase();
  const p = provider.toLowerCase();
  if (m.includes("manual") || p.includes("manual") || p.includes("offline")) {
    return "manual";
  }
  if (m.includes("recur") || p.includes("recur")) {
    return "recurring";
  }
  if (m.includes("gateway") || p.includes("gateway") || p.includes("stripe")) {
    return "one_shot";
  }
  return "other";
}

function isOpenPaymentStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending" || s === "open" || s === "requires_action" || s === "processing";
}

function mapSettlementFromBookingPayment(status: string | null | undefined): SettlementMeaning | null {
  if (status === null || status === undefined) {
    return null;
  }
  const s = status.toLowerCase();
  if (s === "paid") {
    return "captured";
  }
  if (s === "unpaid" || s === "partial") {
    return "unsettled";
  }
  if (s === "refunded") {
    return "refunded";
  }
  if (s === "disputed") {
    return "disputed";
  }
  return null;
}

export function mapDenaliPaymentToPaymentFacts(source: DenaliPaymentSource): CasePaymentFactBundle {
  if (source.readStatus === "failed") {
    return unknownPaymentBundle("payment_read_failed");
  }
  if (source.readStatus === "missing") {
    return unknownPaymentBundle("payment_sot_missing");
  }

  const payments = source.payments ?? [];

  let intentSet: IntentSet;
  if (payments.length === 0) {
    intentSet = "none";
  } else if (payments.length === 1) {
    intentSet = "one";
  } else {
    intentSet = "many";
  }

  const intent: IntentFacts =
    payments.length === 0
      ? {
          intentSet: knownFact("none"),
          intentKind: knownFact("other"),
          intentOpen: knownFact(false),
          provenanceKnown: knownFact(true),
          duplicateOrParallelSuspected: knownFact(false),
        }
      : {
          intentSet: knownFact(intentSet),
          intentKind: knownFact(mapIntentKind(payments[0]!.method, payments[0]!.provider)),
          intentOpen: knownFact(payments.some((p) => isOpenPaymentStatus(p.status))),
          provenanceKnown: knownFact(
            payments.every((p) => p.provider.trim().length > 0 && p.method.trim().length > 0)
          ),
          duplicateOrParallelSuspected: knownFact(payments.length > 1),
        };

  const settlementMapped = mapSettlementFromBookingPayment(source.bookingPaymentStatus);
  const settlement: SettlementFacts =
    settlementMapped === null
      ? { settlementMeaning: unknownFact("settlement_unread") }
      : { settlementMeaning: knownFact(settlementMapped) };

  return { intent, settlement };
}
