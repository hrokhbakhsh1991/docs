import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import type { IntegrationCapability } from "../platform/integration-capability";
import { isIntegrationCapability } from "../platform/integration-capability";
import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import type { IntegrationConnectionRepository } from "./integration-connection.repository";
import type { TelegramTopicProvisionClaim } from "./integration-connection.repository";
import {
  INTEGRATION_CONNECTION_LIST_SELECT,
  MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE,
} from "./integration-list-projection";
import { resolveLegacyTelegramConnectionRecord } from "./resolve-legacy-telegram-connection";

const TELEGRAM_TOPIC_PROVISION_LEASE_MS = 120_000;

type TelegramTopicProvisionState = {
  readonly token?: unknown;
  readonly startedAt?: unknown;
  readonly outcome?: unknown;
};

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function parseCapabilities(raw: unknown): IntegrationCapability[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is IntegrationCapability =>
      typeof entry === "string" && isIntegrationCapability(entry)
  );
}

function mapRow(row: {
  id: string;
  tenantId: string;
  workspaceType: string | null;
  provider: string;
  status: string;
  enabled: boolean;
  capabilities: Prisma.JsonValue;
  config: Prisma.JsonValue;
  credentials: Prisma.JsonValue;
  secretRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IntegrationConnectionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceType: row.workspaceType,
    provider: row.provider as IntegrationProviderId,
    status: row.status as IntegrationConnectionRecord["status"],
    enabled: row.enabled,
    capabilities: parseCapabilities(row.capabilities),
    config:
      typeof row.config === "object" && row.config !== null
        ? (row.config as Record<string, unknown>)
        : {},
    credentials:
      typeof row.credentials === "object" && row.credentials !== null
        ? (row.credentials as Record<string, unknown>)
        : {},
    secretRef: row.secretRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapListRow(
  row: Prisma.IntegrationConnectionGetPayload<{ select: typeof INTEGRATION_CONNECTION_LIST_SELECT }>
): IntegrationConnectionRecord {
  return mapRow({ ...row, credentials: {} });
}

export class PrismaIntegrationConnectionRepository implements IntegrationConnectionRepository {
  async findEnabledForTenant(input: {
    readonly tenantId: string;
    readonly provider: IntegrationProviderId;
    readonly workspaceType: string | null;
  }): Promise<IntegrationConnectionRecord | null> {
    const row = await withTenantRls(input.tenantId, async (tx) => {
      const scoped = await tx.integrationConnection.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.provider,
          workspaceType: input.workspaceType,
          enabled: true,
          status: "enabled",
        },
      });
      if (scoped !== null) {
        return scoped;
      }
      if (input.workspaceType === null) {
        return null;
      }
      return tx.integrationConnection.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.provider,
          workspaceType: null,
          enabled: true,
          status: "enabled",
        },
      });
    });

    if (row !== null) {
      return mapRow(row);
    }

    if (input.provider !== "telegram") {
      return null;
    }
    const legacy = await resolveLegacyTelegramConnectionRecord(input.tenantId, input.workspaceType);
    return legacy;
  }

  async findByTenantAndId(
    tenantId: string,
    connectionId: string
  ): Promise<IntegrationConnectionRecord | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.integrationConnection.findFirst({
        where: { id: connectionId, tenantId },
      });
      return row === null ? null : mapRow(row);
    });
  }

  async listForWorkspace(input: {
    readonly tenantId: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationConnectionRecord[]> {
    const rows = await withTenantRls(input.tenantId, async (tx) => {
      return tx.integrationConnection.findMany({
        where: {
          tenantId: input.tenantId,
          OR: [
            { workspaceType: input.workspaceType },
            ...(input.workspaceType !== null ? [{ workspaceType: null }] : []),
          ],
        },
        select: INTEGRATION_CONNECTION_LIST_SELECT,
        orderBy: { createdAt: "asc" },
        take: MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE,
      });
    });
    return rows.map(mapListRow);
  }

  async upsertTelegramTopicThreadId(input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly topicName: string;
    readonly threadId: number;
  }): Promise<void> {
    await withTenantRls(input.tenantId, async (tx) => {
      const current = await tx.integrationConnection.findFirst({
        where: { id: input.connectionId, tenantId: input.tenantId },
        select: { config: true },
      });
      if (current === null) {
        return;
      }
      const config =
        typeof current.config === "object" && current.config !== null
          ? (current.config as Record<string, unknown>)
          : {};
      const topicThreadIds =
        typeof config.topicThreadIds === "object" && config.topicThreadIds !== null
          ? (config.topicThreadIds as Record<string, unknown>)
          : {};
      const topicNames =
        typeof config.topicNames === "object" && config.topicNames !== null
          ? (config.topicNames as Record<string, unknown>)
          : {};
      // A topic's stored name is authoritative once set — never overwrite it,
      // only fill it in the first time this key is provisioned.
      const preservedName =
        typeof topicNames[input.topicKey] === "string"
          ? (topicNames[input.topicKey] as string)
          : input.topicName;
      await tx.integrationConnection.update({
        where: { id: input.connectionId },
        data: {
          config: {
            ...config,
            topicThreadIds: { ...topicThreadIds, [input.topicKey]: input.threadId },
            topicNames: { ...topicNames, [input.topicKey]: preservedName },
          } as Prisma.InputJsonValue,
        },
      });
    });
  }

  async claimTelegramTopicProvision(input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly leaseToken: string;
    readonly staleThreadId: number;
    readonly chatId?: string;
  }): Promise<TelegramTopicProvisionClaim> {
    return withTenantRls(input.tenantId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram-topic:${input.tenantId}:${input.connectionId}:${input.topicKey}`}))`;
      const current = await tx.integrationConnection.findFirst({
        where: { id: input.connectionId, tenantId: input.tenantId },
        select: { config: true },
      });
      if (current === null) return { status: "busy" } as const;

      const config = readRecord(current.config);
      if (input.chatId !== undefined && readRecord(config).chatId !== input.chatId) {
        return { status: "ambiguous" } as const;
      }
      const topicThreadIds = readRecord(config.topicThreadIds);
      const authoritativeThreadId = topicThreadIds[input.topicKey];
      if (
        typeof authoritativeThreadId === "number" &&
        Number.isSafeInteger(authoritativeThreadId) &&
        authoritativeThreadId > 0 &&
        authoritativeThreadId !== input.staleThreadId
      ) {
        return { status: "existing", threadId: authoritativeThreadId } as const;
      }

      const provisions = readRecord(config.telegramTopicProvisions);
      const state = readRecord(provisions[input.topicKey]) as TelegramTopicProvisionState;
      if (state.outcome === "ambiguous") return { status: "ambiguous" } as const;
      const startedAt =
        typeof state.startedAt === "string" ? Date.parse(state.startedAt) : Number.NaN;
      if (
        typeof state.token === "string" &&
        Number.isFinite(startedAt) &&
        Date.now() - startedAt < TELEGRAM_TOPIC_PROVISION_LEASE_MS
      ) {
        return { status: "busy" } as const;
      }
      // An expired in-flight attempt may have reached Telegram before this
      // process died. Treat it as ambiguous instead of risking a duplicate.
      if (typeof state.token === "string") {
        await tx.integrationConnection.update({
          where: { id: input.connectionId },
          data: {
            config: {
              ...config,
              telegramTopicProvisions: {
                ...provisions,
                [input.topicKey]: { ...state, outcome: "ambiguous" },
              },
            } as Prisma.InputJsonValue,
          },
        });
        return { status: "ambiguous" } as const;
      }

      await tx.integrationConnection.update({
        where: { id: input.connectionId },
        data: {
          config: {
            ...config,
            telegramTopicProvisions: {
              ...provisions,
              [input.topicKey]: {
                token: input.leaseToken,
                startedAt: new Date().toISOString(),
                outcome: "in_flight",
              },
            },
          } as Prisma.InputJsonValue,
        },
      });
      return { status: "claimed", leaseToken: input.leaseToken } as const;
    });
  }

  async completeTelegramTopicProvision(input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly topicName: string;
    readonly threadId: number;
    readonly leaseToken: string;
    readonly chatId?: string;
  }): Promise<"committed" | "stale"> {
    return withTenantRls(input.tenantId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram-topic:${input.tenantId}:${input.connectionId}:${input.topicKey}`}))`;
      const current = await tx.integrationConnection.findFirst({
        where: { id: input.connectionId, tenantId: input.tenantId },
        select: { config: true },
      });
      if (current === null) return "stale" as const;
      const config = readRecord(current.config);
      if (input.chatId !== undefined && config.chatId !== input.chatId) return "stale" as const;
      const provisions = readRecord(config.telegramTopicProvisions);
      const state = readRecord(provisions[input.topicKey]);
      if (state.token !== input.leaseToken) return "stale" as const;
      const { [input.topicKey]: _finished, ...remainingProvisions } = provisions;
      const topicThreadIds = readRecord(config.topicThreadIds);
      const topicNames = readRecord(config.topicNames);
      await tx.integrationConnection.update({
        where: { id: input.connectionId },
        data: {
          config: {
            ...config,
            topicThreadIds: { ...topicThreadIds, [input.topicKey]: input.threadId },
            topicNames: {
              ...topicNames,
              [input.topicKey]:
                typeof topicNames[input.topicKey] === "string"
                  ? topicNames[input.topicKey]
                  : input.topicName,
            },
            telegramTopicProvisions: remainingProvisions,
          } as Prisma.InputJsonValue,
        },
      });
      return "committed" as const;
    });
  }

  async finishTelegramTopicProvisionFailure(input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly leaseToken: string;
    readonly outcomeUnknown: boolean;
    readonly chatId?: string;
  }): Promise<void> {
    await withTenantRls(input.tenantId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram-topic:${input.tenantId}:${input.connectionId}:${input.topicKey}`}))`;
      const current = await tx.integrationConnection.findFirst({
        where: { id: input.connectionId, tenantId: input.tenantId },
        select: { config: true },
      });
      if (current === null) return;
      const config = readRecord(current.config);
      if (input.chatId !== undefined && config.chatId !== input.chatId) return;
      const provisions = readRecord(config.telegramTopicProvisions);
      const state = readRecord(provisions[input.topicKey]);
      if (state.token !== input.leaseToken) return;
      const nextProvisions = { ...provisions };
      if (input.outcomeUnknown) {
        nextProvisions[input.topicKey] = { ...state, outcome: "ambiguous" };
      } else {
        delete nextProvisions[input.topicKey];
      }
      await tx.integrationConnection.update({
        where: { id: input.connectionId },
        data: {
          config: { ...config, telegramTopicProvisions: nextProvisions } as Prisma.InputJsonValue,
        },
      });
    });
  }
}

export function createIntegrationConnectionRepository(): IntegrationConnectionRepository {
  return new PrismaIntegrationConnectionRepository();
}
