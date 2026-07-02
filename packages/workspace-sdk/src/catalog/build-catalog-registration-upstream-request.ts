import { getWorkspaceIntakePlugin } from "./workspace-intake-plugin-registry";
import { IntakePluginNotRegisteredError } from "./resolve-intake-schema";

export type CatalogRegistrationPortalPayload = {
  readonly tourId: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly partySize: number;
  readonly notes: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
  readonly registrantTarget?: "self" | "other";
  readonly transport?: unknown;
};

export type CatalogRegistrationUpstreamRequest = {
  readonly path: string;
  readonly body: unknown;
  readonly extraHeaders?: Readonly<Record<string, string>>;
};

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
