import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundException } from "@nestjs/common";

import { DraftConflictException } from "./draft-conflict.exception";
import { DraftEngineService } from "./draft-engine.service";
import type { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";
import type { RequestContextService } from "../../common/request-context/request-context.service";

function mockRow(overrides: Partial<DraftSnapshotEntity> = {}): DraftSnapshotEntity {
  return {
    id: "row-1",
    workspaceId: "ws-1",
    userId: "user-1",
    draftKey: "denali-create",
    data: { value: "stored" },
    version: 2,
    lastModified: "1000",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DraftSnapshotEntity;
}

function createService(input: {
  existing: DraftSnapshotEntity | null;
  saved?: DraftSnapshotEntity;
  updateAffected?: number;
  deleteResult?: { affected?: number };
}): DraftEngineService {
  const findOne = async () => input.existing;
  const save = async (entity: DraftSnapshotEntity) => input.saved ?? entity;
  const create = (_entity: unknown, partial: Partial<DraftSnapshotEntity>) =>
    ({ ...partial, version: partial.version ?? 1 } as DraftSnapshotEntity);
  const update = async () => ({ affected: input.updateAffected ?? 1 });
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
    resolveEffectiveTenantId: () => "ws-1",
    getUserId: () => "user-1",
  } as unknown as RequestContextService;

  return new DraftEngineService(
    draftsRepository as never,
    requestContext,
  );
}

test("upsertForMember creates version 1 when no row exists", async () => {
  const service = createService({ existing: null });
  const result = await service.upsertForMember("ws-1", "denali-create", {
    data: { value: "new" },
    version: 0,
    lastModified: 2000,
  });

  assert.equal(result.version, 1);
  assert.deepEqual(result.data, { value: "new" });
  assert.equal(result.lastModified, 2000);
});

test("upsertForMember increments version when incoming version matches", async () => {
  const existing = mockRow({ version: 2, data: { value: "old" } });
  const service = createService({ existing, updateAffected: 1 });
  const before = Date.now();

  const result = await service.upsertForMember("ws-1", "denali-create", {
    data: { value: "updated" },
    version: 2,
    lastModified: 3000,
  });

  assert.equal(result.version, 3);
  assert.deepEqual(result.data, { value: "updated" });
  assert.ok(result.lastModified >= before);
});

test("upsertForMember throws DraftConflictException when version is stale", async () => {
  const existing = mockRow({ version: 3, data: { value: "server" } });
  const service = createService({ existing });

  await assert.rejects(
    () =>
      service.upsertForMember("ws-1", "denali-create", {
        data: { value: "client" },
        version: 2,
        lastModified: 4000,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DraftConflictException);
      const response = err.getResponse() as {
        error: {
          code: string;
          details: { server: { version: number; data: Record<string, unknown> } };
        };
      };
      assert.equal(response.error.code, "DRAFT_CONFLICT");
      assert.equal(response.error.details.server.version, 3);
      assert.deepEqual(response.error.details.server.data, { value: "server" });
      return true;
    },
  );
});

test("deleteForMember succeeds when a row is deleted", async () => {
  const service = createService({ existing: null, deleteResult: { affected: 1 } });
  await service.deleteForMember("ws-1", "denali-create");
});

test("deleteForMember throws when delete affects zero rows", async () => {
  const service = createService({ existing: null, deleteResult: { affected: 0 } });

  await assert.rejects(
    () => service.deleteForMember("ws-1", "denali-create"),
    (err: unknown) => err instanceof NotFoundException,
  );
});

test("deleteForMember throws when delete result has no affected count", async () => {
  const service = createService({ existing: null, deleteResult: {} });

  await assert.rejects(
    () => service.deleteForMember("ws-1", "denali-create"),
    (err: unknown) => err instanceof NotFoundException,
  );
});
