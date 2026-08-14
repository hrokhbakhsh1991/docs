/**
 * Ephemeral Host recon session — per-request cache only (PR11-B).
 * Not Case persistence; discarded with the request composition.
 */

import type { CaseFactReadScope } from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port";
import type { PaymentGatewayPort } from "../payment-capability/gateway/payment-gateway.port";
import {
  buildFinanceSotObservation,
  buildGatewayObservation,
} from "./build-recon-observations";
import { classifyPaymentReconciliation } from "./classify-payment-reconciliation";
import type { HostReconClassification } from "./types";

export type HostReconciliationSessionDeps = {
  readonly source: DenaliCaseReadSourcePort;
  readonly gateway: PaymentGatewayPort | null;
};

/**
 * Load gateway + SoT, classify, cache by caseKey for the composition lifetime.
 */
export class HostReconciliationSession {
  private readonly cache = new Map<string, HostReconClassification>();

  constructor(private readonly deps: HostReconciliationSessionDeps) {}

  async classifyForScope(scope: CaseFactReadScope): Promise<HostReconClassification> {
    const cached = this.cache.get(scope.caseKey);
    if (cached !== undefined) return cached;

    const gatewayResult =
      this.deps.gateway === null
        ? null
        : await this.deps.gateway.readPaymentBySubject({
            subjectId: scope.subjectId,
            subjectKind: scope.subjectKind,
          });

    const [payment, evidence] = await Promise.all([
      this.deps.source.readPayment(scope),
      this.deps.source.readEvidence(scope),
    ]);

    const classification = classifyPaymentReconciliation({
      gateway: buildGatewayObservation(gatewayResult),
      finance: buildFinanceSotObservation({ payment, evidence }),
    });

    this.cache.set(scope.caseKey, classification);
    return classification;
  }
}
