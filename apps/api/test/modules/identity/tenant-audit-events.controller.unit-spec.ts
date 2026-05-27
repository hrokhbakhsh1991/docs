import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { TenantAuditEventsController } from "../../../src/modules/identity/tenant-audit-events.controller";
import { TenantAuditAction } from "../../../src/common/audit/tenant-audit-actions";
import { encodeTenantAuditListCursor } from "../../../src/common/audit/tenant-audit-events.service";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeController(opts?: {
  jwtTenantId?: string | null;
  userId?: string | null;
  rows?: Array<{ id: string; tenantId: string; occurredAt: Date }>;
}) {
  const listRows = opts?.rows ?? [];
  const tenantAuditEventsService: {
    listForTenantExport: () => Promise<Array<{ id: string; tenantId: string; occurredAt: Date }>>;
    listForTenantPaged: (params: {
      limit: number;
      after?: { occurredAt: Date; id: string } | null;
    }) => Promise<{
      rows: Array<{ id: string; occurredAt: Date; actor: string; action: string }>;
      nextCursor: string | null;
    }>;
    appendOrWarn: (input: { action: string }) => Promise<void>;
    toCsv: () => string;
    toNdjson: () => string;
    listDraftConflictHotspots: (params: {
      tenantId: string;
      from?: Date;
      to?: Date;
      limit?: number;
    }) => Promise<
      Array<{
        resourceType: string;
        resourceId: string;
        conflictCount: number;
        lastOccurredAt: Date;
        sampleRequestId: string | null;
      }>
    >;
  } = {
    listForTenantExport: async () => listRows,
    listForTenantPaged: async (params) => ({
      rows: listRows.slice(0, params.limit).map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt,
        actor: "a@b.c",
        action: "auth.login.web"
      })),
      nextCursor: null
    }),
    appendOrWarn: async (_input: { action: string }) => undefined,
    toCsv: () => "csv",
    toNdjson: () => "ndjson",
    listDraftConflictHotspots: async () => [],
  };
  const requestContextService = {
    resolveEffectiveTenantId: () => opts?.jwtTenantId ?? TENANT_ID,
    getUserId: () => (opts && "userId" in opts ? opts.userId : USER_ID),
    tryGetClientIp: () => "127.0.0.1",
    tryGetRequestId: () => "req-test"
  };
  const userRepository = {
    findOne: async () => ({ id: USER_ID, email: "owner@test.local", deletedAt: null })
  };
  const controller = new TenantAuditEventsController(
    tenantAuditEventsService as never,
    requestContextService as never,
    userRepository as never
  );
  return { controller, tenantAuditEventsService };
}

function makeRes() {
  const headers = new Map<string, string>();
  return {
    setHeader: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
    headers
  };
}

test("exportTenantAudit allows tenant-scoped owner/admin and appends export audit event", async () => {
  const rows = [{ id: "1", tenantId: TENANT_ID, occurredAt: new Date("2026-01-01T00:00:00.000Z") }];
  const { controller, tenantAuditEventsService } = makeController({ rows });
  const res = makeRes();
  let appendedAction: string | null = null;
  tenantAuditEventsService.appendOrWarn = async (input: { action: string }) => {
    appendedAction = input.action;
  };

  const payload = await controller.exportTenantAudit(
    TENANT_ID,
    { format: "json", limit: 10 } as never,
    res as never
  );

  assert.ok(Array.isArray(payload));
  assert.equal(appendedAction, TenantAuditAction.DATA_EXPORT_AUDIT);
});

test("exportTenantAudit denies cross-tenant token usage", async () => {
  const { controller } = makeController({
    jwtTenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  });
  const res = makeRes();

  await assert.rejects(
    async () => {
      await controller.exportTenantAudit(TENANT_ID, { format: "csv" } as never, res as never);
    },
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "TENANT_SCOPE_FORBIDDEN");
      return true;
    }
  );
});

test("exportTenantAudit rejects unauthenticated export actor", async () => {
  const { controller } = makeController({ userId: null });
  const res = makeRes();

  await assert.rejects(
    async () => {
      await controller.exportTenantAudit(TENANT_ID, { format: "ndjson" } as never, res as never);
    },
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "AUTH_UNAUTHENTICATED");
      return true;
    }
  );
});

test("listTenantAudit returns newest-first rows for tenant-scoped token", async () => {
  const rows = [{ id: "1", tenantId: TENANT_ID, occurredAt: new Date("2026-01-01T00:00:00.000Z") }];
  const { controller } = makeController({ rows });
  const res = await controller.listTenantAudit(TENANT_ID, { limit: 10 } as never);
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0]?.id, "1");
  assert.equal(res.nextCursor, null);
});

test("listTenantAudit denies cross-tenant token usage", async () => {
  const { controller } = makeController({
    jwtTenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  });
  await assert.rejects(
    async () => {
      await controller.listTenantAudit(TENANT_ID, {} as never);
    },
    (error: unknown) => error instanceof ForbiddenException
  );
});

test("listTenantAudit rejects invalid cursor", async () => {
  const { controller } = makeController();
  await assert.rejects(
    async () => {
      await controller.listTenantAudit(TENANT_ID, { cursor: "%%%invalid%%%" } as never);
    },
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "AUDIT_CURSOR_INVALID");
      return true;
    }
  );
});

test("listTenantAudit forwards decoded cursor to service", async () => {
  const rows = [{ id: "1", tenantId: TENANT_ID, occurredAt: new Date("2026-01-01T00:00:00.000Z") }];
  const { controller, tenantAuditEventsService } = makeController({ rows });
  let receivedAfter: unknown;
  tenantAuditEventsService.listForTenantPaged = async (params) => {
    receivedAfter = params.after;
    return { rows: [], nextCursor: null };
  };
  const cursor = encodeTenantAuditListCursor({
    occurredAt: new Date("2026-01-15T00:00:00.000Z"),
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  });
  await controller.listTenantAudit(TENANT_ID, { cursor } as never);
  assert.ok(
    receivedAfter &&
      typeof receivedAfter === "object" &&
      "id" in (receivedAfter as object) &&
      (receivedAfter as { id: string }).id === "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  );
});

test("listDraftConflicts returns aggregated rows", async () => {
  const { controller, tenantAuditEventsService } = makeController();
  tenantAuditEventsService.listDraftConflictHotspots = async () => [
    {
      resourceType: "draft_snapshot",
      resourceId: "a:b:denali-create",
      conflictCount: 7,
      lastOccurredAt: new Date("2026-01-10T00:00:00.000Z"),
      sampleRequestId: "req-1",
    },
  ];
  const response = await controller.listDraftConflicts(TENANT_ID, { limit: 10 } as never);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0]?.conflictCount, 7);
  assert.equal(response.data[0]?.resourceId, "a:b:denali-create");
});

test("listDraftConflicts denies cross-tenant token usage", async () => {
  const { controller } = makeController({
    jwtTenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  });
  await assert.rejects(
    async () => {
      await controller.listDraftConflicts(TENANT_ID, {} as never);
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});
