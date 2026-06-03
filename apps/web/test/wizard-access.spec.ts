import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantAuthz } from "@app-tour/workspace-sdk/auth";
import { STARTER_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

import { canLoadWorkspaceWizard } from "../src/wizard/wizard-access";

const TENANT = "tenant-a";
const WORKSPACE = "ws-1";

describe("canLoadWorkspaceWizard (deny-by-default)", () => {
  it("denies suspended member", () => {
    const authz = buildTenantAuthz({
      userId: "u1",
      tenantId: TENANT,
      role: "member",
      status: "SUSPENDED",
      workspaceId: WORKSPACE,
    });
    assert.equal(
      canLoadWorkspaceWizard({
        authz,
        tenantId: TENANT,
        workspaceId: WORKSPACE,
        pluginId: STARTER_WORKSPACE_PLUGIN_ID,
      }),
      false,
    );
  });

  it("allows active member with workspace binding", () => {
    const authz = buildTenantAuthz({
      userId: "u1",
      tenantId: TENANT,
      role: "member",
      status: "ACTIVE",
      workspaceId: WORKSPACE,
    });
    assert.equal(
      canLoadWorkspaceWizard({
        authz,
        tenantId: TENANT,
        workspaceId: WORKSPACE,
        pluginId: STARTER_WORKSPACE_PLUGIN_ID,
      }),
      true,
    );
  });
});
