/**
 * Compose Denali Case providers with Host reconciliation cue emission (PR11-B).
 */

import type { CaseFactAssemblerProviders } from "@app-tour/finance-core/case";
import { knownFact } from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port";
import type { CreateDenaliCaseFactProvidersOptions } from "../create-denali-case-providers";
import {
  createDenaliCaseFactProvidersWithPaymentCapability,
  type PaymentCapabilityComposeInput,
} from "../payment-capability/create-providers-with-payment-capability";
import type { PaymentGatewayPort } from "../payment-capability/gateway/payment-gateway.port";
import { HostReconciliationSession } from "./host-reconciliation-session";
import {
  ReconAugmentedLedgerFactProvider,
  ReconAugmentedLifecycleFactProvider,
  ReconAugmentedPaymentFactProvider,
  ReconAugmentedSignalFactProvider,
} from "./recon-augmented-fact-providers";

export type ReconciliationComposeInput = PaymentCapabilityComposeInput & {
  /**
   * When true (default if gateway provided), wrap providers with recon cue emission.
   * Manual-only paths may set enabled: false to leave providers untouched.
   */
  readonly reconciliationEnabled?: boolean;
};

/**
 * Payment capability composition + optional Host recon cue augmentation.
 * finance-core never receives recon types or finding codes as imports from this module.
 */
export function createDenaliCaseFactProvidersWithReconciliation(
  source: DenaliCaseReadSourcePort,
  capability: ReconciliationComposeInput,
  options: CreateDenaliCaseFactProvidersOptions = {}
): CaseFactAssemblerProviders {
  const base = createDenaliCaseFactProvidersWithPaymentCapability(source, capability, options);
  const enabled =
    capability.reconciliationEnabled ?? capability.gateway !== undefined;

  if (!enabled) {
    return base;
  }

  const gateway: PaymentGatewayPort | null = capability.gateway ?? null;
  const session = new HostReconciliationSession({ source, gateway });

  const providers: CaseFactAssemblerProviders = {
    ...base,
    payment: new ReconAugmentedPaymentFactProvider(base.payment, session),
    lifecycle: new ReconAugmentedLifecycleFactProvider(base.lifecycle, session),
    ledger:
      base.ledger !== undefined
        ? new ReconAugmentedLedgerFactProvider(base.ledger, session)
        : new ReconAugmentedLedgerFactProvider(
            {
              async readAuditCues() {
                return {
                  ok: true,
                  value: {
                    ledgerRefsPresent: knownFact(false),
                    reconFinding: knownFact("none"),
                  },
                };
              },
            },
            session
          ),
    signal: new ReconAugmentedSignalFactProvider(base.signal ?? null, session),
  };

  return providers;
}
