import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import type {
  IntegrationSecretPayload,
  IntegrationSecretStore,
} from "./integration-secret-store.types";
export { buildIntegrationSecretRef, maskSecretRef } from "./integration-secret-store.types";
export type {
  IntegrationSecretPayload,
  IntegrationSecretStore,
} from "./integration-secret-store.types";

export async function putIntegrationSecretInTransaction(
  tx: Prisma.TransactionClient,
  tenantId: string,
  secretRef: string,
  payload: IntegrationSecretPayload
): Promise<void> {
  await tx.integrationSecret.upsert({
    where: { secretRef },
    create: {
      secretRef,
      tenantId,
      payload: payload as Prisma.InputJsonValue,
    },
    update: {
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

export class PrismaIntegrationSecretStore implements IntegrationSecretStore {
  async put(tenantId: string, secretRef: string, payload: IntegrationSecretPayload): Promise<void> {
    await withTenantRls(tenantId, async (tx) => {
      await putIntegrationSecretInTransaction(tx, tenantId, secretRef, payload);
    });
  }

  async get(tenantId: string, secretRef: string): Promise<IntegrationSecretPayload | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.integrationSecret.findUnique({ where: { secretRef } });
      if (row === null || row.tenantId !== tenantId) {
        return null;
      }
      if (typeof row.payload !== "object" || row.payload === null) {
        return {};
      }
      return row.payload as IntegrationSecretPayload;
    });
  }

  async delete(tenantId: string, secretRef: string): Promise<void> {
    await withTenantRls(tenantId, async (tx) => {
      await tx.integrationSecret.deleteMany({
        where: { secretRef, tenantId },
      });
    });
  }
}

const memoryStore = new Map<string, IntegrationSecretPayload>();

export class InMemoryIntegrationSecretStore implements IntegrationSecretStore {
  async put(tenantId: string, secretRef: string, payload: IntegrationSecretPayload): Promise<void> {
    memoryStore.set(`${tenantId}:${secretRef}`, { ...payload });
  }

  async get(tenantId: string, secretRef: string): Promise<IntegrationSecretPayload | null> {
    const value = memoryStore.get(`${tenantId}:${secretRef}`);
    return value === undefined ? null : { ...value };
  }

  async delete(tenantId: string, secretRef: string): Promise<void> {
    memoryStore.delete(`${tenantId}:${secretRef}`);
  }
}

export function resetInMemoryIntegrationSecretStoreForTests(): void {
  memoryStore.clear();
}

let defaultStore: IntegrationSecretStore | undefined;

export function getIntegrationSecretStore(): IntegrationSecretStore {
  if (defaultStore === undefined) {
    defaultStore = new PrismaIntegrationSecretStore();
  }
  return defaultStore;
}

export function installIntegrationSecretStoreForTests(store: IntegrationSecretStore): void {
  defaultStore = store;
}

export function resetIntegrationSecretStoreForTests(): void {
  defaultStore = undefined;
  memoryStore.clear();
}
