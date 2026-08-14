/**
 * Host payment capability adapters (PR10-B/C) — CasePaymentFactPort selection + gateway.
 */

export type { PaymentCapabilityMode } from "./types";
export {
  selectPaymentCaseFactProvider,
  type PaymentCaseFactProviderSet,
} from "./select-payment-case-fact-provider";
export { ManualPaymentCaseFactProvider } from "./manual-payment-case-fact.provider";
export {
  OnlinePaymentCaseFactProvider,
  type FakeOnlineGatewayPaymentSnapshot,
  type OnlinePaymentGatewayLoader,
} from "./online-payment-case-fact.provider";
export {
  createDenaliCaseFactProvidersWithPaymentCapability,
  type PaymentCapabilityComposeInput,
} from "./create-providers-with-payment-capability";
export {
  createInMemoryGatewayObservationSink,
  createNoopGatewayObservationSink,
  InMemoryPaymentGateway,
  ingestGatewayWebhookEvent,
  OnlineGatewayEvidenceCaseFactProvider,
  OnlineGatewayPaymentCaseFactProvider,
  StripeGatewayAdapter,
  type GatewayObservationEvent,
  type GatewayObservationSink,
  type GatewayPaymentRecord,
  type GatewayWebhookIngestEvent,
  type PaymentGatewayPort,
  type StripeLikePaymentLedger,
  type StripeLikePaymentRow,
} from "./gateway/index";
