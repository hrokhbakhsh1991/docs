import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundException } from "@nestjs/common";
import { CURRENT_DRAFT_SCHEMA_VERSION } from "@repo/shared-contracts";

import { DraftConflictException } from "./draft-conflict.exception";
import { PostgresDraftSnapshotStore } from "./storage/postgres-draft-snapshot.store";
import type { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";

function mockRow(overrides: Partial<DraftSnapshotEntity> = {}): DraftSnapshotEntity {
  return {
    id: "row-1",
    workspaceId: "ws-1",
    userId: "user-1",
    draftKey: "denali-create",
    data: { value: "stored" },
    version: 2,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: "1000",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DraftSnapshotEntity;
}

function createStore(input: {
  existing: DraftSnapshotEntity | null;
  updateAffected?: number;
  deleteResult?: { affected?: number };
  upgradeAffected?: number;
  traceId?: string;
  onCreate?: (partial: Partial<DraftSnapshotEntity>) => void;
  onUpdate?: (partial: Record<string, unknown>) => void;
}): PostgresDraftSnapshotStore {
  const findOne = async () => input.existing;
  const save = async (entity: DraftSnapshotEntity) => entity;
  const create = (_entity: unknown, partial: Partial<DraftSnapshotEntity>) => {
    input.onCreate?.(partial);
    return { ...partial, version: partial.version ?? 1 } as DraftSnapshotEntity;
  };
  const update = async (...args: unknown[]) => {
    const partial = (args[2] ?? args[1]) as Record<string, unknown> | undefined;
    if (partial) {
      input.onUpdate?.(partial);
    }
    return { affected: input.updateAffected ?? input.upgradeAffected ?? 1 };
  };
  const manager = { findOne, create, save, update };

  const draftsRepository = {
    findOne,
    create,
    save,
    update,
    manager: {
      transaction: async <T>(fn: (em: typeof manager) => Promise<T>) => fn(manager),
    },
    delete: async () => input.deleteResult ?? { affected: 1 },
    createQueryBuilder: () => ({
      where: () => ({
        andWhere: () => ({
          getSql: () => "SELECT",
          getParameters: () => ({}),
        }),
      }),
    }),
  };

  const requestContext = {
    tryGetCorrelationId: () => input.traceId,
    tryGetRequestId: () => input.traceId,
  };
  return new PostgresDraftSnapshotStore(draftsRepository as never, requestContext as never);
}

const scope = { workspaceId: "ws-1", userId: "user-1", draftKey: "denali-create" };

test("upsert creates version 1 when no row exists", async () => {
  const store = createStore({ existing: null });
  const result = await store.upsert(scope, {
    data: { value: "new" },
    version: 0,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 2000,
  });

  assert.equal(result.version, 1);
  assert.deepEqual(result.data, { value: "new" });
});

test("upsert rejects first insert when client version is not zero", async () => {
  const store = createStore({ existing: null });

  await assert.rejects(
    () =>
      store.upsert(scope, {
        data: { value: "new" },
        version: 1,
        schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
        lastModified: 2000,
      }),
    (err: unknown) => err instanceof DraftConflictException,
  );
});

test("upsert increments version when incoming version matches", async () => {
  const existing = mockRow({ version: 2 });
  const store = createStore({ existing, updateAffected: 1 });

  const result = await store.upsert(scope, {
    data: { value: "updated" },
    version: 2,
    schemaVersion: 2,
    lastModified: 3000,
  });

  assert.equal(result.version, 3);
  assert.equal(result.schemaVersion, 2);
});

test("upsert attaches trace id into persisted row", async () => {
  let createdPayload: Partial<DraftSnapshotEntity> | undefined;
  const store = createStore({
    existing: null,
    traceId: "trace-123",
    onCreate: (partial) => {
      createdPayload = partial;
    },
  });

  await store.upsert(scope, {
    data: { value: "new" },
    version: 0,
    schemaVersion: 2,
    lastModified: 3000,
  });

  assert.equal(createdPayload?.traceId, "trace-123");
});

test("upsert update writes trace id", async () => {
  let updatedPayload: Record<string, unknown> | undefined;
  const store = createStore({
    existing: mockRow({ version: 2 }),
    traceId: "trace-456",
    onUpdate: (partial) => {
      updatedPayload = partial;
    },
  });

  await store.upsert(scope, {
    data: { value: "updated" },
    version: 2,
    schemaVersion: 2,
    lastModified: 3000,
  });

  assert.equal(updatedPayload?.traceId, "trace-456");
});

test("upsert throws DraftConflictException when version is stale", async () => {
  const existing = mockRow({ version: 3 });
  const store = createStore({ existing });

  await assert.rejects(
    () =>
      store.upsert(scope, {
        data: { value: "client" },
        version: 2,
        schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
        lastModified: 4000,
      }),
    (err: unknown) => err instanceof DraftConflictException,
  );
});

test("delete throws when delete affects zero rows", async () => {
  const store = createStore({ existing: null, deleteResult: { affected: 0 } });

  await assert.rejects(
    () => store.delete(scope),
    (err: unknown) => err instanceof NotFoundException,
  );
});

test("concurrent upserts with same version: exactly one succeeds", async () => {
  let row = mockRow({ version: 2, data: { value: "stored" } });

  const manager = {
    findOne: async () => ({ ...row }),
    create: (_entity: unknown, partial: Partial<DraftSnapshotEntity>) =>
      ({ ...partial, version: partial.version ?? 1 } as DraftSnapshotEntity),
    save: async (entity: DraftSnapshotEntity) => {
      row = entity;
      return entity;
    },
    update: async (...args: unknown[]) => {
      const criteria = (args[1] ?? args[0]) as { id?: string; version?: number };
      const partial = (args[2] ?? args[1]) as Record<string, unknown>;
      const storedVersion = criteria.version;
      if (storedVersion == null || row.version !== storedVersion) {
        return { affected: 0 };
      }
      row = {
        ...row,
        data: (partial.data as Record<string, unknown>) ?? row.data,
        version: Number(partial.version),
        schemaVersion: Number(partial.schemaVersion ?? row.schemaVersion),
        lastModified: String(partial.lastModified ?? row.lastModified),
        traceId: (partial.traceId as string | null | undefined) ?? row.traceId ?? null,
      };
      return { affected: 1 };
    },
  };

  const draftsRepository = {
    findOne: manager.findOne,
    create: manager.create,
    save: manager.save,
    update: manager.update,
    manager: {
      transaction: async <T>(fn: (em: typeof manager) => Promise<T>) => fn(manager),
    },
    delete: async () => ({ affected: 1 }),
    createQueryBuilder: () => ({
      where: () => ({
        andWhere: () => ({
          getSql: () => "SELECT",
          getParameters: () => ({}),
        }),
      }),
    }),
  };

  const store = new PostgresDraftSnapshotStore(draftsRepository as never, undefined);
  const payloadBase = {
    version: 2,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: Date.now(),
  };

  const results = await Promise.allSettled([
    store.upsert(scope, { data: { value: "race-a" }, ...payloadBase }),
    store.upsert(scope, { data: { value: "race-b" }, ...payloadBase }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const failure = rejected[0];
  assert.equal(failure?.status, "rejected");
  assert.ok(
    failure.status === "rejected" && failure.reason instanceof DraftConflictException,
  );
  assert.equal(row.version, 3);
});
