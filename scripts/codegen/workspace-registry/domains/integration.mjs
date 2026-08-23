import { BANNER } from "../constants.mjs";

function tsObjectKey(key) {
  return /^[$A-Z_a-z][$\w]*$/.test(key) ? key : JSON.stringify(key);
}

function tsObjectLiteral(entries) {
  return `{ ${entries
    .map(([key, value]) => `${tsObjectKey(key)}: ${JSON.stringify(value)}`)
    .join(", ")} }`;
}

export function generateWorkspaceIntegrationCapabilities(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const capabilities = m.integrationCapabilities;
    const tw = m.tourWrite;
    if (capabilities === undefined || tw === undefined) {
      continue;
    }
    importLines.push(`import { ${tw.workspaceTypeExport} } from "${m.package}/plugin";`);

    for (const [providerId, config] of Object.entries(capabilities)) {
      if (config === undefined || typeof config !== "object") {
        continue;
      }
      const deprecatedEvents = Array.isArray(config.deprecatedEventTypes)
        ? config.deprecatedEventTypes
        : [];
      const deprecatedLiteral =
        deprecatedEvents.length === 0
          ? "undefined"
          : `Object.freeze(${tsObjectLiteral(
              deprecatedEvents.map((entry) => [entry.eventType, entry.supersededBy])
            )})`;
      const deliveryFieldIds = Array.isArray(config.deliveryReferenceDisplayFieldIds)
        ? JSON.stringify(config.deliveryReferenceDisplayFieldIds)
        : "undefined";
      bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    providerId: ${JSON.stringify(providerId)},
    tourPublishedPolicyDriftCheck: ${config.tourPublishedPolicyDriftCheck === true ? "true" : "false"},
    tourPublishedExposureRemap: ${config.tourPublishedExposureRemap === true ? "true" : "false"},
    deprecatedEventTypes: ${deprecatedLiteral},
    deliveryReferenceDisplayFieldIds: ${deliveryFieldIds},
  },`);
    }
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS = [] as const;

export function resolveIntegrationDeprecatedEventSupersededBy(
  _workspaceType: string | null,
  _providerId: string,
  _eventType: string
): string | undefined {
  return undefined;
}

export function requiresTourPublishedPolicyDriftCheck(
  _workspaceType: string | null,
  _providerId: string
): boolean {
  return false;
}

export function listTourPublishedPolicyDriftCheckTargets(): readonly {
  readonly workspaceType: string;
  readonly providerId: string;
}[] {
  return [];
}

export function supportsTourPublishedExposureRemap(
  _workspaceType: string | null,
  _surface: string
): boolean {
  return false;
}

export function listTourPublishedExposureRemapTargets(): readonly {
  readonly workspaceType: string;
  readonly providerId: string;
}[] {
  return [];
}

export function supportsDeliveryReferenceDisplay(
  _workspaceType: string | null,
  _providerId: string
): boolean {
  return false;
}

export function listDeliveryReferenceDisplayFieldIds(
  _workspaceType: string | null,
  _providerId: string
): readonly string[] {
  return [];
}
`;
  }

  return `${BANNER}
${importLines.join("\n")}

export const WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

function normalizeWorkspaceType(workspaceType: string | null): string | null {
  if (workspaceType === null) {
    return null;
  }
  const trimmed = workspaceType.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveBinding(workspaceType: string | null, providerId: string) {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (normalizedWorkspaceType === null) {
    return undefined;
  }
  return WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS.find(
    (entry) => entry.workspaceType === normalizedWorkspaceType && entry.providerId === providerId
  );
}

export function resolveIntegrationDeprecatedEventSupersededBy(
  workspaceType: string | null,
  providerId: string,
  eventType: string
): string | undefined {
  const binding = resolveBinding(workspaceType, providerId);
  const deprecated = binding?.deprecatedEventTypes as Readonly<Record<string, string>> | undefined;
  return deprecated?.[eventType];
}

export function requiresTourPublishedPolicyDriftCheck(
  workspaceType: string | null,
  providerId: string
): boolean {
  const binding = resolveBinding(workspaceType, providerId);
  return binding?.tourPublishedPolicyDriftCheck === true;
}

export function listTourPublishedPolicyDriftCheckTargets(): readonly {
  readonly workspaceType: string;
  readonly providerId: string;
}[] {
  return WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS.filter(
    (entry) => entry.tourPublishedPolicyDriftCheck === true
  ).map((entry) => ({
    workspaceType: entry.workspaceType,
    providerId: entry.providerId,
  }));
}

export function supportsTourPublishedExposureRemap(
  workspaceType: string | null,
  surface: string
): boolean {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (normalizedWorkspaceType === null) {
    return false;
  }
  return WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS.some(
    (entry) =>
      entry.workspaceType === normalizedWorkspaceType &&
      entry.tourPublishedExposureRemap === true &&
      entry.providerId === surface
  );
}

export function listTourPublishedExposureRemapTargets(): readonly {
  readonly workspaceType: string;
  readonly providerId: string;
}[] {
  return WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS.filter(
    (entry) => entry.tourPublishedExposureRemap === true
  ).map((entry) => ({
    workspaceType: entry.workspaceType,
    providerId: entry.providerId,
  }));
}

export function supportsDeliveryReferenceDisplay(
  workspaceType: string | null,
  providerId: string
): boolean {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (normalizedWorkspaceType === null) {
    return false;
  }
  return WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS.some(
    (entry) =>
      entry.workspaceType === normalizedWorkspaceType &&
      entry.providerId === providerId &&
      Array.isArray(entry.deliveryReferenceDisplayFieldIds) &&
      entry.deliveryReferenceDisplayFieldIds.length > 0
  );
}

export function listDeliveryReferenceDisplayFieldIds(
  workspaceType: string | null,
  providerId: string
): readonly string[] {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (normalizedWorkspaceType === null) {
    return [];
  }
  const binding = WORKSPACE_INTEGRATION_CAPABILITY_BINDINGS.find(
    (entry) => entry.workspaceType === normalizedWorkspaceType && entry.providerId === providerId
  );
  return binding?.deliveryReferenceDisplayFieldIds ?? [];
}
`;
}
