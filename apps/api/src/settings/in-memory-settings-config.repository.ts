import type { TenantConfigPayload, TenantConfigRecord } from "./settings.types";

type ConfigStoreKey = `${string}:${string}`;

let configStore = new Map<ConfigStoreKey, TenantConfigRecord>();

function configKeyFor(tenantId: string, configKey: string): ConfigStoreKey {
  return `${tenantId}:${configKey}`;
}

export function resetSettingsConfigRepositoryForTests(): void {
  configStore = new Map();
}

export interface SettingsConfigRepository {
  get(tenantId: string, configKey: string): Promise<TenantConfigRecord | null>;
  put(
    tenantId: string,
    configKey: string,
    input: { configVersion: number; payload: TenantConfigPayload }
  ): Promise<TenantConfigRecord>;
  seed(record: TenantConfigRecord): Promise<void>;
}

export class InMemorySettingsConfigRepository implements SettingsConfigRepository {
  async get(tenantId: string, configKey: string): Promise<TenantConfigRecord | null> {
    const row = configStore.get(configKeyFor(tenantId, configKey));
    return row === undefined ? null : cloneRecord(row);
  }

  async put(
    tenantId: string,
    configKey: string,
    input: { configVersion: number; payload: TenantConfigPayload }
  ): Promise<TenantConfigRecord> {
    const record: TenantConfigRecord = {
      tenantId,
      configKey,
      configVersion: input.configVersion,
      payload: clonePayload(input.payload),
      updatedAt: new Date().toISOString(),
    };
    configStore.set(configKeyFor(tenantId, configKey), record);
    return cloneRecord(record);
  }

  async seed(record: TenantConfigRecord): Promise<void> {
    configStore.set(configKeyFor(record.tenantId, record.configKey), cloneRecord(record));
  }
}

function clonePayload(payload: TenantConfigPayload): TenantConfigPayload {
  return structuredClone(payload);
}

function cloneRecord(record: TenantConfigRecord): TenantConfigRecord {
  return {
    ...record,
    payload: clonePayload(record.payload),
  };
}
