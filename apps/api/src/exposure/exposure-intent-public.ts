import type { ExposureIntent, ExposureFieldDecorations } from "./exposure-intent";

/** Connection-scoped exposure intent row exposed on integration HTTP DTOs (Phase 7). */
export type ExposureIntentConnectionPublic = {
  readonly id: string;
  readonly workspaceType: string;
  readonly connectionId: string;
  readonly eventType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations?: ExposureFieldDecorations;
  readonly templateId?: string;
  /** True when `scope.eventType` is set on the native intent row. */
  readonly routeScoped: boolean;
  /** True when mode is `override_fields` (admin narrowed the profile defaults). */
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function mapExposureIntentToConnectionPublic(
  intent: ExposureIntent,
): ExposureIntentConnectionPublic {
  const connectionId =
    typeof intent.scope.connectionId === "string" ? intent.scope.connectionId : "";
  const templateOverrideId = intent.templateOverrideId?.trim();
  const surface = intent.surface?.trim() ?? "";
  const audience = intent.audience?.trim() ?? "";
  const trigger = intent.trigger?.trim() ?? "";
  const eventType =
    typeof intent.scope.eventType === "string" && intent.scope.eventType.trim().length > 0
      ? intent.scope.eventType.trim()
      : trigger;
  const routeScoped =
    typeof intent.scope.eventType === "string" && intent.scope.eventType.trim().length > 0;
  return {
    id: intent.id ?? intent.sourceId,
    workspaceType: intent.workspaceType,
    connectionId,
    eventType,
    surface: surface.length > 0 ? surface : "unknown",
    audience: audience.length > 0 ? audience : "external_channel",
    trigger: trigger.length > 0 ? trigger : "",
    selectedFieldIds: intent.mode === "override_fields" ? [...intent.selectedFieldIds] : [],
    routeScoped,
    enabled: intent.mode === "override_fields",
    ...(intent.fieldDecorations === undefined ? {} : { fieldDecorations: intent.fieldDecorations }),
    ...(templateOverrideId == null || templateOverrideId.length === 0
      ? {}
      : { templateId: templateOverrideId }),
    createdAt: intent.createdAt ?? new Date(0).toISOString(),
    updatedAt: intent.updatedAt ?? new Date(0).toISOString(),
  };
}

export function mapLatestExposureIntentsToConnectionPublic(
  intentsNewestFirst: readonly ExposureIntent[],
): readonly ExposureIntentConnectionPublic[] {
  const seenRouteAnchors = new Set<string>();
  const mapped: ExposureIntentConnectionPublic[] = [];

  for (const intent of intentsNewestFirst) {
    const connectionId =
      typeof intent.scope.connectionId === "string" ? intent.scope.connectionId : "";
    const trigger = intent.trigger?.trim() ?? "";
    const eventType =
      typeof intent.scope.eventType === "string" && intent.scope.eventType.trim().length > 0
        ? intent.scope.eventType.trim()
        : trigger;
    const routeAnchor = `${connectionId}\u0000${eventType}`;
    if (seenRouteAnchors.has(routeAnchor)) {
      continue;
    }
    seenRouteAnchors.add(routeAnchor);
    mapped.push(mapExposureIntentToConnectionPublic(intent));
  }

  return mapped;
}
