import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultDraftMigratorRegistry,
  CURRENT_DRAFT_SCHEMA_VERSION,
  type DraftSnapshot,
  type DraftStoragePort,
} from "@repo/shared-contracts";

import { DraftConflictException } from "./draft-conflict.exception";
import { DraftEngineFacade } from "./draft-engine.facade";
import { DraftScopeResolver } from "./storage/draft-scope.resolver";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditLogService } from "../../common/audit/audit-log.service";

class InMemoryDraftStore implements DraftStoragePort {
  private row: DraftSnapshot | null = null;

  constructor(initial?: DraftSnapshot) {
    this.row = initial ?? null;
  }

  async find(): Promise<DraftSnapshot | null> {
    return this.row;
  }

  async upsert(_scope: unknown, snapshot: DraftSnapshot): Promise<DraftSnapshot> {
    if (this.row == null) {
      if (snapshot.version !== 0) {
        throw new DraftConflictException({
          data: snapshot.data,
          version: 0,
          schemaVersion: snapshot.schemaVersion,
          lastModified: snapshot.lastModified,
        });
      }
      this.row = { ...snapshot, version: 1 };
      return this.row;
    }
    if (this.row.version !== snapshot.version) {
      throw new DraftConflictException(this.row);
    }
    this.row = { ...snapshot, version: this.row.version + 1, lastModified: Date.now() };
    return this.row;
  }

  async upgradeSchemaInPlace(_scope: unknown, input: DraftSnapshot): Promise<DraftSnapshot | null> {
    if (!this.row || this.row.version !== input.version) {
      return null;
    }
    this.row = { ...this.row, data: input.data, schemaVersion: input.schemaVersion };
    return this.row;
  }

  async delete(): Promise<void> {
    this.row = null;
  }
}

function createFacade(
  store: InMemoryDraftStore,
  auditOverride?: Pick<AuditLogService, "logEvent">,
  options?: { draftEvents?: Array<{ eventType: string; baseVersion: number | null; nextVersion: number | null }> },
): DraftEngineFacade {
  const scopeResolver = {
    resolveOrThrow: () => ({
      workspaceId: "ws-1",
      userId: "user-1",
      draftKey: "denali-create",
    }),
  } as unknown as DraftScopeResolver;

  const auditLog = auditOverride ?? {
    logEvent: async () => undefined,
  };
  const draftEventsRepository = {
    insert: async (row: { eventType: string; baseVersion: number | null; nextVersion: number | null }) => {
      options?.draftEvents?.push(row);
    },
  };
  const requestContext = {
    tryGetCorrelationId: () => "trace-test",
    tryGetRequestId: () => "trace-test",
    resolveEffectiveTenantId: () => "ws-1",
  } as unknown as RequestContextService;
  return new DraftEngineFacade(
    store as never,
    scopeResolver,
    createDefaultDraftMigratorRegistry(),
    auditLog as unknown as AuditLogService,
    draftEventsRepository as never,
    requestContext,
  );
}

test("findForMember hides incomplete denali draft after migration when effectively empty", async () => {
  const store = new InMemoryDraftStore({
    data: { orphan: true },
    version: 2,
    schemaVersion: 1,
    lastModified: 1000,
  });
  const facade = createFacade(store);

  const result = await facade.findForMember("denali-create");
  assert.equal(result, null);
});

test("findForMember with V2 off still hides effectively empty denali payload", async () => {
  const prevV2 = process.env.DRAFT_ENGINE_V2_ENABLED;
  const prevFacade = process.env.DRAFT_ENGINE_FACADE_ENABLED;
  process.env.DRAFT_ENGINE_V2_ENABLED = "0";
  process.env.DRAFT_ENGINE_FACADE_ENABLED = "0";
  try {
    const store = new InMemoryDraftStore({
      data: { orphan: true },
      version: 2,
      schemaVersion: 1,
      lastModified: 1000,
    });
    const facade = createFacade(store);
    const result = await facade.findForMember("denali-create");
    assert.equal(result, null);
  } finally {
    if (prevV2 !== undefined) {
      process.env.DRAFT_ENGINE_V2_ENABLED = prevV2;
    } else {
      delete process.env.DRAFT_ENGINE_V2_ENABLED;
    }
    if (prevFacade !== undefined) {
      process.env.DRAFT_ENGINE_FACADE_ENABLED = prevFacade;
    } else {
      delete process.env.DRAFT_ENGINE_FACADE_ENABLED;
    }
  }
});

test("findForMember hides empty denali draft payloads", async () => {
  const store = new InMemoryDraftStore({
    data: { form: {}, currentStepIndex: 0 },
    version: 1,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 1000,
  });
  const facade = createFacade(store);
  const result = await facade.findForMember("denali-create");
  assert.equal(result, null);
});

test("findForMember keeps non-empty denali draft payloads", async () => {
  const store = new InMemoryDraftStore({
    data: { form: { basicInfo: { title: "Tour draft" } }, currentStepIndex: 0 },
    version: 1,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 1000,
  });
  const facade = createFacade(store);
  const result = await facade.findForMember("denali-create");
  assert.ok(result);
});

test("upsertForMember emits draft_engine.upsert audit event", async () => {
  const store = new InMemoryDraftStore();
  const actions: string[] = [];
  const events: Array<{ eventType: string; baseVersion: number | null; nextVersion: number | null }> = [];
  const facade = createFacade(store, {
    logEvent: async (input: { action: string }) => {
      actions.push(input.action);
    },
  } as never, { draftEvents: events });
  await facade.upsertForMember("ws-1", "denali-create", {
    data: { form: {}, currentStepIndex: 0 },
    version: 0,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: Date.now(),
  });
  assert.deepEqual(actions, ["draft_engine.upsert"]);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "draft_saved");
  assert.equal(events[0]?.baseVersion, 0);
  assert.equal(events[0]?.nextVersion, 1);
});

test("upsertForMember emits draft_engine.conflict audit event on OCC conflict", async () => {
  const store = new InMemoryDraftStore({
    data: { form: {} },
    version: 3,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 1000,
  });
  const actions: string[] = [];
  const events: Array<{ eventType: string; baseVersion: number | null; nextVersion: number | null }> = [];
  const facade = createFacade(store, {
    logEvent: async (input: { action: string }) => {
      actions.push(input.action);
    },
  } as never, { draftEvents: events });
  await assert.rejects(
    () =>
      facade.upsertForMember("ws-1", "denali-create", {
        data: { form: {}, currentStepIndex: 0 },
        version: 1,
        schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
        lastModified: Date.now(),
      }),
    (error: unknown) => error instanceof Error,
  );
  assert.ok(actions.includes("draft_engine.conflict"));
  assert.ok(events.some((event) => event.eventType === "draft_conflict"));
});

test("deleteForMember persists draft_deleted event", async () => {
  const store = new InMemoryDraftStore({
    data: { form: {} },
    version: 2,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 1000,
  });
  const events: Array<{ eventType: string; baseVersion: number | null; nextVersion: number | null }> = [];
  const facade = createFacade(store, undefined, { draftEvents: events });
  await facade.deleteForMember("denali-create");
  assert.ok(events.some((event) => event.eventType === "draft_deleted"));
});
