/**
 * Workspace portability simulation exports (PR13-C).
 * Not a production workspace package — Host proof only.
 */

export {
  composeMarketplaceCaseFactProviders,
  MarketplaceEvidenceCaseFactProvider,
  MarketplaceLifecycleCaseFactProvider,
  MarketplaceObligationCaseFactProvider,
  MarketplacePaymentCaseFactProvider,
  type MarketplaceCaseReadSource,
  type MarketplaceEvidenceSoT,
  type MarketplaceLifecycleSoT,
  type MarketplacePaymentSoT,
  type MarketplaceReconCue,
} from "./compose-marketplace-case-providers";
export {
  composeStaticPortableCaseProviders,
  type StaticPortableFactSet,
} from "./compose-static-portable-providers";
export * from "./portable-fact-fixtures";
