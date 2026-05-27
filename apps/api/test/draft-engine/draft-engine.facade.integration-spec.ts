import assert from "node:assert/strict";
import test from "node:test";
import { DataSource } from "typeorm";

import {
  createDefaultDraftMigratorRegistry,
  CURRENT_DRAFT_SCHEMA_VERSION,
  DENALI_CREATE_DRAFT_KEY,
} from "@repo/shared-contracts";

import { DraftConflictException } from "../../src/modules/draft-engine/draft-conflict.exception";
import { DraftEngineFacade } from "../../src/modules/draft-engine/draft-engine.facade";
import { DraftEventEntity } from "../../src/modules/draft-engine/entities/draft-event.entity";
import { DraftSnapshotEntity } from "../../src/modules/draft-engine/entities/draft-snapshot.entity";
import { PostgresDraftSnapshotStore } from "../../src/modules/draft-engine/storage/postgres-draft-snapshot.store";
import { DraftScopeResolver } from "../../src/modules/draft-engine/storage/draft-scope.resolver";
import type { RequestContextService } from "../../src/common/request-context/request-context.service";
import type { AuditLogService } from "../../src/common/audit/audit-log.service";

test("DraftEngineFacade integration (requires DATABASE_URL)", async (t) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    t.skip("DATABASE_URL not set");
    return;
  }

  const workspaceId = "00000000-0000-4000-8000-000000000098";
  const userId = "00000000-0000-4000-8000-000000000099";
  const draftKey = `integration-${Date.now().toString(36)}`;

  const dataSource = new DataSource({
    type: "postgres",
    url,
    entities: [DraftSnapshotEntity, DraftEventEntity],
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();

  const repo = dataSource.getRepository(DraftSnapshotEntity);
  const draftEventRepo = dataSource.getRepository(DraftEventEntity);
  const store = new PostgresDraftSnapshotStore(repo);
  const requestContext = {
    resolveEffectiveTenantId: () => workspaceId,
    getUserId: () => userId,
    tryGetCorrelationId: () => "integration-trace-id",
    tryGetRequestId: () => "integration-trace-id",
  } as unknown as RequestContextService;
  const scopeResolver = new DraftScopeResolver(requestContext);
  const facade = new DraftEngineFacade(
    store,
    scopeResolver,
    createDefaultDraftMigratorRegistry(),
    { logEvent: async () => undefined } as unknown as AuditLogService,
    draftEventRepo,
    requestContext,
  );

  try {
    await repo.delete({ workspaceId, userId, draftKey });

    const created = await facade.upsertForMember(workspaceId, draftKey, {
      data: { form: { title: "Integration" }, currentStepIndex: 0 },
      version: 0,
      schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: Date.now(),
    });
    assert.equal(created.version, 1);
    assert.equal(created.schemaVersion, CURRENT_DRAFT_SCHEMA_VERSION);

    const loaded = await facade.findForMember(workspaceId, draftKey);
    assert.ok(loaded);
    assert.equal(loaded.version, 1);
    assert.equal((loaded.data as { form?: { title?: string } }).form?.title, "Integration");

    await repo.update(
      { workspaceId, userId, draftKey },
      { data: { broken: true } as never },
    );
    const migrated = await facade.findForMember(workspaceId, draftKey);
    assert.ok(migrated);
    assert.equal(migrated.schemaVersion, CURRENT_DRAFT_SCHEMA_VERSION);
    assert.equal((migrated.data as { currentStepIndex?: number }).currentStepIndex, 0);

    const bumped = await facade.upsertForMember(workspaceId, draftKey, {
      data: { form: { title: "v2" }, currentStepIndex: 1 },
      version: migrated!.version,
      schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: Date.now(),
    });
    assert.equal(bumped.version, 2);

    const raceVersion = bumped.version;
    const results = await Promise.allSettled([
      facade.upsertForMember(workspaceId, draftKey, {
        data: { form: { title: "race-a" }, currentStepIndex: 0 },
        version: raceVersion,
        schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
        lastModified: Date.now(),
      }),
      facade.upsertForMember(workspaceId, draftKey, {
        data: { form: { title: "race-b" }, currentStepIndex: 0 },
        version: raceVersion,
        schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
        lastModified: Date.now(),
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one concurrent upsert should succeed");
    assert.equal(rejected.length, 1, "exactly one concurrent upsert should conflict");
    const failure = rejected[0];
    assert.equal(failure.status, "rejected");
    assert.ok(
      failure.reason instanceof DraftConflictException,
      "loser must receive DraftConflictException",
    );
  } finally {
    await repo.delete({ workspaceId, userId, draftKey });
    await dataSource.destroy();
  }
});

test("DraftEngineFacade legacy schema_version 1 → loadDraft → saveDraft (requires DATABASE_URL)", async (t) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    t.skip("DATABASE_URL not set");
    return;
  }

  const workspaceId = "00000000-0000-4000-8000-000000000097";
  const userId = "00000000-0000-4000-8000-000000000099";
  const draftKey = DENALI_CREATE_DRAFT_KEY;

  const dataSource = new DataSource({
    type: "postgres",
    url,
    entities: [DraftSnapshotEntity, DraftEventEntity],
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();

  const repo = dataSource.getRepository(DraftSnapshotEntity);
  const draftEventRepo = dataSource.getRepository(DraftEventEntity);
  const store = new PostgresDraftSnapshotStore(repo);
  const requestContext = {
    resolveEffectiveTenantId: () => workspaceId,
    getUserId: () => userId,
    tryGetCorrelationId: () => "integration-trace-id",
    tryGetRequestId: () => "integration-trace-id",
  } as unknown as RequestContextService;
  const scopeResolver = new DraftScopeResolver(requestContext);
  const facade = new DraftEngineFacade(
    store,
    scopeResolver,
    createDefaultDraftMigratorRegistry(),
    { logEvent: async () => undefined } as unknown as AuditLogService,
    draftEventRepo,
    requestContext,
  );

  try {
    await repo.delete({ workspaceId, userId, draftKey });

    await repo.insert({
      workspaceId,
      userId,
      draftKey,
      data: { legacyTitle: "old" },
      version: 1,
      schemaVersion: 1,
      lastModified: String(Date.now()),
    });

    const loaded = await facade.loadDraft(workspaceId, draftKey);
    assert.ok(loaded);
    assert.equal(loaded.schemaVersion, CURRENT_DRAFT_SCHEMA_VERSION);
    assert.equal(loaded.data.currentStepIndex, 0);
    assert.deepEqual(loaded.data.form, {});

    const saved = await facade.saveDraft(workspaceId, draftKey, {
      data: { form: { title: "after-migration" }, currentStepIndex: 1 },
      version: loaded.version,
      schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: Date.now(),
    });
    assert.equal(saved.version, 2);
    assert.equal((saved.data as { form?: { title?: string } }).form?.title, "after-migration");
  } finally {
    await repo.delete({ workspaceId, userId, draftKey });
    await dataSource.destroy();
  }
});
