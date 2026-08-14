/**
 * Gateway proof → portable EvidenceFacts (PR10-C).
 * Companion to OnlineGatewayPaymentCaseFactProvider — no Case ownership/eligibility.
 */

import type {
  CaseEvidenceFactPort,
  CaseFactProviderResult,
  CaseFactReadScope,
  EvidenceFacts,
} from "@app-tour/finance-core/case";
import {
  absentFact,
  knownFact,
  unknownEvidenceFacts,
  unknownFact,
} from "@app-tour/finance-core/case";

import type { GatewayObservationSink } from "./gateway-observation";
import { createNoopGatewayObservationSink } from "./gateway-observation";
import type {
  GatewayEvidenceState,
  GatewayPaymentRecord,
  PaymentGatewayPort,
} from "./payment-gateway.port";

function mapEvidence(state: GatewayEvidenceState, inspectable: boolean | undefined): EvidenceFacts {
  switch (state) {
    case "none":
      return {
        proofExists: absentFact(),
        proofProgress: knownFact("none"),
        evidenceInspectable: knownFact(false),
        evidenceSource: knownFact("gateway"),
      };
    case "present":
      return {
        proofExists: knownFact(true),
        proofProgress: knownFact("none"),
        evidenceInspectable: knownFact(inspectable ?? true),
        evidenceSource: knownFact("gateway"),
      };
    case "in_review":
      return {
        proofExists: knownFact(true),
        proofProgress: knownFact("in_review"),
        evidenceInspectable: knownFact(inspectable ?? true),
        evidenceSource: knownFact("gateway"),
      };
    case "accepted":
      return {
        proofExists: knownFact(true),
        proofProgress: knownFact("accepted"),
        evidenceInspectable: knownFact(inspectable ?? true),
        evidenceSource: knownFact("gateway"),
      };
    case "rejected":
      return {
        proofExists: knownFact(true),
        proofProgress: knownFact("rejected"),
        evidenceInspectable: knownFact(inspectable ?? true),
        evidenceSource: knownFact("gateway"),
      };
    case "unknown":
      return {
        proofExists: unknownFact("gateway_evidence_unread"),
        proofProgress: unknownFact("gateway_evidence_unread"),
        evidenceInspectable: unknownFact("gateway_evidence_unread"),
        evidenceSource: knownFact("gateway"),
      };
    default:
      return unknownEvidenceFacts("gateway_evidence_unread");
  }
}

function assertNoLeak(value: EvidenceFacts, record: GatewayPaymentRecord): boolean {
  const leaked = JSON.stringify(value);
  if (leaked.includes(record.externalPaymentRef)) return false;
  if (/stripe|paypal|braintree|adyen|pi_|ch_|evt_/i.test(leaked)) return false;
  return true;
}

export type OnlineGatewayEvidenceCaseFactProviderOptions = {
  readonly observation?: GatewayObservationSink;
};

export class OnlineGatewayEvidenceCaseFactProvider implements CaseEvidenceFactPort {
  private readonly observation: GatewayObservationSink;

  constructor(
    private readonly gateway: PaymentGatewayPort,
    options: OnlineGatewayEvidenceCaseFactProviderOptions = {}
  ) {
    this.observation = options.observation ?? createNoopGatewayObservationSink();
  }

  async readEvidenceFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<EvidenceFacts>> {
    try {
      const result = await this.gateway.readPaymentBySubject({
        subjectId: scope.subjectId,
        subjectKind: scope.subjectKind,
      });

      if (!result.ok) {
        this.observation.observe({
          kind: "provider_degradation",
          subjectId: scope.subjectId,
          reason: `evidence_${result.reason}`,
        });
        return {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownEvidenceFacts(`gateway_evidence_${result.reason}`),
        };
      }

      if (result.record === null) {
        return {
          ok: true,
          value: mapEvidence("none", false),
        };
      }

      const value = mapEvidence(result.record.evidence, result.record.evidenceInspectable);
      if (!assertNoLeak(value, result.record)) {
        return {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownEvidenceFacts("gateway_evidence_metadata_leak_blocked"),
        };
      }
      return { ok: true, value };
    } catch {
      this.observation.observe({
        kind: "provider_degradation",
        subjectId: scope.subjectId,
        reason: "gateway_evidence_throw",
      });
      return {
        ok: false,
        degraded: true,
        failureReason: "unavailable",
        value: unknownEvidenceFacts("gateway_evidence_throw"),
      };
    }
  }
}
