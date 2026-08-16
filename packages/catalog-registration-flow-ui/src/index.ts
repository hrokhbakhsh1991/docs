export {
  CatalogRegistrationPhoneStep,
  CatalogRegistrationOtpStep,
  CatalogRegistrationProfileStep,
  catalogRegistrationAuthFlowSteps,
  GuestAuthHostProvider,
  useGuestAuthHost,
  type GuestAuthHost,
} from "./react";
export {
  createPortalSameOriginGuestAuthTransport,
  tryCreatePortalOriginGuestAuthTransport,
  createPortalOriginGuestAuthTransport,
  parsePortalPublicOrigin,
  GuestAuthTransportError,
  isGuestAuthTransportError,
  readGuestAuthFailureCode,
  type GuestAuthTransport,
  type GuestAuthVerifyOutcome,
} from "./guest-auth-transport";
export {
  readCatalogRegistrationFlowData,
  type CatalogRegistrationFlowData,
} from "./flow-data";
export {
  registerCatalogRegistrationTransportInitializer,
  resolveCatalogRegistrationTransportInitialState,
  clearCatalogRegistrationTransportInitializersForTests,
  type CatalogRegistrationTransportInitializer,
} from "./transport-initializer-registry";
export { hydrateCatalogRegistrationIntakeAfterSession } from "./hydrate-intake-after-session";
export {
  completeMemberLoginEgress,
  completeMemberLoginEgressAfterSession,
  completeMemberLoginEgressIfPresent,
  isMemberLoginEgressFromLocation,
  isSafePortalReturnPath,
  readPortalReturnFromLocation,
  resolveMemberLoginEgressPath,
  waitForMemberSessionCookie,
} from "./read-portal-return";
