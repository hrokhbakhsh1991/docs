import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCanPerformWorkspaceOwnerMutation,
  isWorkspaceAuthSurfaceInAllowlist,
} from "../src/auth/index";
import type { TenantAuthz } from "../src/auth/index";

describe("workspace-sdk auth P-lib (DG-1.5)", () => {
  it("createCanPerformWorkspaceOwnerMutation forwards policy", () => {
    const calls: unknown[] = [];
    const authz = {
      canPerformWorkspaceOwnerMutation(tenantId, surface, workspaceType, policy) {
        calls.push({ tenantId, surface, workspaceType, policy });
        return true;
      },
    } as unknown as TenantAuthz;
    const allow = new Set(["demo.surface"]);
    const can = createCanPerformWorkspaceOwnerMutation({
      requiredWorkspaceType: "demo",
      allowedSurfaces: allow,
    });
    assert.equal(can(authz, "t1", "demo.surface", "demo"), true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      tenantId: "t1",
      surface: "demo.surface",
      workspaceType: "demo",
      policy: { requiredWorkspaceType: "demo", allowedSurfaces: allow },
    });
  });

  it("isWorkspaceAuthSurfaceInAllowlist narrows", () => {
    const allow = new Set(["a.b"]);
    assert.equal(isWorkspaceAuthSurfaceInAllowlist("a.b", allow), true);
    assert.equal(isWorkspaceAuthSurfaceInAllowlist("x.y", allow), false);
  });
});
