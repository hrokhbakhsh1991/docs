import assert from "node:assert";
import { describe, it } from "node:test";
import { inviteTenantOwner } from "../src/platform/invite-tenant-owner.ts";

describe("P1-N-058: inviteTenantOwner", () => {
  it("should create pending invite with owner role", async () => {
    let savedData: any = null;

    const mockTx = {
      operatorPendingInvite: {
        create: async ({ data }: any) => {
          savedData = data;
          return { id: "test-id", ...data };
        },
      },
    };

    const result = await inviteTenantOwner(mockTx as any, {
      tenantId: "test-tenant-id",
      phone: "+989123456789",
      nameNote: "Test Owner",
      invitedByUserId: "00000000-0000-4000-8000-000000000201",
    });

    assert.strictEqual(savedData.role, "owner", "role should be owner");
    assert.strictEqual(savedData.status, "INVITED", "status should be INVITED");
    assert.ok(result.inviteId, "should return inviteId");
    assert.ok(result.inviteToken, "should return inviteToken");
  });

  it("should match phone in invite data", async () => {
    let savedData: any = null;

    const mockTx = {
      operatorPendingInvite: {
        create: async ({ data }: any) => {
          savedData = data;
          return { id: "test-id", ...data };
        },
      },
    };

    await inviteTenantOwner(mockTx as any, {
      tenantId: "test-tenant-id",
      phone: "+989121234567",
      invitedByUserId: "00000000-0000-4000-8000-000000000201",
    });

    assert.strictEqual(savedData.phone, "+989121234567", "phone should match input");
    assert.strictEqual(savedData.tenantId, "test-tenant-id", "tenantId should match");
  });
});

// Made with Bob
