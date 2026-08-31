import { HARBOR_HTTP_ROUTE_MANIFEST } from "./routes-manifest";

export {
  handleGetHarborCatalog,
  handleGetHarborCatalogTour,
  handlePostHarborRegistration,
} from "./harbor-catalog-http";
export {
  configureHarborHttpHost,
  getHarborHttpHost,
  resetHarborHttpHostForTests,
  tryGetHarborHttpHost,
} from "./harbor-http-host";
export type {
  BookingPublicPort,
  HarborHttpHostPorts,
  HarborProductRouteDeps,
  HarborTourStorePort,
} from "./harbor-http-host";
export {
  HARBOR_REGISTRATION_DUPLICATE,
  HarborRegistrationDuplicateError,
  isHarborRegistrationDuplicateError,
  HARBOR_WORKSPACE_REQUIRED,
  HarborWorkspaceRequiredError,
  isHarborWorkspaceRequiredError,
} from "../registration/harbor-registration.errors";
export { HARBOR_HTTP_ROUTE_MANIFEST };
