import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { TenantAuditEventsController } from "../../../src/modules/identity/tenant-audit-events.controller";
import { TenantAuditAction } from "../../../src/common/audit/tenant-audit-actions";

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
    appendOrWarn: (input: { action: string }) => Promise<void>;
    toCsv: () => string;
    toNdjson: () => string;
  } = {
    listForTenantExport: async () => listRows,
    appendOrWarn: async (_input: { action: string }) => undefined,
    toCsv: () => "csv",
    toNdjson: () => "ndjson"
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
