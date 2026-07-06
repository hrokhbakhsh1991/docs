import { getWorkspaceIntakePlugin } from "./workspace-intake-plugin-registry";
import { IntakePluginNotRegisteredError } from "./resolve-intake-schema";
import type {
  CatalogRegistrationPortalPayload,
  CatalogRegistrationUpstreamRequest,
} from "./catalog-registration-upstream.types";

export type {
  CatalogRegistrationPortalPayload,
  CatalogRegistrationUpstreamRequest,
} from "./catalog-registration-upstream.types";

export class CatalogRegistrationPayloadInvalidError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CatalogRegistrationPayloadInvalidError";
    this.code = code;
  }
}

/** Build upstream registration request for portal BFF via workspace plugin registry. */
export function buildCatalogRegistrationUpstreamRequest(
  pluginId: string,
  payload: CatalogRegistrationPortalPayload,
  options?: { readonly idempotencyKey?: string }
): CatalogRegistrationUpstreamRequest {
  const registered = getWorkspaceIntakePlugin(pluginId);
  if (registered === null) {
    throw new IntakePluginNotRegisteredError(pluginId);
  }
  return registered.catalogIntake.buildUpstreamRequest(payload, options);
}
