/**
 * Denali Case production composition (PR11-C).
 *
 * Gateway observations + Denali SoTs
 *   → payment capability
 *   → optional Host reconciliation cues
 *   → CaseFactAssemblerProviders
 *
 * finance-core never imports this module or paymentMode / gateway types.
 */

import type { CaseFactAssemblerProviders } from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../case-read/denali-case-read-source.port";
import {
  createDenaliCaseFactProviders,
  type CreateDenaliCaseFactProvidersOptions,
} from "./create-denali-case-providers";
import type { GatewayObservationSink } from "./payment-capability/gateway/gateway-observation";
import type { PaymentGatewayPort } from "./payment-capability/gateway/payment-gateway.port";
import type { PaymentCapabilityMode } from "./payment-capability/types";
import { createDenaliCaseFactProvidersWithReconciliation } from "./reconciliation/create-providers-with-reconciliation";

export const FINANCE_CASE_PAYMENT_MODE_ENV = "FINANCE_CASE_PAYMENT_MODE";
export const FINANCE_CASE_RECONCILIATION_ENABLED_ENV =
  "FINANCE_CASE_RECONCILIATION_ENABLED";

/**
 * Host-only Denali capability knobs — never passed into finance-core.
 */
export type DenaliCaseCapabilityConfig = {
  readonly paymentMode: PaymentCapabilityMode;
  /** Required for meaningful online mode; when omitted online uses unknown stub. */
  readonly gateway?: PaymentGatewayPort;
  /**
   * When omitted: enabled iff `gateway` is provided.
   * Manual-without-gateway defaults to recon off (legacy parity).
   */
  readonly reconciliationEnabled?: boolean;
  readonly observation?: GatewayObservationSink;
};

export type ComposeDenaliCaseFactProvidersInput = {
  readonly source: DenaliCaseReadSourcePort;
  readonly capability?: DenaliCaseCapabilityConfig;
  readonly options?: CreateDenaliCaseFactProvidersOptions;
};

function resolveReconciliationEnabled(capability: DenaliCaseCapabilityConfig): boolean {
  if (capability.reconciliationEnabled !== undefined) {
    return capability.reconciliationEnabled;
  }
  return capability.gateway !== undefined;
}

/**
 * Resolve Host capability from env (+ optional gateway injection).
 * Defaults: paymentMode=manual, reconciliation off unless gateway present.
 */
export function resolveDenaliCaseCapabilityFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  inject?: {
    readonly gateway?: PaymentGatewayPort;
    readonly observation?: GatewayObservationSink;
    readonly reconciliationEnabled?: boolean;
  }
): DenaliCaseCapabilityConfig {
  const rawMode = env[FINANCE_CASE_PAYMENT_MODE_ENV];
  const normalized = String(rawMode ?? "manual")
    .trim()
    .toLowerCase();
  const paymentMode: PaymentCapabilityMode =
    normalized === "online" ? "online" : "manual";

  let reconciliationEnabled = inject?.reconciliationEnabled;
  if (reconciliationEnabled === undefined) {
    const rawRecon = env[FINANCE_CASE_RECONCILIATION_ENABLED_ENV];
    if (rawRecon !== undefined && rawRecon !== null && String(rawRecon).trim().length > 0) {
      const n = String(rawRecon).trim().toLowerCase();
      reconciliationEnabled =
        n === "1" || n === "true" || n === "yes" || n === "on";
    }
  }

  return {
    paymentMode,
    gateway: inject?.gateway,
    observation: inject?.observation,
    reconciliationEnabled,
  };
}

/**
 * Single Denali DI seam for shadow / encounter / live Case execution.
 * Observational only — never mutates SoTs.
 */
export function composeDenaliCaseFactProviders(
  input: ComposeDenaliCaseFactProvidersInput
): CaseFactAssemblerProviders {
  const capability = input.capability ?? { paymentMode: "manual" as const };
  const reconEnabled = resolveReconciliationEnabled(capability);
  const options = input.options ?? {};

  // Fast path: legacy manual Denali providers (no payment capability wrap, no recon).
  if (capability.paymentMode === "manual" && !reconEnabled && capability.gateway === undefined) {
    return createDenaliCaseFactProviders(input.source, options);
  }

  return createDenaliCaseFactProvidersWithReconciliation(
    input.source,
    {
      mode: capability.paymentMode,
      gateway: capability.gateway,
      observation: capability.observation,
      reconciliationEnabled: reconEnabled,
    },
    options
  );
}
