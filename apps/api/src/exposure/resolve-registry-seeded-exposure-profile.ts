import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

import { exposureSelectableFieldIds } from "./exposure-field-catalog";
import {
  resolveSeededExposureProfile,
  type ExposureProfile,
  type ExposureProfileContext,
} from "./exposure-profile";

async function resolveWorkspaceMessageTemplateSeed(
  workspaceType: string,
  eventType: string,
): Promise<string | null> {
  try {
    const plugin = await resolveWorkspacePluginForType(workspaceType);
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

export async function resolveRegistrySeededExposureProfile(
  context: ExposureProfileContext,
): Promise<ExposureProfile | null> {
  if (context.workspaceType === null || context.workspaceType.trim().length === 0) {
    return null;
  }

  const defaultFieldIds = await exposureSelectableFieldIds(context.workspaceType);
  const defaultTemplateId = await resolveWorkspaceMessageTemplateSeed(
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

export async function resolveExposureProfileDefaultFieldIds(
  workspaceType: string | null,
  context: Partial<ExposureProfileContext> = {},
): Promise<readonly string[]> {
  const profile = await resolveRegistrySeededExposureProfile({
    workspaceType,
    entityType: context.entityType ?? "tour",
    surface: context.surface ?? "telegram",
    audience: context.audience ?? "external_channel",
    trigger: context.trigger ?? "TourCreated",
  });
  return profile?.defaultFieldIds ?? [];
}

export async function resolveExposureRequestedFieldIds(
  adminSelectedFieldIds: readonly string[] | null | undefined,
  workspaceType: string | null,
  context: Partial<ExposureProfileContext> = {},
): Promise<readonly string[]> {
  if (adminSelectedFieldIds != null) {
    return adminSelectedFieldIds;
  }
  return await resolveExposureProfileDefaultFieldIds(workspaceType, context);
}
