/**
 * Workspace integration surface — provider defaults, mappings, and templates.
 * Declared on {@link WorkspacePlugin.integrationSurface}; consumed by API integration platform.
 */

export type IntegrationFieldKind = "string" | "secret";

export type IntegrationFieldSchema = {
  readonly id: string;
  readonly kind: IntegrationFieldKind;
  readonly requiredOnCreate: boolean;
};

export type WorkspaceIntegrationEventPolicyDefault = {
  readonly eventType: string;
  readonly enabled: boolean;
};

export type WorkspaceIntegrationEventMapping = {
  readonly eventType: string;
  readonly capability: string;
};

export type WorkspaceIntegrationProviderSurface = {
  readonly id: string;
  readonly configFields: readonly IntegrationFieldSchema[];
  readonly credentialFields: readonly IntegrationFieldSchema[];
  readonly defaultCapabilities: readonly string[];
  readonly defaultEventPolicies: readonly WorkspaceIntegrationEventPolicyDefault[];
  readonly eventMappings: readonly WorkspaceIntegrationEventMapping[];
};

export type WorkspaceCanonicalDeliveryProjectionInput = {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly eligibleFieldIds: readonly string[];
  readonly definitions: readonly {
    readonly id: string;
    readonly canonicalPath: string;
    readonly kind: string;
  }[];
  readonly referenceDisplayValues?: Readonly<Record<string, string>>;
};

export type WorkspaceIntegrationSurface = {
  readonly manifestVersion: 1;
  readonly providers: readonly WorkspaceIntegrationProviderSurface[];
  /** Outbound message templates keyed by domain event type. Supports `{{title}}`, `{{aggregateId}}`, `{{eventType}}`. */
  readonly messageTemplates?: Readonly<Record<string, string>>;
  readonly projectCanonicalDeliveryFields?: (
    input: WorkspaceCanonicalDeliveryProjectionInput
  ) => Readonly<Record<string, string>>;
};

const INTEGRATION_FIELD_KINDS: readonly IntegrationFieldKind[] = ["string", "secret"] as const;

function isIntegrationFieldKind(value: string): value is IntegrationFieldKind {
  return (INTEGRATION_FIELD_KINDS as readonly string[]).includes(value);
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`INTEGRATION_SURFACE_INVALID:${label}`);
  }
  return value.trim();
}

function validateFieldSchemas(fields: readonly IntegrationFieldSchema[], label: string): void {
  const seen = new Set<string>();
  for (const field of fields) {
    const id = assertNonEmptyString(field.id, `${label}.id`);
    if (seen.has(id)) {
      throw new Error(`INTEGRATION_SURFACE_DUPLICATE_FIELD:${label}:${id}`);
    }
    seen.add(id);
    if (!isIntegrationFieldKind(field.kind)) {
      throw new Error(`INTEGRATION_SURFACE_INVALID_FIELD_KIND:${label}:${id}`);
    }
  }
}

/** Fail closed before plugin registry construction. */
export function validateIntegrationSurface(surface: WorkspaceIntegrationSurface): void {
  if (surface.manifestVersion !== 1) {
    throw new Error(`INTEGRATION_SURFACE_INVALID_MANIFEST_VERSION:${surface.manifestVersion}`);
  }

  const providerIds = new Set<string>();
  for (const provider of surface.providers) {
    const id = assertNonEmptyString(provider.id, "provider.id");
    if (providerIds.has(id)) {
      throw new Error(`INTEGRATION_SURFACE_DUPLICATE_PROVIDER:${id}`);
    }
    providerIds.add(id);

    validateFieldSchemas(provider.configFields, `provider.${id}.configFields`);
    validateFieldSchemas(provider.credentialFields, `provider.${id}.credentialFields`);

    if (provider.defaultCapabilities.length === 0) {
      throw new Error(`INTEGRATION_SURFACE_EMPTY_CAPABILITIES:${id}`);
    }

    for (const capability of provider.defaultCapabilities) {
      assertNonEmptyString(capability, `provider.${id}.defaultCapabilities`);
    }

    for (const policy of provider.defaultEventPolicies) {
      assertNonEmptyString(policy.eventType, `provider.${id}.defaultEventPolicies.eventType`);
    }

    for (const mapping of provider.eventMappings) {
      assertNonEmptyString(mapping.eventType, `provider.${id}.eventMappings.eventType`);
      assertNonEmptyString(mapping.capability, `provider.${id}.eventMappings.capability`);
    }
  }

  if (surface.messageTemplates !== undefined) {
    for (const [eventType, template] of Object.entries(surface.messageTemplates)) {
      assertNonEmptyString(eventType, "messageTemplates.eventType");
      assertNonEmptyString(template, `messageTemplates.${eventType}`);
    }
  }
}
