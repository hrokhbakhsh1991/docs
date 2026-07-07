import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

import { exposureSelectableFieldIds } from "./exposure-field-catalog";
import {
  resolveSeededExposureProfile,
  type ExposureProfile,
  type ExposureProfileContext,
} from "./exposure-profile";

function resolveWorkspaceMessageTemplateSeed(
  workspaceType: string,
  eventType: string,
): string | null {
  try {
    const plugin = resolveWorkspacePluginForType(workspaceType);
    const template = plugin.integrationSurface?.messageTemplates?.[eventType];
    return typeof template === "string" && template.trim().length > 0 ? template.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Phase 4 — builds an in-memory ExposureProfile from registry deliverable seed metadata.
 */
export function resolveDeliveryExposureProfileContext(
  eventType?: string,
): Partial<ExposureProfileContext> {
  return {
    entityType: "tour",
    surface: "telegram",
    audience: "external_channel",
    trigger: eventType ?? "TourCreated",
  };
}

export function resolveRegistrySeededExposureProfile(
  context: ExposureProfileContext,
): ExposureProfile | null {
  if (context.workspaceType === null || context.workspaceType.trim().length === 0) {
    return null;
  }

  const defaultFieldIds = exposureSelectableFieldIds(context.workspaceType);
  const defaultTemplateId = resolveWorkspaceMessageTemplateSeed(
    context.workspaceType,
    context.trigger,
  );

  return resolveSeededExposureProfile({
    workspaceType: context.workspaceType,
    entityType: context.entityType,
    surface: context.surface,
    audience: context.audience,
    trigger: context.trigger,
    defaultFieldIds,
    ...(defaultTemplateId === null ? {} : { defaultTemplateId }),
  });
}

export function resolveExposureProfileDefaultFieldIds(
  workspaceType: string | null,
  context: Partial<ExposureProfileContext> = {},
): readonly string[] {
  const profile = resolveRegistrySeededExposureProfile({
    workspaceType,
    entityType: context.entityType ?? "tour",
    surface: context.surface ?? "telegram",
    audience: context.audience ?? "external_channel",
    trigger: context.trigger ?? "TourCreated",
  });
  return profile?.defaultFieldIds ?? [];
}

export function resolveExposureRequestedFieldIds(
  adminSelectedFieldIds: readonly string[] | null | undefined,
  workspaceType: string | null,
  context: Partial<ExposureProfileContext> = {},
): readonly string[] {
  if (adminSelectedFieldIds != null) {
    return adminSelectedFieldIds;
  }
  return resolveExposureProfileDefaultFieldIds(workspaceType, context);
}
