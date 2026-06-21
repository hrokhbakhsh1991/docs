import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { exportPlatformAuditCsv } from "../src/platform/export-platform-audit-csv.ts";

describe("exportPlatformAuditCsv", () => {
  it("includes header and row", () => {
    const csv = exportPlatformAuditCsv([
      {
        id: "a1",
        action: "TENANT_CREATED",
        entityType: "tenant",
        entityId: "t1",
        actorId: "+989121234567",
        createdAt: "2026-06-21T10:00:00.000Z",
      },
    ]);
    assert.match(csv, /^id,action,entityType,entityId,actorId,createdAt/);
    assert.match(csv, /TENANT_CREATED/);
  });
});
