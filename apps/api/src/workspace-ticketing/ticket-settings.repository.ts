import { getWorkspaceTicketingCapabilities } from "@app-tour/workspace-sdk/ticketing";

import { withTenantRls } from "../db/with-tenant-rls";
import { isTicketingModuleEnabled } from "./ticketing-module-enabled";
import { resolveTicketingTenantWorkspaceRow } from "./resolve-ticketing-workspace-type-for-tenant";
import { appendTicketingSettingsAudit } from "./ticketing-k1.helpers";

export type TicketWorkspaceSettingsHttp = {
  readonly enabled: boolean;
  readonly categories: readonly {
    readonly code: string;
    readonly labelKey: string;
    readonly description?: string;
    readonly sortOrder: number;
    readonly defaultPriority?: string;
    readonly enabled: boolean;
  }[];
  readonly allowedPriorities: readonly string[];
  readonly maxAttachmentSizeBytes: number;
  readonly notificationPreferences: Readonly<Record<string, unknown>>;
  readonly slaDefaults: Readonly<Record<string, unknown>>;
  readonly rowVersion: number;
  readonly sources: {
    readonly manifest: true;
    readonly database: boolean;
  };
};

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function getTicketWorkspaceSettings(
  tenantId: string,
): Promise<TicketWorkspaceSettingsHttp | null> {
  const workspace = await resolveTicketingTenantWorkspaceRow(tenantId);
  if (workspace === null) return null;
  const manifest = getWorkspaceTicketingCapabilities(workspace.workspaceType);
  if (manifest === null) return null;

  const dbRow = await withTenantRls(tenantId, async (tx) =>
    tx.ticketWorkspaceSettings.findUnique({ where: { tenantId } }),
  );

  const disabledCodes = new Set(asStringArray(dbRow?.disabledCategoryCodes));
  const enabled =
    dbRow?.moduleEnabledOverride ?? isTicketingModuleEnabled(workspace.theme, workspace.workspaceType);

  return {
    enabled,
    categories: manifest.categories.map((category) => ({
      code: category.code,
      labelKey: category.labelKey,
      ...(category.description !== undefined ? { description: category.description } : {}),
      sortOrder: category.sortOrder,
      ...(category.defaultPriority !== undefined ? { defaultPriority: category.defaultPriority } : {}),
      enabled: !disabledCodes.has(category.code),
    })),
    allowedPriorities: asStringArray(dbRow?.allowedPriorities).length
      ? asStringArray(dbRow?.allowedPriorities)
      : [...manifest.allowedPriorities],
    maxAttachmentSizeBytes:
      dbRow?.maxAttachmentSizeBytes ?? manifest.maxAttachmentSizeBytes,
    notificationPreferences: asRecord(dbRow?.notificationPreferences),
    slaDefaults: asRecord(dbRow?.slaDefaults),
    rowVersion: dbRow?.rowVersion ?? 1,
    sources: { manifest: true, database: dbRow !== null },
  };
}

export async function updateTicketWorkspaceSettings(
  tenantId: string,
  input: {
    readonly enabled?: boolean;
    readonly allowedPriorities?: readonly string[];
    readonly maxAttachmentSizeBytes?: number;
    readonly notificationPreferences?: Readonly<Record<string, unknown>>;
    readonly slaDefaults?: Readonly<Record<string, unknown>>;
    readonly disabledCategoryCodes?: readonly string[];
    readonly rowVersion: number;
    readonly updatedByUserId: string;
  },
): Promise<TicketWorkspaceSettingsHttp | null> {
  const workspace = await resolveTicketingTenantWorkspaceRow(tenantId);
  if (workspace === null) return null;
  const manifest = getWorkspaceTicketingCapabilities(workspace.workspaceType);
  if (manifest === null) return null;

  await withTenantRls(tenantId, async (tx) => {
    const existing = await tx.ticketWorkspaceSettings.findUnique({ where: { tenantId } });
    if (existing !== null && existing.rowVersion !== input.rowVersion) {
      throw new Error("ROW_VERSION_CONFLICT");
    }

    await tx.ticketWorkspaceSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...(input.enabled !== undefined ? { moduleEnabledOverride: input.enabled } : {}),
        ...(input.allowedPriorities !== undefined
          ? { allowedPriorities: [...input.allowedPriorities] }
          : {}),
        ...(input.maxAttachmentSizeBytes !== undefined
          ? { maxAttachmentSizeBytes: input.maxAttachmentSizeBytes }
          : {}),
        ...(input.notificationPreferences !== undefined
          ? { notificationPreferences: input.notificationPreferences }
          : {}),
        ...(input.slaDefaults !== undefined ? { slaDefaults: input.slaDefaults } : {}),
        ...(input.disabledCategoryCodes !== undefined
          ? { disabledCategoryCodes: [...input.disabledCategoryCodes] }
          : {}),
        rowVersion: 1,
        updatedByUserId: input.updatedByUserId,
      },
      update: {
        ...(input.enabled !== undefined ? { moduleEnabledOverride: input.enabled } : {}),
        ...(input.allowedPriorities !== undefined
          ? { allowedPriorities: [...input.allowedPriorities] }
          : {}),
        ...(input.maxAttachmentSizeBytes !== undefined
          ? { maxAttachmentSizeBytes: input.maxAttachmentSizeBytes }
          : {}),
        ...(input.notificationPreferences !== undefined
          ? { notificationPreferences: input.notificationPreferences }
          : {}),
        ...(input.slaDefaults !== undefined ? { slaDefaults: input.slaDefaults } : {}),
        ...(input.disabledCategoryCodes !== undefined
          ? { disabledCategoryCodes: [...input.disabledCategoryCodes] }
          : {}),
        rowVersion: input.rowVersion + 1,
        updatedByUserId: input.updatedByUserId,
      },
    });

    await appendTicketingSettingsAudit({
      tx,
      tenantId,
      actorUserId: input.updatedByUserId,
      summary: "Updated ticketing workspace settings",
    });
  });

  return getTicketWorkspaceSettings(tenantId);
}
