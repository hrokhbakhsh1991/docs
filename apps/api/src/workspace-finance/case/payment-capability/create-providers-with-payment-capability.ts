/**
 * Compose Denali Case providers with Host payment capability selection (PR10-B/C).
 */

import type {
  CaseEvidenceFactPort,
  CaseFactAssemblerProviders,
  CasePaymentFactPort,
} from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port";
import {
  createDenaliCaseFactProviders,
  type CreateDenaliCaseFactProvidersOptions,
} from "../create-denali-case-providers";
import {
  OnlineGatewayEvidenceCaseFactProvider,
  OnlineGatewayPaymentCaseFactProvider,
  type GatewayObservationSink,
  type PaymentGatewayPort,
} from "./gateway/index";
import { ManualPaymentCaseFactProvider } from "./manual-payment-case-fact.provider";
import { OnlinePaymentCaseFactProvider } from "./online-payment-case-fact.provider";
import { selectPaymentCaseFactProvider } from "./select-payment-case-fact-provider";
import type { PaymentCapabilityMode } from "./types";

export type PaymentCapabilityComposeInput = {
  readonly mode: PaymentCapabilityMode;
  /**
   * PR10-C real gateway. When mode is `online` and gateway is set,
   * OnlineGateway* providers are used (payment + evidence).
   */
  readonly gateway?: PaymentGatewayPort;
  /** Optional non-blocking observation for gateway reads. */
  readonly observation?: GatewayObservationSink;
  /**
   * Explicit online payment override (PR10-B fake / tests).
   * Ignored when `gateway` is provided.
   */
  readonly online?: CasePaymentFactPort;
  /** Explicit evidence override (tests). When gateway is set in online mode, defaults to gateway evidence. */
  readonly evidence?: CaseEvidenceFactPort;
};

/**
 * Host seam: paymentMode → CasePaymentFactPort → existing assembler providers.
 * finance-core never receives paymentMode or gateway types.
 */
export function createDenaliCaseFactProvidersWithPaymentCapability(
  source: DenaliCaseReadSourcePort,
  capability: PaymentCapabilityComposeInput,
  options: CreateDenaliCaseFactProvidersOptions = {}
): CaseFactAssemblerProviders {
  const manual = new ManualPaymentCaseFactProvider(source);

  const online: CasePaymentFactPort =
    capability.gateway !== undefined
      ? new OnlineGatewayPaymentCaseFactProvider(capability.gateway, {
          observation: capability.observation,
        })
      : (capability.online ??
        new OnlinePaymentCaseFactProvider(async () => ({
          stripePaymentIntentId: "pi_unsupported",
          status: "unknown",
          readFailed: true,
        })));

  const payment = selectPaymentCaseFactProvider({
    mode: capability.mode,
    providers: { manual, online },
  });

  const evidence: CaseEvidenceFactPort | undefined =
    capability.evidence ??
    (capability.mode === "online" && capability.gateway !== undefined
      ? new OnlineGatewayEvidenceCaseFactProvider(capability.gateway, {
          observation: capability.observation,
        })
      : undefined);

  return createDenaliCaseFactProviders(source, {
    ...options,
    payment,
    ...(evidence !== undefined ? { evidence } : {}),
  });
}
