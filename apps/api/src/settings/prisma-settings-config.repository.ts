import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import type { TenantConfigPayload, TenantConfigRecord } from "./settings.types";
import type { SettingsConfigRepository } from "./in-memory-settings-config.repository";

function toRecord(row: {
  tenantId: string;
  configKey: string;
  configVersion: number;
  payload: Prisma.JsonValue;
  updatedAt: Date;
}): TenantConfigRecord {
  return {
    tenantId: row.tenantId,
    configKey: row.configKey,
    configVersion: row.configVersion,
    payload: row.payload as unknown as TenantConfigPayload,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaSettingsConfigRepository implements SettingsConfigRepository {
  async get(tenantId: string, configKey: string): Promise<TenantConfigRecord | null> {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.tenantConfig.findUnique({
        where: {
          tenantId_configKey: { tenantId, configKey },
        },
      })
    );
    return row === null ? null : toRecord(row);
  }

  async put(
    tenantId: string,
    configKey: string,
    input: { configVersion: number; payload: TenantConfigPayload }
  ): Promise<TenantConfigRecord> {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.tenantConfig.upsert({
        where: {
          tenantId_configKey: { tenantId, configKey },
        },
        create: {
          tenantId,
          configKey,
          configVersion: input.configVersion,
          payload: input.payload as Prisma.InputJsonValue,
        },
        update: {
          configVersion: input.configVersion,
          payload: input.payload as Prisma.InputJsonValue,
        },
      })
    );
    return toRecord(row);
  }

  async seed(record: TenantConfigRecord): Promise<void> {
    await withTenantRls(record.tenantId, (tx) =>
      tx.tenantConfig.upsert({
        where: {
          tenantId_configKey: { tenantId: record.tenantId, configKey: record.configKey },
        },
        create: {
          tenantId: record.tenantId,
          configKey: record.configKey,
          configVersion: record.configVersion,
          payload: record.payload as Prisma.InputJsonValue,
          updatedAt: new Date(record.updatedAt),
        },
        update: {
          configVersion: record.configVersion,
          payload: record.payload as Prisma.InputJsonValue,
          updatedAt: new Date(record.updatedAt),
        },
      })
    );
  }
}
