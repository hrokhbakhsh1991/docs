import assert from "node:assert/strict";
import test from "node:test";
import { AUDIT_CATEGORY } from "./audit-category";
import { AuditService } from "./audit.service";
import { recordAuditEvent } from "./record-audit-event";

test("AuditService.recordAuditEvent merges metadata and calls tenant append", async () => {
  const appended: unknown[] = [];
  const audit = new AuditService(
    {
      warn: () => undefined,
      info: () => undefined
    } as never,
    {
      tryGetTenantId: () => "11111111-1111-4111-8111-111111111111",
      tryGetRequestId: () => "req-trace-1",
      tryGetUserId: () => "22222222-2222-4222-8222-222222222222",
      tryGetClientIp: () => "127.0.0.1"
    } as never,
    {
      appendOrWarn: async (input: Record<string, unknown>) => {
        appended.push(input);
      }
    } as never
  );

  await audit.recordAuditEvent({
    category: AUDIT_CATEGORY.SECURITY,
    action: "security.policy.evaluated",
    actorDisplay: "system",
    resource: { type: "policy", id: "p1" },
    metadata: { detail: "ok" }
  });

  assert.equal(appended.length, 1);
  const row = appended[0] as {
    tenantId: string;
    requestId: string | null;
    actorUserId: string | null;
    metadata: Record<string, unknown>;
    action: string;
  };
  assert.equal(row.tenantId, "11111111-1111-4111-8111-111111111111");
  assert.equal(row.requestId, "req-trace-1");
  assert.equal(row.actorUserId, "22222222-2222-4222-8222-222222222222");
  assert.equal(row.metadata.audit_category, "SECURITY");
  assert.equal(row.metadata.correlation_id, "req-trace-1");
  assert.equal(row.metadata.tenant_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(row.metadata.actor_user_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(row.metadata.detail, "ok");
  assert.equal(row.action, "security.policy.evaluated");
});

test("recordAuditEvent helper delegates to AuditService", async () => {
  let called = false;
  const audit = {
    async recordAuditEvent() {
      called = true;
    }
  } as unknown as AuditService;
  await recordAuditEvent(audit, {
    category: AUDIT_CATEGORY.AUTH,
    action: "auth.login",
    actorDisplay: "u@example.com",
    tenantId: "11111111-1111-4111-8111-111111111111"
  });
  assert.equal(called, true);
});
