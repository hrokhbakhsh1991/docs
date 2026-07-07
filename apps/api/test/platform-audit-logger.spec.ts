import assert from "node:assert";
import { describe, it } from "node:test";
import {
  appendPlatformAuditEvent,
  PLATFORM_AUDIT_ACTION_TENANT_CREATED,
} from "../src/platform/platform-audit-logger.ts";

describe("P1-N-056: appendPlatformAuditEvent", () => {
  it("should persist action to platform audit", async () => {
    let savedData: any = null;

    const mockTx = {
      platformAuditEvent: {
        create: async ({ data }: any) => {
          savedData = data;
          return { id: "test-id", ...data };
        },
      },
    };

    await appendPlatformAuditEvent(mockTx as any, {
      action: PLATFORM_AUDIT_ACTION_TENANT_CREATED,
      entityType: "tenant",
      entityId: "test-tenant-id",
      actorId: "operator-123",
      metadata: { subdomain: "test" },
    });

    assert.strictEqual(savedData.action, PLATFORM_AUDIT_ACTION_TENANT_CREATED);
    assert.strictEqual(savedData.entityType, "tenant");
    assert.strictEqual(savedData.entityId, "test-tenant-id");
  });

  it("should set actorId when provided", async () => {
    let savedData: any = null;

    const mockTx = {
      platformAuditEvent: {
        create: async ({ data }: any) => {
          savedData = data;
          return { id: "test-id", ...data };
        },
      },
    };

    await appendPlatformAuditEvent(mockTx as any, {
      action: "TEST_ACTION",
      entityType: "tenant",
      entityId: "test-id",
      actorId: "operator-456",
    });

    assert.strictEqual(savedData.actorId, "operator-456");
  });
});

// Made with Bob
