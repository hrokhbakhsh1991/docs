import type { IntegrationConnectionStatus } from "../platform/integration-connection.types";
import { buildIntegrationSecretRef } from "../infrastructure/integration-secret-store.types";
import {
  buildMigratedLegacySecretRef,
  isMigratedLegacySecretRef,
} from "./migrated-legacy-secret-ref";

export type LegacyTelegramBotSnapshot = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly channelId: string;
  readonly enabled: boolean;
  readonly botToken: string;
  readonly createdByUserId: string | null;
};

export type IntegrationConnectionSnapshot = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly provider: string;
  readonly status: string;
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
  readonly secretRef: string | null;
  readonly hasSecretPayload: boolean;
};

export type TelegramBackfillPlanAction = "insert" | "skip_existing" | "skip_invalid";

export type TelegramBackfillPlanItem = {
  readonly action: TelegramBackfillPlanAction;
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly legacyBotId: string;
  readonly reason?: string;
  readonly proposed?: {
    readonly connectionId: string;
    readonly provider: "telegram";
    readonly status: IntegrationConnectionStatus;
    readonly enabled: boolean;
    readonly capabilities: readonly ["message.send"];
    readonly config: Record<string, unknown>;
    readonly secretRef: string | null;
    readonly secretStrategy: "integration_secret_store" | "migrated_legacy_marker" | "none";
  };
};

export type TelegramBackfillMismatchKind =
  | "legacy_without_connection"
  | "channel_id_mismatch"
  | "enabled_mismatch"
  | "secret_missing_for_token"
  | "secret_ref_not_expected"
  | "duplicate_telegram_connection";

export type TelegramBackfillMismatch = {
  readonly kind: TelegramBackfillMismatchKind;
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly legacyBotId?: string;
  readonly connectionId?: string;
  readonly details: string;
};

export function mapLegacyEnabledToStatus(enabled: boolean): IntegrationConnectionStatus {
  return enabled ? "enabled" : "disabled";
}

export function resolveBackfillSecretRef(input: {
  readonly connectionId: string;
  readonly legacyBotId: string;
  readonly botToken: string;
}): {
  readonly secretRef: string | null;
  readonly secretStrategy: "integration_secret_store" | "migrated_legacy_marker";
} {
  const token = input.botToken.trim();
  if (token.length > 0) {
    return {
      secretRef: buildIntegrationSecretRef(input.connectionId),
      secretStrategy: "integration_secret_store",
    };
  }
  return {
    secretRef: buildMigratedLegacySecretRef(input.legacyBotId),
    secretStrategy: "migrated_legacy_marker",
  };
}

export function buildTelegramBackfillPlanItem(input: {
  readonly legacy: LegacyTelegramBotSnapshot;
  readonly existingConnection: { readonly id: string } | null;
  readonly connectionId: string;
  readonly migratedAtIso: string;
}): TelegramBackfillPlanItem {
  const base = {
    tenantId: input.legacy.tenantId,
    workspaceType: input.legacy.workspaceType,
    legacyBotId: input.legacy.id,
  };

  if (input.legacy.workspaceType.trim().length === 0) {
    return {
      ...base,
      action: "skip_invalid",
      reason: "LEGACY_WORKSPACE_TYPE_EMPTY",
    };
  }

  if (input.existingConnection !== null) {
    return {
      ...base,
      action: "skip_existing",
      reason: "INTEGRATION_CONNECTION_EXISTS",
    };
  }

  const enabled = input.legacy.enabled;
  const { secretRef, secretStrategy } = resolveBackfillSecretRef({
    connectionId: input.connectionId,
    legacyBotId: input.legacy.id,
    botToken: input.legacy.botToken,
  });

  return {
    ...base,
    action: "insert",
    proposed: {
      connectionId: input.connectionId,
      provider: "telegram",
      status: mapLegacyEnabledToStatus(enabled),
      enabled,
      capabilities: ["message.send"],
      config: {
        channelId: input.legacy.channelId,
        migratedFromLegacyBotId: input.legacy.id,
        migratedAt: input.migratedAtIso,
      },
      secretRef,
      secretStrategy,
    },
  };
}

function channelIdFromConfig(config: Record<string, unknown>): string | null {
  return typeof config.channelId === "string" ? config.channelId : null;
}

function migratedFromLegacyBotId(config: Record<string, unknown>): string | null {
  return typeof config.migratedFromLegacyBotId === "string" ? config.migratedFromLegacyBotId : null;
}

export function detectTelegramBackfillMismatches(input: {
  readonly legacy: LegacyTelegramBotSnapshot | null;
  readonly connections: readonly IntegrationConnectionSnapshot[];
}): readonly TelegramBackfillMismatch[] {
  const mismatches: TelegramBackfillMismatch[] = [];
  const telegramConnections = input.connections.filter(
    (connection) => connection.provider === "telegram"
  );

  if (telegramConnections.length > 1) {
    mismatches.push({
      kind: "duplicate_telegram_connection",
      tenantId: telegramConnections[0]!.tenantId,
      workspaceType: telegramConnections[0]!.workspaceType ?? "",
      details: `Found ${telegramConnections.length} telegram integration_connections rows for workspace.`,
    });
  }

  if (input.legacy === null) {
    return mismatches;
  }

  const connection = telegramConnections[0] ?? null;
  if (connection === null) {
    mismatches.push({
      kind: "legacy_without_connection",
      tenantId: input.legacy.tenantId,
      workspaceType: input.legacy.workspaceType,
      legacyBotId: input.legacy.id,
      details:
        "Legacy workspace_telegram_bots row exists without integration_connections telegram row.",
    });
    return mismatches;
  }

  const legacyChannelId = input.legacy.channelId.trim();
  const connectionChannelId = channelIdFromConfig(connection.config)?.trim() ?? "";
  if (legacyChannelId !== connectionChannelId) {
    mismatches.push({
      kind: "channel_id_mismatch",
      tenantId: input.legacy.tenantId,
      workspaceType: input.legacy.workspaceType,
      legacyBotId: input.legacy.id,
      connectionId: connection.id,
      details: `channelId legacy=${legacyChannelId} connection=${connectionChannelId}`,
    });
  }

  if (input.legacy.enabled !== connection.enabled) {
    mismatches.push({
      kind: "enabled_mismatch",
      tenantId: input.legacy.tenantId,
      workspaceType: input.legacy.workspaceType,
      legacyBotId: input.legacy.id,
      connectionId: connection.id,
      details: `enabled legacy=${input.legacy.enabled} connection=${connection.enabled}`,
    });
  }

  const tokenPresent = input.legacy.botToken.trim().length > 0;
  if (tokenPresent && !connection.hasSecretPayload) {
    mismatches.push({
      kind: "secret_missing_for_token",
      tenantId: input.legacy.tenantId,
      workspaceType: input.legacy.workspaceType,
      legacyBotId: input.legacy.id,
      connectionId: connection.id,
      details: "Legacy bot has bot_token but integration_secrets payload is missing.",
    });
  }

  if (tokenPresent) {
    const expectedRefPrefix = "integration-connection:";
    if (connection.secretRef === null || !connection.secretRef.startsWith(expectedRefPrefix)) {
      mismatches.push({
        kind: "secret_ref_not_expected",
        tenantId: input.legacy.tenantId,
        workspaceType: input.legacy.workspaceType,
        legacyBotId: input.legacy.id,
        connectionId: connection.id,
        details: `Expected secret_ref prefix ${expectedRefPrefix} when legacy bot_token exists.`,
      });
    }
  } else if (connection.secretRef !== null && !isMigratedLegacySecretRef(connection.secretRef)) {
    mismatches.push({
      kind: "secret_ref_not_expected",
      tenantId: input.legacy.tenantId,
      workspaceType: input.legacy.workspaceType,
      legacyBotId: input.legacy.id,
      connectionId: connection.id,
      details: "Expected migrated-legacy secret_ref marker when legacy bot_token is empty.",
    });
  }

  const migratedLegacyId = migratedFromLegacyBotId(connection.config);
  if (migratedLegacyId !== null && migratedLegacyId !== input.legacy.id) {
    mismatches.push({
      kind: "channel_id_mismatch",
      tenantId: input.legacy.tenantId,
      workspaceType: input.legacy.workspaceType,
      legacyBotId: input.legacy.id,
      connectionId: connection.id,
      details: `config.migratedFromLegacyBotId=${migratedLegacyId} does not match legacy id.`,
    });
  }

  return mismatches;
}
