import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { render } from "@testing-library/react";

import { buildTenantAuthz } from "@app-tour/workspace-sdk/auth";
import { STARTER_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { WorkspaceWizardHost } from "../src/wizard/workspace-wizard-host";

describe("WorkspaceWizardHost runtime security", () => {
  it("renders 403 deny surface for CASL-unauthorized actor (no wizard DOM)", () => {
    const deniedAuthz = buildTenantAuthz({
      userId: "unauthorized",
      tenantId: "tenant-a",
      role: "member",
      status: "SUSPENDED",
      workspaceId: "ws-1",
    });

    const draft = emptyTourWizardDraft();
    const { container } = render(
      <WorkspaceWizardHost
        authz={deniedAuthz}
        tenantId="tenant-a"
        workspaceId="ws-1"
        pluginId={STARTER_WORKSPACE_PLUGIN_ID}
        draft={draft}
        onDraftChange={() => {}}
      />,
    );

    assert.ok(container.querySelector("[data-workspace-wizard-forbidden]"));
    assert.equal(container.querySelector("[data-workspace-wizard]"), null);
    assert.equal(container.querySelector("[data-wizard-step]"), null);
    assert.equal(container.querySelector("input"), null);
  });
});
