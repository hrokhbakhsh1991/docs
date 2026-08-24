import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseWorkspaceResourceQuotaFromTheme,
  resolveWorkspaceResourcePolicy,
  workspaceResourceConsumerKey,
  workspaceWriteConcurrencyKey,
} from "./workspace-resource-policy";

describe("workspace-resource-policy (MAT-011)", () => {
  it("workspace A quota key does not match workspace B", () => {
    const keyA = workspaceResourceConsumerKey({
      tenantId: "tenant-1",
      workspaceType: "denali",
      connectionTier: "pool",
      operationTier: "write",
      method: "POST",
      path: "/tours",
    });
    const keyB = workspaceResourceConsumerKey({
      tenantId: "tenant-1",
      workspaceType: "urban",
      connectionTier: "pool",
      operationTier: "write",
      method: "POST",
      path: "/tours",
    });
    assert.notEqual(keyA, keyB);
  });

  it("parses per-workspace theme quota overrides", () => {
    const quota = parseWorkspaceResourceQuotaFromTheme(
      {
        workspaceResourceQuotas: {
          denali: { writeRpm: 30, maxConcurrentWrites: 4 },
        },
      },
      "denali"
    );
    assert.deepEqual(quota, { writeRpm: 30, maxConcurrentWrites: 4 });
  });

  it("unknown workspace type returns null policy", () => {
    assert.equal(resolveWorkspaceResourcePolicy({ workspaceType: "" }), null);
    assert.equal(resolveWorkspaceResourcePolicy({ workspaceType: "   " }), null);
  });

  it("system exempt path bypasses quota enforcement flag", () => {
    const policy = resolveWorkspaceResourcePolicy({
      workspaceType: "denali",
      systemExempt: true,
    });
    assert.equal(policy?.exempt, true);
  });

  it("write concurrency keys are workspace-scoped within tenant", () => {
    assert.notEqual(
      workspaceWriteConcurrencyKey("tenant-1", "denali"),
      workspaceWriteConcurrencyKey("tenant-1", "urban")
    );
  });
});
