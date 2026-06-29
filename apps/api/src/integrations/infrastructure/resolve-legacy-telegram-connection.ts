import { withTenantRls } from "../../db/with-tenant-rls";
import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import type { IntegrationPolicyTarget } from "./integration-policy.repository";
import { isLegacyTelegramFallbackEnabled } from "../migration/legacy-telegram-fallback-env";

export const LEGACY_TELEGRAM_ID_PREFIX = "legacy-telegram:";

export type LegacyTelegramBotInspection = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly botToken: string;
  readonly channelId: string;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function buildLegacyTelegramSyntheticId(botId: string): string {
  return `${LEGACY_TELEGRAM_ID_PREFIX}${botId}`;
}

export function parseLegacyTelegramBotId(connectionId: string): string | null {
  if (!connectionId.startsWith(LEGACY_TELEGRAM_ID_PREFIX)) {
    return null;
  }
  const botId = connectionId.slice(LEGACY_TELEGRAM_ID_PREFIX.length).trim();
  return botId.length > 0 ? botId : null;
}

export function isLegacyTelegramConnectionId(connectionId: string): boolean {
  return parseLegacyTelegramBotId(connectionId) !== null;
}

async function findLegacyTelegramBotRow(
  tenantId: string,
  workspaceType: string | null
): Promise<LegacyTelegramBotInspection | null> {
  if (workspaceType === null) {
    return null;
  }

  return withTenantRls(tenantId, async (tx) => {
    const legacy = await tx.workspaceTelegramBot.findUnique({
      where: {
        tenantId_workspaceType: {
          tenantId,
          workspaceType,
        },
      },
    });
    if (legacy === null) {
      return null;
    }
    return {
      id: legacy.id,
      tenantId: legacy.tenantId,
      workspaceType: legacy.workspaceType,
      botToken: legacy.botToken,
      channelId: legacy.channelId,
      enabled: legacy.enabled,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    };
  });
}

/** Inspection path — includes disabled bots for operator verification UI. */
export async function findLegacyTelegramBotForInspection(
  tenantId: string,
  workspaceType: string | null
): Promise<LegacyTelegramBotInspection | null> {
  return findLegacyTelegramBotRow(tenantId, workspaceType);
}

export async function findLegacyTelegramBotBySyntheticId(
  tenantId: string,
  connectionId: string
): Promise<LegacyTelegramBotInspection | null> {
  const botId = parseLegacyTelegramBotId(connectionId);
  if (botId === null) {
    return null;
  }

  return withTenantRls(tenantId, async (tx) => {
    const legacy = await tx.workspaceTelegramBot.findFirst({
      where: { id: botId, tenantId },
    });
    if (legacy === null) {
      return null;
    }
    return {
      id: legacy.id,
      tenantId: legacy.tenantId,
      workspaceType: legacy.workspaceType,
      botToken: legacy.botToken,
      channelId: legacy.channelId,
      enabled: legacy.enabled,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    };
  });
}

/**
 * Dual-read fallback: WorkspaceTelegramBot → synthetic IntegrationPolicyTarget.
 * Used only when no integration_connections row exists for the tenant/workspace.
 */
export async function resolveLegacyTelegramConnection(
  tenantId: string,
  workspaceType: string | null
): Promise<IntegrationPolicyTarget | null> {
  if (!isLegacyTelegramFallbackEnabled()) {
    return null;
  }

  const legacy = await findLegacyTelegramBotRow(tenantId, workspaceType);
  if (legacy === null || !legacy.enabled) {
    return null;
  }

  return {
    connectionId: buildLegacyTelegramSyntheticId(legacy.id),
    tenantId: legacy.tenantId,
    provider: "telegram",
    workspaceType: legacy.workspaceType,
    capabilities: ["message.send"],
    config: { channelId: legacy.channelId },
    credentials: { botToken: legacy.botToken },
    secretRef: null,
    syntheticLegacyConnection: true,
  };
}

export async function resolveLegacyTelegramConnectionRecord(
  tenantId: string,
  workspaceType: string | null
): Promise<IntegrationConnectionRecord | null> {
  const legacy = await resolveLegacyTelegramConnection(tenantId, workspaceType);
  if (legacy === null) {
    return null;
  }
  return {
    id: legacy.connectionId,
    tenantId: legacy.tenantId,
    workspaceType: legacy.workspaceType,
    provider: legacy.provider,
    status: "enabled",
    enabled: true,
    capabilities: legacy.capabilities,
    config: legacy.config,
    secretRef: legacy.secretRef,
    credentials: legacy.credentials,
  };
}
