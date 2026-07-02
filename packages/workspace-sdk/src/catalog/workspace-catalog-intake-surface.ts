import type { CatalogRegistrationPortalPayload, CatalogRegistrationUpstreamRequest } from "./build-catalog-registration-upstream-request";
import type { WorkspaceCatalogIntakeTransportSurface } from "./catalog-intake-transport-surface";
import type { IntakeSchema, IntakeSchemaContext } from "./intake-schema";

/** Workspace-owned catalog registration intake surface (schema + upstream dispatch). */
export type WorkspaceCatalogIntakeSurface = {
  readonly registrationApiPath: string;
  readonly schema: () => IntakeSchema;
  readonly resolveEffectiveSchema: (context: IntakeSchemaContext) => IntakeSchema;
  readonly resolveSubmitValues: (input: {
    readonly context: IntakeSchemaContext;
    readonly formValues: Readonly<Record<string, string>>;
  }) => Readonly<Record<string, string>>;
  readonly transport?: WorkspaceCatalogIntakeTransportSurface;
  readonly buildUpstreamRequest: (
    payload: CatalogRegistrationPortalPayload,
    options?: { readonly idempotencyKey?: string }
  ) => CatalogRegistrationUpstreamRequest;
};
