/**
 * Host payment gateway boundary (PR10-C) — outside finance-core.
 */

export type {
  GatewayEvidenceState,
  GatewayPaymentLifecycle,
  GatewayPaymentRecord,
  GatewayReadFail,
  GatewayReadOk,
  GatewayReadResult,
  GatewaySettlementState,
  PaymentGatewayPort,
} from "./payment-gateway.port";

export {
  createInMemoryGatewayObservationSink,
  createNoopGatewayObservationSink,
  type GatewayObservationEvent,
  type GatewayObservationSink,
} from "./gateway-observation";

export {
  InMemoryPaymentGateway,
  ingestGatewayWebhookEvent,
  type GatewayWebhookIngestEvent,
} from "./in-memory-payment-gateway";

export {
  StripeGatewayAdapter,
  type StripeLikePaymentLedger,
  type StripeLikePaymentRow,
} from "./stripe-gateway.adapter";

export {
  OnlineGatewayPaymentCaseFactProvider,
  type OnlineGatewayPaymentCaseFactProviderOptions,
} from "./online-gateway-payment-case-fact.provider";

export {
  OnlineGatewayEvidenceCaseFactProvider,
  type OnlineGatewayEvidenceCaseFactProviderOptions,
} from "./online-gateway-evidence-case-fact.provider";
